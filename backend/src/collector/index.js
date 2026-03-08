const cron = require('node-cron');
const supabase = require('../config/supabase');
const { fetchAllOdds, getQuotaInfo } = require('./oddsApi');
const { detectAllArbitrageForMatch } = require('../services/arbitrageEngine');
const { sendArbitrageAlert } = require('../services/telegramBot');
require('dotenv').config();

const INTERVAL_SECONDS = parseInt(process.env.COLLECTOR_INTERVAL || '300', 10);

// Track last collection result for status reporting
let lastCollectionResult = null;

function getLastResult() {
  return lastCollectionResult;
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
            });
          }
        }
      }
    }
  }

  return { matches, oddsRows };
}

/**
 * Upsert matches and odds into Supabase (v2 schema).
 */
async function saveToDatabase(matches, oddsRows) {
  // Upsert matches
  const { error: matchError } = await supabase.from('matches').upsert(matches, { onConflict: 'external_id' });
  if (matchError) {
    console.error('Error upserting matches:', matchError.message);
    return [];
  }

  // Fetch match IDs
  const externalIds = matches.map((m) => m.external_id);
  const { data: savedMatches, error: fetchError } = await supabase
    .from('matches')
    .select('id, external_id')
    .in('external_id', externalIds);

  if (fetchError) {
    console.error('Error fetching match IDs:', fetchError.message);
    return [];
  }

  const idMap = {};
  for (const m of savedMatches) idMap[m.external_id] = m.id;

  // Map external IDs to DB IDs and clean up
  const oddsWithIds = oddsRows
    .filter((o) => idMap[o.match_external_id])
    .map(({ match_external_id, ...rest }) => ({
      ...rest,
      match_id: idMap[match_external_id],
    }));

  // Upsert odds in batches (v2 schema uses composite unique)
  const BATCH_SIZE = 100;
  for (let i = 0; i < oddsWithIds.length; i += BATCH_SIZE) {
    const batch = oddsWithIds.slice(i, i + BATCH_SIZE);
    const { error: oddsError } = await supabase.from('odds').upsert(batch, {
      onConflict: 'match_id,bookmaker,market_type,COALESCE(handicap_point, 0)',
    });
    if (oddsError) {
      console.error('Error upserting odds batch:', oddsError.message);
    }
  }

  return savedMatches;
}

/**
 * Run arbitrage detection for all current matches across all market types.
 */
async function runArbitrageDetection(savedMatches) {
  if (!savedMatches.length) return [];

  const matchIds = savedMatches.map((m) => m.id);
  const newOpportunities = [];

  // Fetch all matches with their odds
  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .in('id', matchIds)
    .gte('start_time', new Date().toISOString());

  if (!matches) return [];

  // Mark old opportunities as inactive
  await supabase
    .from('arbitrage_opportunities')
    .update({ is_active: false })
    .in('match_id', matchIds)
    .eq('is_active', true);

  for (const match of matches) {
    const { data: oddsRecords } = await supabase.from('odds').select('*').eq('match_id', match.id);
    if (!oddsRecords || oddsRecords.length < 2) continue;

    const opportunities = detectAllArbitrageForMatch(match, oddsRecords);
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

        console.log(
          `Arbitrage [${label}]: ${match.home_team} vs ${match.away_team} | Profit: ${opp.profit_percent.toFixed(2)}%`
        );
        newOpportunities.push({ ...opp, match });
        await sendArbitrageAlert(opp, match);
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
 * Main collection cycle.
 */
async function collect(sports, markets) {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Starting odds collection...`);

  try {
    const { data: rawData, creditsUsed } = await fetchAllOdds(sports, markets);
    console.log(`Fetched ${rawData.length} events (${creditsUsed} credits used)`);

    const { matches, oddsRows } = transformOddsData(rawData);
    const savedMatches = await saveToDatabase(matches, oddsRows);
    console.log(`Saved ${savedMatches.length} matches, ${oddsRows.length} odds rows`);

    const newOpps = await runArbitrageDetection(savedMatches);
    console.log(`Found ${newOpps.length} new arbitrage opportunities`);

    await trackApiUsage(creditsUsed, `Collected ${matches.length} matches`);

    lastCollectionResult = {
      success: true,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      matchesUpdated: savedMatches.length,
      oddsRows: oddsRows.length,
      arbitrageFound: newOpps.length,
      creditsUsed,
      quota: getQuotaInfo(),
    };

    console.log('Collection cycle complete.');
    return lastCollectionResult;
  } catch (err) {
    console.error('Collection error:', err.message);
    lastCollectionResult = {
      success: false,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      error: err.message,
    };
    return lastCollectionResult;
  }
}

// Only auto-run when executed directly (not when imported as module)
if (require.main === module) {
  // Run immediately on start
  collect();

  // Schedule recurring collection
  if (INTERVAL_SECONDS >= 60) {
    const minutes = Math.floor(INTERVAL_SECONDS / 60);
    const cronExpression = `*/${minutes} * * * *`;
    cron.schedule(cronExpression, () => collect());
    console.log(`Odds collector started. Running every ${minutes} minutes.`);
  } else {
    const cronExpression = `*/${Math.max(1, INTERVAL_SECONDS)} * * * * *`;
    cron.schedule(cronExpression, () => collect());
    console.log(`Odds collector started. Running every ${INTERVAL_SECONDS} seconds.`);
  }
}

module.exports = { collect, getLastResult, transformOddsData };
