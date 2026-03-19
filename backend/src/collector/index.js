const cron = require('node-cron');
const supabase = require('../config/supabase');
const { fetchAllOdds, getQuotaInfo } = require('./oddsApi');
const { scrapeBetman } = require('./betmanScraper');
const { scrapeStake } = require('./stakeScraper');
const { collectPinnacle, isConfigured: isPinnacleConfigured } = require('./pinnacleApi');
const { collectOddsApiIo, isConfigured: isOddsApiIoConfigured } = require('./oddsApiIo');
const { detectAllArbitrageForMatch } = require('../services/arbitrageEngine');
const { findMatchingInternationalMatch } = require('../services/teamMatcher');
const { sendNotification } = require('../services/notificationService');
const { saveOddsSnapshot } = require('../services/oddsHistoryService');
const { generatePredictions } = require('../services/aiPredictionService');
const { createServiceLogger } = require('../config/logger');
require('dotenv').config();

const log = createServiceLogger('Collector');

const INTERVAL_SECONDS = parseInt(process.env.COLLECTOR_INTERVAL || '300', 10);
const ODDS_API_INTERVAL_MIN = parseInt(process.env.ODDS_API_INTERVAL || '240', 10); // The Odds API: default 4 hours
const ODDS_API_IO_INTERVAL_MIN = parseInt(process.env.ODDS_API_IO_INTERVAL || '10', 10);
const BATCH_SIZE = 100;

// Track last collection result for status reporting
let lastCollectionResult = null;
let lastOddsApiIoResult = null;
let oddsApiIoSchedulerRunning = false;

function getLastResult() {
  return lastCollectionResult;
}

function getLastOddsApiIoResult() {
  return lastOddsApiIoResult;
}

/**
 * Transform raw odds API data into DB-ready rows.
 * Supports h2h, spreads, and totals markets.
 */
function transformOddsData(rawData) {
  const matches = [];
  const oddsRows = [];

  for (const event of rawData) {
    const match = {
      external_id: event.id,
      sport: event.sport_key,
      league: event.sport_title,
      home_team: event.home_team,
      away_team: event.away_team,
      start_time: event.commence_time,
    };
    matches.push(match);

    for (const bookmaker of event.bookmakers || []) {
      for (const market of bookmaker.markets || []) {
        // Deep link: prefer market.link, then first non-null outcome.link
        const eventUrl = market.link
          || (market.outcomes && market.outcomes.find((o) => o.link))?.link
          || null;

        if (market.key === 'h2h') {
          const homeOutcome = market.outcomes.find((o) => o.name === event.home_team);
          const awayOutcome = market.outcomes.find((o) => o.name === event.away_team);
          const drawOutcome = market.outcomes.find((o) => o.name === 'Draw');

          oddsRows.push({
            match_external_id: event.id,
            bookmaker: bookmaker.key,
            bookmaker_title: bookmaker.title,
            market_type: 'h2h',
            handicap_point: null,
            outcome_1_odds: homeOutcome?.price || null,
            outcome_2_odds: awayOutcome?.price || null,
            outcome_draw_odds: drawOutcome?.price || null,
            event_url: eventUrl,
          });
        } else if (market.key === 'spreads') {
          const homeOutcome = market.outcomes.find((o) => o.name === event.home_team);
          const awayOutcome = market.outcomes.find((o) => o.name === event.away_team);

          if (homeOutcome && awayOutcome) {
            oddsRows.push({
              match_external_id: event.id,
              bookmaker: bookmaker.key,
              bookmaker_title: bookmaker.title,
              market_type: 'spreads',
              handicap_point: homeOutcome.point,
              outcome_1_odds: homeOutcome.price,
              outcome_2_odds: awayOutcome.price,
              outcome_draw_odds: null,
              event_url: eventUrl,
            });
          }
        } else if (market.key === 'totals') {
          const overOutcome = market.outcomes.find((o) => o.name === 'Over');
          const underOutcome = market.outcomes.find((o) => o.name === 'Under');

          if (overOutcome && underOutcome) {
            oddsRows.push({
              match_external_id: event.id,
              bookmaker: bookmaker.key,
              bookmaker_title: bookmaker.title,
              market_type: 'totals',
              handicap_point: overOutcome.point,
              outcome_1_odds: overOutcome.price,
              outcome_2_odds: underOutcome.price,
              outcome_draw_odds: null,
              event_url: eventUrl,
            });
          }
        }
      }
    }
  }

  return { matches, oddsRows };
}

/**
 * Normalize team name for fuzzy matching.
 * Strips common suffixes (FC, SC, etc.), lowercases, trims.
 */
function normalizeTeam(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\s+(fc|sc|cf|ac|bc|afc|sfc|bk|fk|sk|if|ff|sv|se)$/i, '')
    .replace(/^(fc|sc|cf|ac|bc|afc|sfc|bk|fk|sk|if|ff|sv|se)\s+/i, '')
    .trim();
}

/**
 * Upsert matches and odds into Supabase (v2 schema).
 * Cross-source match linking: link The Odds API matches to existing Odds-API.io/Stake matches
 * by team name + start time proximity, so odds from different sources share the same match_id.
 */
async function saveToDatabase(matches, oddsRows) {
  // ── Cross-source match linking ──
  // Find existing matches that might be the same game from a different API source
  const linkedExtIds = {}; // this source's external_id → existing match DB id

  if (matches.length > 0) {
    // Get time range of incoming matches
    const startTimes = matches.map(m => new Date(m.start_time).getTime()).filter(t => !isNaN(t));
    if (startTimes.length > 0) {
      const minTime = new Date(Math.min(...startTimes) - 2 * 60 * 60 * 1000).toISOString();
      const maxTime = new Date(Math.max(...startTimes) + 2 * 60 * 60 * 1000).toISOString();

      // Fetch existing matches in the same time window
      const { data: existingMatches } = await supabase
        .from('matches')
        .select('id, external_id, home_team, away_team, start_time')
        .gte('start_time', minTime)
        .lte('start_time', maxTime);

      if (existingMatches && existingMatches.length > 0) {
        // Build lookup: normalized "home|away" → [existing matches]
        const existingByTeams = {};
        for (const em of existingMatches) {
          const h = normalizeTeam(em.home_team);
          const a = normalizeTeam(em.away_team);
          const key = `${h}|${a}`;
          if (!existingByTeams[key]) existingByTeams[key] = [];
          existingByTeams[key].push(em);
        }

        for (const m of matches) {
          const h = normalizeTeam(m.home_team);
          const a = normalizeTeam(m.away_team);
          const key = `${h}|${a}`;
          const candidates = existingByTeams[key];

          if (candidates) {
            const mTime = new Date(m.start_time).getTime();
            // ±2시간 이내에서 가장 가까운 시간의 매치를 찾음
            let bestCandidate = null;
            let bestDiff = Infinity;
            for (const c of candidates) {
              if (c.external_id === m.external_id) continue;
              const diff = Math.abs(new Date(c.start_time).getTime() - mTime);
              if (diff < 2 * 3600 * 1000 && diff < bestDiff) {
                bestDiff = diff;
                bestCandidate = c;
              }
            }
            if (bestCandidate) {
              linkedExtIds[m.external_id] = bestCandidate.id;
            }
          }
        }

        if (Object.keys(linkedExtIds).length > 0) {
          log.info(`[CrossLink] Linked ${Object.keys(linkedExtIds).length}/${matches.length} matches to existing records`);
        }
      }
    }
  }

  // Only insert matches that aren't already linked to existing ones
  const newMatches = matches.filter(m => !linkedExtIds[m.external_id]);

  // Upsert new matches
  if (newMatches.length > 0) {
    const { error: matchError } = await supabase.from('matches').upsert(newMatches, { onConflict: 'external_id' });
    if (matchError) {
      log.error('Error upserting matches', { error: matchError.message });
      return [];
    }
  }

  // Fetch match IDs for newly upserted matches
  const newExternalIds = newMatches.map((m) => m.external_id);
  const idMap = { ...linkedExtIds }; // Start with cross-linked ones

  if (newExternalIds.length > 0) {
    const { data: savedMatches, error: fetchError } = await supabase
      .from('matches')
      .select('id, external_id')
      .in('external_id', newExternalIds);

    if (fetchError) {
      log.error('Error fetching match IDs', { error: fetchError.message });
      return [];
    }
    for (const m of savedMatches) idMap[m.external_id] = m.id;
  }

  // Build savedMatches array for return (all matches with IDs)
  const savedMatches = Object.entries(idMap).map(([ext, id]) => ({ id, external_id: ext }));

  // Map external IDs to DB IDs and normalize handicap_point (NULL → 0)
  const oddsWithIds = oddsRows
    .filter((o) => idMap[o.match_external_id])
    .map(({ match_external_id, ...rest }) => ({
      ...rest,
      match_id: idMap[match_external_id],
      handicap_point: rest.handicap_point ?? 0,
      source_type: rest.source_type || 'international',
    }));

  // Upsert odds in batches (v2 schema uses composite unique with source_type)
  const BATCH_SIZE = 100;
  for (let i = 0; i < oddsWithIds.length; i += BATCH_SIZE) {
    const batch = oddsWithIds.slice(i, i + BATCH_SIZE);
    const { error: oddsError } = await supabase.from('odds').upsert(batch, {
      onConflict: 'match_id,bookmaker,market_type,handicap_point,source_type',
    });
    if (oddsError) {
      log.error('Error upserting odds batch', { error: oddsError.message });
    }
  }

  return savedMatches;
}

/**
 * Deactivate arbitrage opportunities for matches that have already started.
 * This runs every collection cycle to clean up stale entries.
 */
async function deactivateExpiredArbitrage() {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('arbitrage_opportunities')
    .update({ is_active: false })
    .eq('is_active', true)
    .lt('matches.start_time', now)
    .select('id');

  // Fallback: direct query if join filter doesn't work
  if (error) {
    // Get all active arbs, check match start_time
    const { data: activeArbs } = await supabase
      .from('arbitrage_opportunities')
      .select('id, match_id')
      .eq('is_active', true);

    if (activeArbs && activeArbs.length > 0) {
      const matchIds = [...new Set(activeArbs.map((a) => a.match_id))];
      const { data: pastMatches } = await supabase
        .from('matches')
        .select('id')
        .in('id', matchIds)
        .lt('start_time', now);

      if (pastMatches && pastMatches.length > 0) {
        const pastMatchIds = pastMatches.map((m) => m.id);
        const expiredArbIds = activeArbs
          .filter((a) => pastMatchIds.includes(a.match_id))
          .map((a) => a.id);

        if (expiredArbIds.length > 0) {
          await supabase
            .from('arbitrage_opportunities')
            .update({ is_active: false })
            .in('id', expiredArbIds);
          log.info(`Deactivated ${expiredArbIds.length} expired arbitrage opportunities`);
        }
      }
    }
  } else {
    const count = data ? data.length : 0;
    if (count > 0) log.info(`Deactivated ${count} expired arbitrage opportunities`);
  }
}

/**
 * Run arbitrage detection for all current matches across all market types.
 */
async function runArbitrageDetection(savedMatches) {
  if (!savedMatches.length) return [];

  // First, clean up any expired arbs from past matches
  await deactivateExpiredArbitrage();

  const matchIds = savedMatches.map((m) => m.id);
  const newOpportunities = [];

  // Fetch all matches with their odds — only future matches
  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .in('id', matchIds)
    .gte('start_time', new Date().toISOString());

  if (!matches) return [];

  // Mark old opportunities as inactive for these matches
  await supabase
    .from('arbitrage_opportunities')
    .update({ is_active: false })
    .in('match_id', matchIds)
    .eq('is_active', true);

  // Determine freshness threshold: betman odds older than 2× collection interval
  // are likely from a closed round and should be excluded from arb detection
  const STALE_MINUTES = Math.max(15, (INTERVAL_SECONDS / 60) * 2);
  const staleThreshold = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString();

  for (const match of matches) {
    const { data: oddsRecords } = await supabase.from('odds').select('*').eq('match_id', match.id);
    if (!oddsRecords || oddsRecords.length < 2) continue;

    // Filter out stale betman odds (likely from closed/expired rounds)
    const freshOdds = oddsRecords.filter((r) => {
      if (r.bookmaker === 'betman_proto' && r.updated_at < staleThreshold) return false;
      return true;
    });
    if (freshOdds.length < 2) continue;

    const opportunities = detectAllArbitrageForMatch(match, freshOdds);
    if (!opportunities || opportunities.length === 0) continue;

    for (const opp of opportunities) {
      // Save new opportunity
      const insertData = {
        match_id: opp.match_id,
        market_type: opp.market_type,
        handicap_point: opp.handicap_point || null,
        bookmaker_a: opp.bookmaker_a,
        bookmaker_b: opp.bookmaker_b,
        bookmaker_draw: opp.bookmaker_draw || null,
        odds_a: opp.odds_a,
        odds_b: opp.odds_b,
        odds_draw: opp.odds_draw || null,
        profit_percent: opp.profit_percent,
        arb_factor: opp.arb_factor,
        is_active: true,
      };

      const { error } = await supabase.from('arbitrage_opportunities').insert(insertData);

      if (!error) {
        const label = opp.market_type === 'h2h' ? 'H2H' :
          opp.market_type === 'spreads' ? `Spread ${opp.handicap_point}` :
          `Total ${opp.handicap_point}`;

        log.info(`Arbitrage [${label}]: ${match.home_team} vs ${match.away_team} | Profit: ${opp.profit_percent.toFixed(2)}%`);
        newOpportunities.push({ ...opp, match });
        await sendNotification('arbitrage', { opportunity: opp, match });
      }
    }
  }

  return newOpportunities;
}

/**
 * Track API usage in database.
 */
async function trackApiUsage(creditsUsed, note) {
  await supabase.from('api_usage').insert({
    credits_used: creditsUsed,
    note,
  });
}

/**
 * Collect from The Odds API (Pinnacle) — runs on separate long interval (default 4h).
 */
async function collectTheOddsApi(sports, markets) {
  const startTime = Date.now();
  log.info('[TheOddsAPI] Starting collection...');

  try {
    const { data: rawData, creditsUsed } = await fetchAllOdds(sports, markets);
    log.info(`[TheOddsAPI] Fetched ${rawData.length} events`, { creditsUsed });

    const { matches, oddsRows } = transformOddsData(rawData);
    const savedMatches = await saveToDatabase(matches, oddsRows);
    log.info(`[TheOddsAPI] Saved ${savedMatches.length} matches, ${oddsRows.length} odds rows`);

    // 배당 히스토리 스냅샷 저장
    try {
      const idMap = {};
      for (const m of savedMatches) idMap[m.external_id] = m.id;
      const snapshotRows = oddsRows
        .filter((o) => idMap[o.match_external_id])
        .map(({ match_external_id, ...rest }) => ({
          ...rest,
          match_id: idMap[match_external_id],
          handicap_point: rest.handicap_point ?? 0,
          source_type: rest.source_type || 'international',
        }));
      await saveOddsSnapshot(snapshotRows);
    } catch (snapErr) {
      log.warn('[TheOddsAPI] Snapshot error (non-fatal)', { error: snapErr.message });
    }

    // 양방 탐지
    const newOpps = await runArbitrageDetection(savedMatches);
    await trackApiUsage(creditsUsed, `[TheOddsAPI] ${matches.length} matches, ${oddsRows.length} odds, ${newOpps.length} arbs`);

    const duration = Date.now() - startTime;
    log.info(`[TheOddsAPI] Complete: ${matches.length} matches, ${oddsRows.length} odds, ${newOpps.length} arbs (${duration}ms)`);
    return { matches: savedMatches, creditsUsed };
  } catch (err) {
    log.error('[TheOddsAPI] Collection error', { error: err.message });
    try { require('../services/errorNotifier').notifyAdmin('error', 'TheOddsAPI 수집 실패', { error: err.message }); } catch {}
    return { matches: [], creditsUsed: 0 };
  }
}

/**
 * Main collection cycle (Pinnacle Direct + Betman + Stake).
 * The Odds API runs on a separate longer interval.
 */
async function collect(sports, markets) {
  const startTime = Date.now();
  log.info('Starting odds collection (Betman + Stake + Pinnacle Direct)...');

  try {
    let savedMatches = [];

    // ─── Pinnacle direct API ───
    let pinnacleMatchCount = 0;
    let pinnacleOddsCount = 0;
    if (isPinnacleConfigured()) {
      try {
        const pinnData = await collectPinnacle();
        if (pinnData.matches.length > 0) {
          // Upsert Pinnacle matches
          const { error: pmError } = await supabase
            .from('matches')
            .upsert(pinnData.matches, { onConflict: 'external_id' });
          if (pmError) log.error('Error upserting Pinnacle matches', { error: pmError.message });

          // Get match IDs
          const pinnExtIds = pinnData.matches.map((m) => m.external_id);
          const pinnIdMap = {};
          const PIN_BATCH = 50;
          for (let i = 0; i < pinnExtIds.length; i += PIN_BATCH) {
            const batch = pinnExtIds.slice(i, i + PIN_BATCH);
            const { data: pSaved } = await supabase
              .from('matches')
              .select('id, external_id')
              .in('external_id', batch);
            if (pSaved) for (const m of pSaved) pinnIdMap[m.external_id] = m.id;
          }

          // Map odds rows to match IDs
          const pinnOddsWithIds = pinnData.oddsRows
            .map(({ match_external_id, ...rest }) => ({
              ...rest,
              match_id: pinnIdMap[match_external_id],
              handicap_point: rest.handicap_point ?? 0,
            }))
            .filter((o) => o.match_id);

          // Upsert Pinnacle odds in batches
          for (let i = 0; i < pinnOddsWithIds.length; i += BATCH_SIZE) {
            const batch = pinnOddsWithIds.slice(i, i + BATCH_SIZE);
            const { error: poError } = await supabase.from('odds').upsert(batch, {
              onConflict: 'match_id,bookmaker,market_type,handicap_point,source_type',
            });
            if (poError) log.error('Error upserting Pinnacle odds', { error: poError.message });
          }

          pinnacleMatchCount = pinnData.matches.length;
          pinnacleOddsCount = pinnOddsWithIds.length;

          // Add to savedMatches for arb detection
          const existingIds = new Set(savedMatches.map((m) => m.id));
          for (const [eid, id] of Object.entries(pinnIdMap)) {
            if (!existingIds.has(id)) {
              savedMatches.push({ id, external_id: eid });
              existingIds.add(id);
            }
          }
        }
        log.info(`[Pinnacle] Saved ${pinnacleMatchCount} matches, ${pinnacleOddsCount} odds rows`);
      } catch (pinnErr) {
        log.warn('[Pinnacle] Collection error (non-fatal)', { error: pinnErr.message });
      }
    }

    // ─── Betman (domestic) scraping ───
    // Betman only scrapes on_sale rounds now (closed rounds are excluded).
    // Deactivate arbs involving betman_proto where betman odds are stale
    // (i.e. no longer refreshed because the round closed).
    let betmanMatchCount = 0;
    let betmanOddsCount = 0;
    try {
      const betmanData = await scrapeBetman();
      if (betmanData.matches.length > 0) {
        // Try to match domestic matches to international ones
        for (const bMatch of betmanData.matches) {
          const intlMatchId = await findMatchingInternationalMatch(bMatch);
          if (intlMatchId) {
            // Link domestic odds to existing international match
            for (const oddRow of betmanData.oddsRows) {
              if (oddRow.match_external_id === bMatch.external_id) {
                oddRow.match_external_id = `__linked_${intlMatchId}`;
                oddRow._linked_match_id = intlMatchId;
              }
            }
            // Don't insert duplicate match; remove from list
            bMatch._skip = true;
          }
        }

        // Save unmatched Betman matches
        const newBetmanMatches = betmanData.matches.filter((m) => !m._skip);
        if (newBetmanMatches.length > 0) {
          const { error: bmError } = await supabase
            .from('matches')
            .upsert(newBetmanMatches, { onConflict: 'external_id' });
          if (bmError) log.error('Error upserting Betman matches', { error: bmError.message });
        }

        // Get IDs for newly inserted Betman matches
        const betmanExtIds = newBetmanMatches.map((m) => m.external_id);
        let betmanIdMap = {};
        if (betmanExtIds.length > 0) {
          const { data: bSaved } = await supabase
            .from('matches')
            .select('id, external_id')
            .in('external_id', betmanExtIds);
          if (bSaved) {
            for (const m of bSaved) betmanIdMap[m.external_id] = m.id;
          }
        }

        // Prepare and upsert Betman odds
        const betmanOddsWithIds = betmanData.oddsRows
          .map(({ match_external_id, _linked_match_id, ...rest }) => {
            const matchId = _linked_match_id || betmanIdMap[match_external_id];
            if (!matchId) return null;
            return {
              ...rest,
              match_id: matchId,
              handicap_point: rest.handicap_point ?? 0,
              source_type: 'domestic',
            };
          })
          .filter(Boolean);

        for (let i = 0; i < betmanOddsWithIds.length; i += BATCH_SIZE) {
          const batch = betmanOddsWithIds.slice(i, i + BATCH_SIZE);
          const { error: boError } = await supabase.from('odds').upsert(batch, {
            onConflict: 'match_id,bookmaker,market_type,handicap_point,source_type',
          });
          if (boError) log.error('Error upserting Betman odds', { error: boError.message });
        }

        betmanMatchCount = betmanData.matches.length;
        betmanOddsCount = betmanOddsWithIds.length;

        // Add Betman matches to savedMatches for arb detection
        const allBetmanSaved = [
          ...Object.entries(betmanIdMap).map(([eid, id]) => ({ id, external_id: eid })),
          ...betmanData.oddsRows.filter((o) => o._linked_match_id).map((o) => ({ id: o._linked_match_id })),
        ];
        // Deduplicate
        const existingIds = new Set(savedMatches.map((m) => m.id));
        for (const bm of allBetmanSaved) {
          if (!existingIds.has(bm.id)) {
            savedMatches.push(bm);
            existingIds.add(bm.id);
          }
        }
      }
      log.info(`[Betman] Saved ${betmanMatchCount} matches, ${betmanOddsCount} odds rows`);
    } catch (betmanErr) {
      log.warn('[Betman] Collection error (non-fatal)', { error: betmanErr.message });
    }

    // ─── Stake.com odds scraping ───
    let stakeMatchCount = 0;
    let stakeOddsCount = 0;
    try {
      const stakeData = await scrapeStake();
      if (stakeData.matches.length > 0) {
        // ── Match Stake fixtures to existing international matches ──
        // Stake uses SportRadar IDs like "sr:match:61061505"
        // OddsAPI uses "oddsapiio_61061505" — same numeric ID!
        // Try to link Stake odds to existing matches instead of creating duplicates.
        const stakeIdToExistingMatch = {}; // stake external_id → existing match DB id

        // Extract numeric SportRadar IDs from Stake matches
        const srNumericIds = [];
        const srIdToStakeExt = {}; // numeric → stake external_id
        for (const m of stakeData.matches) {
          const numericMatch = m.external_id.match(/sr:match:(\d+)/);
          if (numericMatch) {
            const numId = numericMatch[1];
            srNumericIds.push(numId);
            srIdToStakeExt[numId] = m.external_id;
          }
        }

        // Look for existing matches with oddsapiio_ prefix containing these IDs
        if (srNumericIds.length > 0) {
          const oddsApiExtIds = srNumericIds.map((id) => `oddsapiio_${id}`);
          const STAKE_BATCH = 50;
          for (let i = 0; i < oddsApiExtIds.length; i += STAKE_BATCH) {
            const batch = oddsApiExtIds.slice(i, i + STAKE_BATCH);
            const { data: existing } = await supabase
              .from('matches')
              .select('id, external_id')
              .in('external_id', batch);
            if (existing) {
              for (const ex of existing) {
                const numId = ex.external_id.replace('oddsapiio_', '');
                const stakeExtId = srIdToStakeExt[numId];
                if (stakeExtId) {
                  stakeIdToExistingMatch[stakeExtId] = ex.id;
                }
              }
            }
          }
        }

        const linkedCount = Object.keys(stakeIdToExistingMatch).length;
        log.info(`[Stake] Linked ${linkedCount}/${stakeData.matches.length} matches to existing international matches`);

        // Fallback: team name + time matching for unlinked Stake matches (links to Betman/other domestic)
        const unlinkedStake = stakeData.matches.filter((m) => !stakeIdToExistingMatch[m.external_id]);
        if (unlinkedStake.length > 0) {
          const stTimes = unlinkedStake.map(m => new Date(m.start_time).getTime()).filter(t => !isNaN(t));
          if (stTimes.length > 0) {
            const stMin = new Date(Math.min(...stTimes) - 2 * 60 * 60 * 1000).toISOString();
            const stMax = new Date(Math.max(...stTimes) + 2 * 60 * 60 * 1000).toISOString();
            const { data: existingForStake } = await supabase
              .from('matches')
              .select('id, external_id, home_team, away_team, start_time')
              .gte('start_time', stMin)
              .lte('start_time', stMax);

            if (existingForStake && existingForStake.length > 0) {
              const stLookup = {};
              for (const em of existingForStake) {
                const h = normalizeTeam(em.home_team);
                const a = normalizeTeam(em.away_team);
                const t = new Date(em.start_time).toISOString().slice(0, 13);
                stLookup[`${h}|${a}|${t}`] = em;
              }
              let stLinked = 0;
              for (const m of unlinkedStake) {
                const h = normalizeTeam(m.home_team);
                const a = normalizeTeam(m.away_team);
                const t = new Date(m.start_time).toISOString().slice(0, 13);
                const existing = stLookup[`${h}|${a}|${t}`];
                if (existing && existing.external_id !== m.external_id) {
                  stakeIdToExistingMatch[m.external_id] = existing.id;
                  stLinked++;
                }
              }
              if (stLinked > 0) log.info(`[Stake] Cross-linked ${stLinked} additional matches by team+time`);
            }
          }
        }

        // Only insert unmatched Stake matches
        const newStakeMatches = stakeData.matches.filter((m) => !stakeIdToExistingMatch[m.external_id]);
        if (newStakeMatches.length > 0) {
          const { error: smError } = await supabase
            .from('matches')
            .upsert(newStakeMatches, { onConflict: 'external_id' });
          if (smError) log.error('Error upserting Stake matches', { error: smError.message });
        }

        // Get IDs for newly inserted Stake matches
        const stakeIdMap = { ...stakeIdToExistingMatch }; // start with linked ones
        const newStakeExtIds = newStakeMatches.map((m) => m.external_id);
        if (newStakeExtIds.length > 0) {
          const STAKE_BATCH2 = 50;
          for (let i = 0; i < newStakeExtIds.length; i += STAKE_BATCH2) {
            const batch = newStakeExtIds.slice(i, i + STAKE_BATCH2);
            const { data: sSaved } = await supabase
              .from('matches')
              .select('id, external_id')
              .in('external_id', batch);
            if (sSaved) for (const m of sSaved) stakeIdMap[m.external_id] = m.id;
          }
        }

        // Map odds rows to match IDs (linked or new)
        const stakeOddsWithIds = stakeData.oddsRows
          .map(({ match_external_id, ...rest }) => ({
            ...rest,
            match_id: stakeIdMap[match_external_id],
            handicap_point: rest.handicap_point ?? 0,
          }))
          .filter((o) => o.match_id);

        // Upsert Stake odds in batches
        for (let i = 0; i < stakeOddsWithIds.length; i += BATCH_SIZE) {
          const batch = stakeOddsWithIds.slice(i, i + BATCH_SIZE);
          const { error: soError } = await supabase.from('odds').upsert(batch, {
            onConflict: 'match_id,bookmaker,market_type,handicap_point,source_type',
          });
          if (soError) log.error('Error upserting Stake odds', { error: soError.message });
        }

        stakeMatchCount = stakeData.matches.length;
        stakeOddsCount = stakeOddsWithIds.length;

        // Add Stake matches to savedMatches for arb detection
        const existingIds2 = new Set(savedMatches.map((m) => m.id));
        for (const [eid, id] of Object.entries(stakeIdMap)) {
          if (!existingIds2.has(id)) {
            savedMatches.push({ id, external_id: eid });
            existingIds2.add(id);
          }
        }
      }
      log.info(`[Stake] Saved ${stakeMatchCount} matches, ${stakeOddsCount} odds rows`);
    } catch (stakeErr) {
      log.warn('[Stake] Collection error (non-fatal)', { error: stakeErr.message });
    }

    const newOpps = await runArbitrageDetection(savedMatches);
    log.info(`Found ${newOpps.length} new arbitrage opportunities`);

    // AI 예측 생성/갱신
    try {
      await generatePredictions();
    } catch (predErr) {
      log.warn('AI prediction error (non-fatal)', { error: predErr.message });
    }

    lastCollectionResult = {
      success: true,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      matchesUpdated: savedMatches.length,
      arbitrageFound: newOpps.length,
      pinnacle: { matches: pinnacleMatchCount, oddsRows: pinnacleOddsCount },
      domestic: { matches: betmanMatchCount, oddsRows: betmanOddsCount },
      stake: { matches: stakeMatchCount, oddsRows: stakeOddsCount },
    };

    log.info('Collection cycle complete', { duration: Date.now() - startTime });
    return lastCollectionResult;
  } catch (err) {
    log.error('Collection error', { error: err.message, stack: err.stack });
    try { require('../services/errorNotifier').notifyAdmin('error', '수집 사이클 실패', { error: err.message }); } catch {}
    lastCollectionResult = {
      success: false,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: err.message,
    };
    return lastCollectionResult;
  }
}

/**
 * Standalone Odds-API.io collection cycle.
 * Runs independently from the main collector on its own schedule (default: 20 min).
 */
async function collectOddsApiIoAndSave() {
  if (!isOddsApiIoConfigured()) {
    log.info('[Odds-API.io Scheduler] Not configured, skipping');
    return null;
  }

  const startTime = Date.now();
  log.info('[Odds-API.io Scheduler] Starting collection...');

  try {
    const oaioData = await collectOddsApiIo();

    if (!oaioData || oaioData.skipped || oaioData.matches.length === 0) {
      lastOddsApiIoResult = {
        success: true,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        matches: 0,
        oddsRows: 0,
        arbitrageFound: 0,
      };
      log.info('[Odds-API.io Scheduler] No data to process');
      return lastOddsApiIoResult;
    }

    // Upsert matches
    const { error: mErr } = await supabase
      .from('matches')
      .upsert(oaioData.matches, { onConflict: 'external_id' });
    if (mErr) log.error('[Odds-API.io] Error upserting matches', { error: mErr.message });

    // Get match IDs in batches
    const extIds = oaioData.matches.map((m) => m.external_id);
    const idMap = {};
    const ID_BATCH = 50;
    for (let i = 0; i < extIds.length; i += ID_BATCH) {
      const batch = extIds.slice(i, i + ID_BATCH);
      const { data: saved } = await supabase
        .from('matches')
        .select('id, external_id')
        .in('external_id', batch);
      if (saved) for (const m of saved) idMap[m.external_id] = m.id;
    }

    // Map odds rows to match IDs
    const oddsWithIds = oaioData.oddsRows
      .map(({ match_external_id, ...rest }) => ({
        ...rest,
        match_id: idMap[match_external_id],
        handicap_point: rest.handicap_point ?? 0,
      }))
      .filter((o) => o.match_id);

    // Upsert odds in batches
    for (let i = 0; i < oddsWithIds.length; i += BATCH_SIZE) {
      const batch = oddsWithIds.slice(i, i + BATCH_SIZE);
      const { error: oErr } = await supabase.from('odds').upsert(batch, {
        onConflict: 'match_id,bookmaker,market_type,handicap_point,source_type',
      });
      if (oErr) log.error('[Odds-API.io] Error upserting odds', { error: oErr.message });
    }

    // 배당 히스토리 스냅샷 저장
    try {
      await saveOddsSnapshot(oddsWithIds);
    } catch (snapErr) {
      log.warn('[Odds-API.io] Snapshot error (non-fatal)', { error: snapErr.message });
    }

    // Run arbitrage detection for affected matches
    const savedMatches = Object.entries(idMap).map(([eid, id]) => ({ id, external_id: eid }));
    const newOpps = await runArbitrageDetection(savedMatches);

    // AI 예측 갱신
    try {
      await generatePredictions();
    } catch (predErr) {
      log.warn('[Odds-API.io] AI prediction error (non-fatal)', { error: predErr.message });
    }

    const duration = Date.now() - startTime;
    lastOddsApiIoResult = {
      success: true,
      timestamp: new Date().toISOString(),
      duration,
      matches: oaioData.matches.length,
      oddsRows: oddsWithIds.length,
      arbitrageFound: newOpps.length,
    };

    log.info(
      `[Odds-API.io Scheduler] Complete: ${oaioData.matches.length} matches, ${oddsWithIds.length} odds, ${newOpps.length} arbs (${duration}ms)`,
    );
    return lastOddsApiIoResult;
  } catch (err) {
    log.error('[Odds-API.io Scheduler] Error', { error: err.message, stack: err.stack });
    lastOddsApiIoResult = {
      success: false,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: err.message,
    };
    return lastOddsApiIoResult;
  }
}

/**
 * Start the independent Odds-API.io scheduler.
 * Default: every 20 minutes (configurable via ODDS_API_IO_INTERVAL env var).
 */
function startOddsApiIoScheduler() {
  if (!isOddsApiIoConfigured()) {
    log.info('[Odds-API.io Scheduler] Not configured (ODDS_API_IO_KEY missing), scheduler disabled');
    return;
  }
  if (oddsApiIoSchedulerRunning) {
    log.warn('[Odds-API.io Scheduler] Already running, skipping duplicate start');
    return;
  }

  oddsApiIoSchedulerRunning = true;
  const minutes = Math.max(1, ODDS_API_IO_INTERVAL_MIN);
  const cronExpression = `*/${minutes} * * * *`;

  // Run once immediately on start
  collectOddsApiIoAndSave();

  cron.schedule(cronExpression, () => collectOddsApiIoAndSave());
  log.info(`[Odds-API.io Scheduler] Started — running every ${minutes} minutes`);
}

// Only auto-run when executed directly (not when imported as module)
if (require.main === module) {
  // Run immediately on start
  collect();
  collectTheOddsApi(); // Initial The Odds API fetch

  // Schedule recurring collection (Pinnacle Direct + Betman + Stake)
  if (INTERVAL_SECONDS >= 60) {
    const minutes = Math.floor(INTERVAL_SECONDS / 60);
    const cronExpression = `*/${minutes} * * * *`;
    cron.schedule(cronExpression, () => collect());
    log.info(`Main collector started. Running every ${minutes} minutes.`);
  } else {
    const cronExpression = `*/${Math.max(1, INTERVAL_SECONDS)} * * * * *`;
    cron.schedule(cronExpression, () => collect());
    log.info(`Main collector started. Running every ${INTERVAL_SECONDS} seconds.`);
  }

  // The Odds API on separate long interval (default 4 hours)
  if (ODDS_API_INTERVAL_MIN > 0) {
    const oaCron = ODDS_API_INTERVAL_MIN >= 60
      ? `0 */${Math.floor(ODDS_API_INTERVAL_MIN / 60)} * * *`   // hourly+ → "0 */4 * * *"
      : `*/${ODDS_API_INTERVAL_MIN} * * * *`;                     // < 1h → "*/30 * * * *"
    cron.schedule(oaCron, () => collectTheOddsApi());
    log.info(`[TheOddsAPI] Scheduler started. Running every ${ODDS_API_INTERVAL_MIN} minutes.`);
  }

  // Start Odds-API.io on separate schedule
  startOddsApiIoScheduler();
}

module.exports = {
  collect,
  collectTheOddsApi,
  getLastResult,
  transformOddsData,
  collectOddsApiIoAndSave,
  startOddsApiIoScheduler,
  getLastOddsApiIoResult,
};
