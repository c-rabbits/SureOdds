/**
 * Domestic (국내) odds API routes.
 *
 * - Manual odds input
 * - Betman scraping trigger
 * - Match linking (domestic ↔ international)
 */

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { scrapeBetman, scrapeProtoRound, findProtoRounds, getLastScrapeResult } = require('../collector/betmanScraper');
const { findMatchingInternationalMatch, findEnglishName } = require('../services/teamMatcher');
const { createServiceLogger } = require('../config/logger');

const log = createServiceLogger('Domestic');

/**
 * POST /api/domestic/odds
 * Manually input domestic odds for a match.
 */
router.post('/odds', async (req, res) => {
  try {
    const { matchId, bookmaker, marketType, handicapPoint, odds1, odds2, oddsDraw } = req.body;

    if (!matchId || !bookmaker || !marketType) {
      return res.status(400).json({ error: 'matchId, bookmaker, and marketType are required' });
    }
    if (!odds1 && !odds2) {
      return res.status(400).json({ error: 'At least odds1 and odds2 are required' });
    }

    const oddsRow = {
      match_id: matchId,
      bookmaker: bookmaker || 'manual_domestic',
      bookmaker_title: bookmaker === 'betman_proto' ? '베트맨 프로토' : bookmaker || '수동 입력',
      market_type: marketType,
      handicap_point: handicapPoint ?? 0,
      outcome_1_odds: odds1 || null,
      outcome_2_odds: odds2 || null,
      outcome_draw_odds: oddsDraw || null,
      source_type: 'domestic',
    };

    const { data, error } = await supabase.from('odds').upsert(oddsRow, {
      onConflict: 'match_id,bookmaker,market_type,handicap_point,source_type',
    });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, data: oddsRow });
  } catch (err) {
    log.error('Error saving domestic odds', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/domestic/betman/scrape
 * Trigger Betman scraping.
 */
router.post('/betman/scrape', async (req, res) => {
  try {
    const result = await scrapeBetman();

    if (result.matches.length > 0) {
      // Check all matches for international counterparts in parallel
      const matchResults = await Promise.all(
        result.matches.map(async (match) => {
          const intlMatchId = await findMatchingInternationalMatch(match);
          return { match, intlMatchId };
        })
      );

      // Build a pre-filled mapping: domestic_external_id → international match UUID
      // This is the KEY step for cross-arbitrage: domestic odds get assigned
      // to the same match_id as international odds.
      const linkedIdMap = {};
      let linkedCount = 0;
      for (const r of matchResults) {
        if (r.intlMatchId) {
          linkedIdMap[r.match.external_id] = r.intlMatchId;
          linkedCount++;
        }
      }
      log.info(`Match linking: ${linkedCount} linked to international, ${matchResults.length - linkedCount} domestic-only`);

      // Only insert matches that DON'T have international counterparts
      const newMatches = matchResults
        .filter((r) => !r.intlMatchId)
        .map((r) => r.match);

      if (newMatches.length > 0) {
        await supabase.from('matches').upsert(newMatches, { onConflict: 'external_id' });
      }

      // Get match IDs for domestic-only matches (newly inserted)
      const domesticOnlyExtIds = newMatches.map((m) => m.external_id);
      const idMap = { ...linkedIdMap }; // Start with linked international UUIDs

      if (domesticOnlyExtIds.length > 0) {
        const ID_BATCH = 50;
        const batchPromises = [];
        for (let i = 0; i < domesticOnlyExtIds.length; i += ID_BATCH) {
          const batch = domesticOnlyExtIds.slice(i, i + ID_BATCH);
          batchPromises.push(
            supabase.from('matches').select('id, external_id').in('external_id', batch)
          );
        }
        const batchResults = await Promise.all(batchPromises);
        for (const { data } of batchResults) {
          if (data) for (const m of data) idMap[m.external_id] = m.id;
        }
      }
      log.info(`idMap size: ${Object.keys(idMap).length} (${linkedCount} linked + ${Object.keys(idMap).length - linkedCount} domestic-only), oddsRows: ${result.oddsRows.length}`);

      // Upsert odds
      const oddsRows = result.oddsRows
        .map(({ match_external_id, ...rest }) => ({
          ...rest,
          match_id: idMap[match_external_id],
          handicap_point: rest.handicap_point ?? 0,
          source_type: 'domestic',
        }))
        .filter((o) => o.match_id);

      log.info(`Mapped odds rows with match_id: ${oddsRows.length}`);

      // Upsert odds in parallel batches
      const BATCH_SIZE = 100;
      const oddsBatchPromises = [];
      for (let i = 0; i < oddsRows.length; i += BATCH_SIZE) {
        const batch = oddsRows.slice(i, i + BATCH_SIZE);
        oddsBatchPromises.push(
          supabase.from('odds').upsert(batch, {
            onConflict: 'match_id,bookmaker,market_type,handicap_point,source_type',
          }).then(({ error }) => {
            if (error) log.error(`Odds upsert error batch ${i}`, { error: error.message });
            else log.info(`Odds batch ${i}-${i+batch.length} upserted OK`);
          })
        );
      }
      await Promise.all(oddsBatchPromises);
    }

    res.json({
      success: true,
      data: {
        matches: result.matches.length,
        oddsRows: result.oddsRows.length,
      },
    });
  } catch (err) {
    log.error('Error scraping Betman', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/domestic/betman/status
 * Get last Betman scrape result.
 */
router.get('/betman/status', (req, res) => {
  res.json({ data: getLastScrapeResult() });
});

/**
 * GET /api/domestic/betman/rounds
 * List available Proto rounds.
 */
router.get('/betman/rounds', async (req, res) => {
  try {
    const rounds = await findProtoRounds(true, true);
    res.json({ data: rounds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/domestic/match-link
 * Manually link a domestic match to an international match.
 * This re-assigns domestic odds to the international match.
 */
router.post('/match-link', async (req, res) => {
  try {
    const { domesticMatchId, internationalMatchId } = req.body;

    if (!domesticMatchId || !internationalMatchId) {
      return res.status(400).json({ error: 'Both domesticMatchId and internationalMatchId are required' });
    }

    // Update all domestic odds from the domestic match to point to the international match
    const { data: domesticOdds, error: fetchErr } = await supabase
      .from('odds')
      .select('*')
      .eq('match_id', domesticMatchId)
      .eq('source_type', 'domestic');

    if (fetchErr) return res.status(500).json({ error: fetchErr.message });

    let linked = 0;
    for (const odd of domesticOdds || []) {
      const { error: updateErr } = await supabase
        .from('odds')
        .upsert(
          { ...odd, match_id: internationalMatchId },
          { onConflict: 'match_id,bookmaker,market_type,handicap_point,source_type' }
        );
      if (!updateErr) linked++;
    }

    res.json({ success: true, data: { linkedOdds: linked } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/domestic/betman/save
 * Receive pre-scraped Betman data from the frontend (client-side scraping via Vercel Edge proxy).
 * The frontend scrapes betman.co.kr through a Korean edge function, then sends the parsed data here.
 */
router.post('/betman/save', async (req, res) => {
  try {
    const { matches, oddsRows } = req.body;

    if (!matches || !oddsRows) {
      return res.status(400).json({ error: 'matches and oddsRows are required' });
    }

    log.info(`Receiving client-scraped data: ${matches.length} matches, ${oddsRows.length} odds rows`);

    if (matches.length > 0) {
      // Check all matches for international counterparts in parallel
      const matchResults = await Promise.all(
        matches.map(async (match) => {
          const intlMatchId = await findMatchingInternationalMatch(match);
          return { match, intlMatchId };
        })
      );

      // Build pre-filled mapping: domestic_external_id → international match UUID
      const linkedIdMap = {};
      let linkedCount = 0;
      for (const r of matchResults) {
        if (r.intlMatchId) {
          linkedIdMap[r.match.external_id] = r.intlMatchId;
          linkedCount++;
        }
      }
      log.info(`[save] Match linking: ${linkedCount} linked to international, ${matchResults.length - linkedCount} domestic-only`);

      const newMatches = matchResults
        .filter((r) => !r.intlMatchId)
        .map((r) => r.match);

      if (newMatches.length > 0) {
        await supabase.from('matches').upsert(newMatches, { onConflict: 'external_id' });
      }

      // Get match IDs for domestic-only matches
      const domesticOnlyExtIds = newMatches.map((m) => m.external_id);
      const idMap = { ...linkedIdMap };

      if (domesticOnlyExtIds.length > 0) {
        const ID_BATCH = 50;
        const batchPromises = [];
        for (let i = 0; i < domesticOnlyExtIds.length; i += ID_BATCH) {
          const batch = domesticOnlyExtIds.slice(i, i + ID_BATCH);
          batchPromises.push(
            supabase.from('matches').select('id, external_id').in('external_id', batch)
          );
        }
        const batchResults = await Promise.all(batchPromises);
        for (const { data } of batchResults) {
          if (data) for (const m of data) idMap[m.external_id] = m.id;
        }
      }
      log.info(`[save] idMap size: ${Object.keys(idMap).length} (${linkedCount} linked), oddsRows: ${oddsRows.length}`);

      // Map odds rows with match_id
      const mappedOdds = oddsRows
        .map(({ match_external_id, ...rest }) => ({
          ...rest,
          match_id: idMap[match_external_id],
          handicap_point: rest.handicap_point ?? 0,
          source_type: 'domestic',
        }))
        .filter((o) => o.match_id);

      log.info(`Mapped odds rows with match_id: ${mappedOdds.length}`);

      // Upsert odds in parallel batches
      const BATCH_SIZE = 100;
      const oddsBatchPromises = [];
      for (let i = 0; i < mappedOdds.length; i += BATCH_SIZE) {
        const batch = mappedOdds.slice(i, i + BATCH_SIZE);
        oddsBatchPromises.push(
          supabase.from('odds').upsert(batch, {
            onConflict: 'match_id,bookmaker,market_type,handicap_point,source_type',
          }).then(({ error }) => {
            if (error) log.error(`Odds upsert error batch ${i}`, { error: error.message });
            else log.info(`Odds batch ${i}-${i+batch.length} upserted OK`);
          })
        );
      }
      await Promise.all(oddsBatchPromises);
    }

    res.json({
      success: true,
      data: {
        matches: matches.length,
        oddsRows: oddsRows.length,
      },
    });
  } catch (err) {
    log.error('Error saving client-scraped Betman data', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Available Sites (관리자가 관리하는 사이트 마스터 목록)
// ============================================================

/**
 * GET /api/domestic/available-sites
 * 사용자 드롭다운용 - 활성화된 사이트 목록
 */
router.get('/available-sites', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('available_sites')
      .select('*')
      .eq('is_active', true)
      .order('site_name');

    if (error) return res.status(500).json({ error: error.message });
    res.json({ data: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Site Registrations (사이트 추가)
// ============================================================
const crypto = require('crypto');

// AES-256-GCM encryption for site passwords
const ENCRYPT_KEY = process.env.SITE_ENCRYPT_KEY || 'sureodds-default-key-change-me!!'; // 32 bytes
function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPT_KEY.padEnd(32).slice(0, 32)), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

function decrypt(encryptedText) {
  if (!encryptedText) return null;
  try {
    const [ivHex, tagHex, encrypted] = encryptedText.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPT_KEY.padEnd(32).slice(0, 32)), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

/**
 * POST /api/domestic/site-registrations
 * User registers a site for crawling.
 */
router.post('/site-registrations', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: '인증이 필요합니다.' });

    const { availableSiteId, siteUrl, siteName, groupName, loginId, loginPw, checkInterval, enableCross, enableHandicap, enableOU } = req.body;

    if (!availableSiteId) {
      return res.status(400).json({ error: '사이트를 선택해주세요.' });
    }

    // available_sites에서 사이트 정보 가져오기
    const { data: avSite, error: avErr } = await supabase
      .from('available_sites')
      .select('*')
      .eq('id', availableSiteId)
      .eq('is_active', true)
      .single();

    if (avErr || !avSite) {
      return res.status(400).json({ error: '유효하지 않은 사이트입니다.' });
    }

    const row = {
      user_id: userId,
      available_site_id: availableSiteId,
      site_url: avSite.site_url,
      site_name: avSite.site_name,
      group_name: groupName || '기본',
      login_id: loginId || null,
      login_pw_encrypted: encrypt(loginPw),
      check_interval: checkInterval || 60,
      enable_cross: enableCross !== false,
      enable_handicap: enableHandicap !== false,
      enable_ou: enableOU === true,
      is_active: true,
      status: 'active',
    };

    const { data, error } = await supabase.from('site_registrations').insert(row).select().single();
    if (error) return res.status(500).json({ error: error.message });

    // Don't expose encrypted password in response
    if (data) delete data.login_pw_encrypted;

    res.json({ success: true, data });
  } catch (err) {
    log.error('Error creating site registration', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/domestic/site-registrations
 * Get current user's registered sites.
 */
router.get('/site-registrations', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: '인증이 필요합니다.' });

    const { data, error } = await supabase
      .from('site_registrations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    // Strip encrypted passwords from response
    const safe = (data || []).map(({ login_pw_encrypted, ...rest }) => rest);
    res.json({ data: safe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/domestic/site-registrations/:id
 * User updates their own site registration.
 */
router.patch('/site-registrations/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: '인증이 필요합니다.' });

    const { id } = req.params;
    const { siteName, groupName, loginId, loginPw, checkInterval, enableCross, enableHandicap, enableOU, isActive } = req.body;

    const updates = {};
    if (siteName !== undefined) updates.site_name = siteName;
    if (groupName !== undefined) updates.group_name = groupName;
    if (loginId !== undefined) updates.login_id = loginId;
    if (loginPw !== undefined) updates.login_pw_encrypted = encrypt(loginPw);
    if (checkInterval !== undefined) updates.check_interval = checkInterval;
    if (enableCross !== undefined) updates.enable_cross = enableCross;
    if (enableHandicap !== undefined) updates.enable_handicap = enableHandicap;
    if (enableOU !== undefined) updates.enable_ou = enableOU;
    if (isActive !== undefined) updates.is_active = isActive;

    const { data, error } = await supabase
      .from('site_registrations')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId) // ensure user owns it
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    if (data) delete data.login_pw_encrypted;

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/domestic/site-registrations/:id
 * User deletes their own site registration.
 */
router.delete('/site-registrations/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: '인증이 필요합니다.' });

    const { error } = await supabase
      .from('site_registrations')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', userId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Site Requests (사이트 작업요청)
// ============================================================

/**
 * POST /api/domestic/site-requests
 * User requests a site to be added.
 */
router.post('/site-requests', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: '인증이 필요합니다.' });

    const { siteUrl, siteName, notes } = req.body;
    if (!siteUrl) return res.status(400).json({ error: '사이트 URL은 필수입니다.' });

    const row = {
      user_id: userId,
      site_url: siteUrl.trim(),
      site_name: siteName?.trim() || null,
      notes: notes?.trim() || null,
      status: 'pending',
    };

    const { data, error } = await supabase.from('site_requests').insert(row).select().single();
    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true, data });
  } catch (err) {
    log.error('Error creating site request', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/domestic/site-requests
 * Get current user's site requests.
 */
router.get('/site-requests', async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: '인증이 필요합니다.' });

    const { data, error } = await supabase
      .from('site_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ data: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/domestic/site-requests/:id
 * Admin updates a site request status.
 */
router.patch('/site-requests/:id', async (req, res) => {
  try {
    if (req.user?.profile?.role !== 'admin') {
      return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    }

    const { status, adminNotes } = req.body;
    const updates = {};
    if (status) updates.status = status;
    if (adminNotes !== undefined) updates.admin_notes = adminNotes;

    const { data, error } = await supabase
      .from('site_requests')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    // 완료 처리 시 available_sites에 자동 추가 (중복 체크)
    if (status === 'completed' && data.site_url) {
      const { data: existing } = await supabase
        .from('available_sites')
        .select('id')
        .eq('site_url', data.site_url.trim())
        .maybeSingle();

      if (!existing) {
        await supabase.from('available_sites').insert({
          site_url: data.site_url.trim(),
          site_name: data.site_name?.trim() || data.site_url.trim(),
          description: data.notes || null,
          is_active: true,
        });
        log.info('Auto-added to available_sites from completed request', { siteUrl: data.site_url });
      }
    }

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
