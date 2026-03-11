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

      const newMatches = matchResults
        .filter((r) => !r.intlMatchId)
        .map((r) => r.match);

      if (newMatches.length > 0) {
        await supabase.from('matches').upsert(newMatches, { onConflict: 'external_id' });
      }

      // Get all match IDs in parallel batches
      const allExtIds = result.matches.map((m) => m.external_id);
      const ID_BATCH = 50;
      const batchPromises = [];
      for (let i = 0; i < allExtIds.length; i += ID_BATCH) {
        const batch = allExtIds.slice(i, i + ID_BATCH);
        batchPromises.push(
          supabase.from('matches').select('id, external_id').in('external_id', batch)
        );
      }
      const batchResults = await Promise.all(batchPromises);

      const idMap = {};
      for (const { data } of batchResults) {
        if (data) for (const m of data) idMap[m.external_id] = m.id;
      }
      log.info(`idMap size: ${Object.keys(idMap).length}, oddsRows: ${result.oddsRows.length}`);

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
 * POST /api/domestic/scrape-with-auth
 * Scrape a Korean site that requires login.
 * Credentials are used once and NOT stored.
 */
router.post('/scrape-with-auth', async (req, res) => {
  // Placeholder for future login-required sites
  res.status(501).json({
    error: 'Not implemented yet. Betman does not require login for odds viewing.',
    hint: 'This endpoint is reserved for future Korean sites that require authentication.',
  });
});

module.exports = router;
