const cron = require('node-cron');
const supabase = require('../config/supabase');
const { fetchAllOdds } = require('./oddsApi');
const { detectArbitrageForMatch } = require('../services/arbitrageEngine');
const { sendArbitrageAlert } = require('../services/telegramBot');
require('dotenv').config();

const INTERVAL_SECONDS = parseInt(process.env.COLLECTOR_INTERVAL || '60', 10);

/**
 * Transform raw odds API data into DB-ready rows.
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
      const h2hMarket = bookmaker.markets.find((m) => m.key === 'h2h');
      if (!h2hMarket) continue;

      const outcomes = h2hMarket.outcomes;
      const homeOutcome = outcomes.find((o) => o.name === event.home_team);
      const awayOutcome = outcomes.find((o) => o.name === event.away_team);
      const drawOutcome = outcomes.find((o) => o.name === 'Draw');

      oddsRows.push({
        match_external_id: event.id,
        bookmaker: bookmaker.key,
        bookmaker_title: bookmaker.title,
        market_type: 'h2h',
        home_odds: homeOutcome?.price || null,
        draw_odds: drawOutcome?.price || null,
        away_odds: awayOutcome?.price || null,
      });
    }
  }

  return { matches, oddsRows };
}

/**
 * Upsert matches and odds into Supabase.
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

  // Map external IDs to DB IDs in odds rows
  const oddsWithIds = oddsRows
    .filter((o) => idMap[o.match_external_id])
    .map((o) => ({ ...o, match_id: idMap[o.match_external_id], match_external_id: undefined }));

  // Upsert odds (replace by match_id + bookmaker)
  const { error: oddsError } = await supabase
    .from('odds')
    .upsert(oddsWithIds, { onConflict: 'match_id,bookmaker' });

  if (oddsError) {
    console.error('Error upserting odds:', oddsError.message);
  }

  return savedMatches;
}

/**
 * Run arbitrage detection for all current matches.
 */
async function runArbitrageDetection(savedMatches) {
  if (!savedMatches.length) return;

  const matchIds = savedMatches.map((m) => m.id);

  // Fetch all matches with their odds
  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .in('id', matchIds)
    .gte('start_time', new Date().toISOString());

  if (!matches) return;

  for (const match of matches) {
    const { data: oddsRecords } = await supabase.from('odds').select('*').eq('match_id', match.id);

    if (!oddsRecords || oddsRecords.length < 2) continue;

    const opportunity = detectArbitrageForMatch(match, oddsRecords);
    if (!opportunity) continue;

    // Check if we already have this opportunity recently (within 5 minutes)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from('arbitrage_opportunities')
      .select('id')
      .eq('match_id', match.id)
      .gte('detected_at', fiveMinAgo)
      .limit(1);

    if (existing && existing.length > 0) continue;

    // Save new opportunity
    const { error } = await supabase.from('arbitrage_opportunities').insert({
      match_id: opportunity.match_id,
      market_type: opportunity.market_type,
      bookmaker_a: opportunity.bookmaker_home,
      bookmaker_b: opportunity.bookmaker_away,
      bookmaker_draw: opportunity.bookmaker_draw || null,
      odds_a: opportunity.odds_home,
      odds_b: opportunity.odds_away,
      odds_draw: opportunity.odds_draw || null,
      profit_percent: opportunity.profit_percent,
      arb_factor: opportunity.arb_factor,
    });

    if (!error) {
      console.log(
        `Arbitrage found: ${match.home_team} vs ${match.away_team} | Profit: ${opportunity.profit_percent.toFixed(2)}%`
      );
      await sendArbitrageAlert(opportunity, match);
    }
  }
}

/**
 * Main collection cycle.
 */
async function collect() {
  console.log(`[${new Date().toISOString()}] Starting odds collection...`);
  try {
    const rawData = await fetchAllOdds();
    console.log(`Fetched ${rawData.length} events`);

    const { matches, oddsRows } = transformOddsData(rawData);
    const savedMatches = await saveToDatabase(matches, oddsRows);
    console.log(`Saved ${savedMatches.length} matches, ${oddsRows.length} odds rows`);

    await runArbitrageDetection(savedMatches);
    console.log('Collection cycle complete.');
  } catch (err) {
    console.error('Collection error:', err.message);
  }
}

// Run immediately on start
collect();

// Schedule recurring collection
const cronExpression = `*/${Math.max(1, INTERVAL_SECONDS)} * * * * *`;
cron.schedule(cronExpression, collect);

console.log(`Odds collector started. Running every ${INTERVAL_SECONDS} seconds.`);
