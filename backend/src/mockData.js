/**
 * Mock data for development/preview without Supabase
 */

const crypto = require('crypto');
const uid = () => crypto.randomUUID();

// Generate future times for matches
function futureTime(hoursFromNow) {
  const d = new Date();
  d.setHours(d.getHours() + hoursFromNow);
  return d.toISOString();
}

const BOOKMAKERS = [
  { key: 'pinnacle', title: 'Pinnacle' },
  { key: 'bet365', title: 'Bet365' },
  { key: 'williamhill', title: 'William Hill' },
  { key: 'unibet', title: 'Unibet' },
  { key: 'betfair', title: 'Betfair' },
  { key: 'draftkings', title: 'DraftKings' },
  { key: 'fanduel', title: 'FanDuel' },
  { key: 'betmgm', title: 'BetMGM' },
  { key: 'bwin', title: 'bwin' },
  { key: '1xbet', title: '1xBet' },
];

const MATCHES = [
  { id: uid(), external_id: 'mock_1', sport: 'soccer_epl', league: 'English Premier League', home_team: 'Arsenal', away_team: 'Chelsea', start_time: futureTime(3), created_at: new Date().toISOString() },
  { id: uid(), external_id: 'mock_2', sport: 'soccer_epl', league: 'English Premier League', home_team: 'Liverpool', away_team: 'Man City', start_time: futureTime(5), created_at: new Date().toISOString() },
  { id: uid(), external_id: 'mock_3', sport: 'soccer_spain_la_liga', league: 'La Liga', home_team: 'Real Madrid', away_team: 'Barcelona', start_time: futureTime(8), created_at: new Date().toISOString() },
  { id: uid(), external_id: 'mock_4', sport: 'basketball_nba', league: 'NBA', home_team: 'Lakers', away_team: 'Celtics', start_time: futureTime(2), created_at: new Date().toISOString() },
  { id: uid(), external_id: 'mock_5', sport: 'basketball_nba', league: 'NBA', home_team: 'Warriors', away_team: 'Nuggets', start_time: futureTime(4), created_at: new Date().toISOString() },
  { id: uid(), external_id: 'mock_6', sport: 'baseball_mlb', league: 'MLB', home_team: 'Yankees', away_team: 'Red Sox', start_time: futureTime(6), created_at: new Date().toISOString() },
  { id: uid(), external_id: 'mock_7', sport: 'icehockey_nhl', league: 'NHL', home_team: 'Maple Leafs', away_team: 'Canadiens', start_time: futureTime(7), created_at: new Date().toISOString() },
  { id: uid(), external_id: 'mock_8', sport: 'soccer_epl', league: 'UEFA Champions League', home_team: 'Bayern Munich', away_team: 'PSG', start_time: futureTime(10), created_at: new Date().toISOString() },
  { id: uid(), external_id: 'mock_9', sport: 'basketball_nba', league: 'NBA Summer', home_team: 'Knicks', away_team: 'Nets', start_time: futureTime(12), created_at: new Date().toISOString() },
  { id: uid(), external_id: 'mock_10', sport: 'soccer_epl', league: 'English Premier League', home_team: 'Man United', away_team: 'Tottenham', start_time: futureTime(9), created_at: new Date().toISOString() },
  { id: uid(), external_id: 'mock_11', sport: 'basketball_nba', league: 'NBA', home_team: 'Bucks', away_team: 'Heat', start_time: futureTime(3.5), created_at: new Date().toISOString() },
  { id: uid(), external_id: 'mock_12', sport: 'soccer_germany_bundesliga', league: 'Bundesliga', home_team: 'Dortmund', away_team: 'Leverkusen', start_time: futureTime(11), created_at: new Date().toISOString() },
];

// Random odds generator
function rOdds(base, variance = 0.3) {
  return Math.round((base + (Math.random() - 0.5) * variance) * 100) / 100;
}

function generateOddsForMatch(match) {
  const odds = [];
  const isSoccer = match.sport.startsWith('soccer');
  const bookmakers = BOOKMAKERS.slice(0, 5 + Math.floor(Math.random() * 5));
  const now = new Date().toISOString();

  // H2H odds
  for (const bk of bookmakers) {
    const o = {
      id: uid(),
      match_id: match.id,
      bookmaker: bk.key,
      bookmaker_title: bk.title,
      market_type: 'h2h',
      handicap_point: null,
      outcome_1_odds: rOdds(2.1),
      outcome_2_odds: rOdds(2.8),
      outcome_draw_odds: isSoccer ? rOdds(3.3) : null,
      updated_at: now,
    };
    odds.push(o);
  }

  // Spreads odds
  const points = isSoccer ? [-0.5, -1.5] : [-3.5, -5.5, -7.5];
  for (const pt of points) {
    for (const bk of bookmakers.slice(0, 4)) {
      odds.push({
        id: uid(),
        match_id: match.id,
        bookmaker: bk.key,
        bookmaker_title: bk.title,
        market_type: 'spreads',
        handicap_point: pt,
        outcome_1_odds: rOdds(1.91, 0.15),
        outcome_2_odds: rOdds(1.91, 0.15),
        outcome_draw_odds: null,
        updated_at: now,
      });
    }
  }

  // Totals odds
  const totals = isSoccer ? [2.5, 3.5] : [210.5, 220.5];
  for (const t of totals) {
    for (const bk of bookmakers.slice(0, 4)) {
      odds.push({
        id: uid(),
        match_id: match.id,
        bookmaker: bk.key,
        bookmaker_title: bk.title,
        market_type: 'totals',
        handicap_point: t,
        outcome_1_odds: rOdds(1.91, 0.15),
        outcome_2_odds: rOdds(1.91, 0.15),
        outcome_draw_odds: null,
        updated_at: now,
      });
    }
  }

  return odds;
}

function findArbitrageInOdds(odds, match) {
  const arbs = [];
  // Group by market_type + handicap_point
  const groups = {};
  for (const o of odds) {
    const key = `${o.market_type}|${o.handicap_point ?? 'null'}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(o);
  }

  for (const [key, group] of Object.entries(groups)) {
    const [mType, hpStr] = key.split('|');
    const hp = hpStr === 'null' ? null : parseFloat(hpStr);
    const is3way = mType === 'h2h' && group.some((o) => o.outcome_draw_odds);

    // Find best odds
    let best1 = null, best2 = null, bestD = null;
    for (const o of group) {
      if (o.outcome_1_odds && (!best1 || o.outcome_1_odds > best1.odds)) {
        best1 = { odds: o.outcome_1_odds, bookmaker: o.bookmaker };
      }
      if (o.outcome_2_odds && (!best2 || o.outcome_2_odds > best2.odds)) {
        best2 = { odds: o.outcome_2_odds, bookmaker: o.bookmaker };
      }
      if (o.outcome_draw_odds && (!bestD || o.outcome_draw_odds > bestD.odds)) {
        bestD = { odds: o.outcome_draw_odds, bookmaker: o.bookmaker };
      }
    }

    if (!best1 || !best2) continue;

    let arbFactor;
    if (is3way && bestD) {
      arbFactor = 1 / best1.odds + 1 / best2.odds + 1 / bestD.odds;
    } else {
      arbFactor = 1 / best1.odds + 1 / best2.odds;
    }

    if (arbFactor < 1) {
      arbs.push({
        id: uid(),
        match_id: match.id,
        market_type: mType,
        handicap_point: hp,
        bookmaker_a: best1.bookmaker,
        bookmaker_b: best2.bookmaker,
        bookmaker_draw: is3way && bestD ? bestD.bookmaker : null,
        odds_a: best1.odds,
        odds_b: best2.odds,
        odds_draw: is3way && bestD ? bestD.odds : null,
        profit_percent: (1 - arbFactor) * 100,
        arb_factor: arbFactor,
        detected_at: new Date().toISOString(),
        is_active: true,
      });
    }
  }

  return arbs;
}

// Inject guaranteed arbitrage opportunities by tweaking odds
function injectArbitrage(allMatchOdds) {
  const matchIds = [...new Set(allMatchOdds.map((o) => o.match_id))];

  // Match 0 (Arsenal vs Chelsea - soccer 3-way): H2H arb
  {
    const mid = matchIds[0];
    const h2h = allMatchOdds.filter((o) => o.match_id === mid && o.market_type === 'h2h');
    if (h2h.length >= 3) {
      h2h[0].outcome_1_odds = 2.55;  // Pinnacle: high home
      h2h[1].outcome_2_odds = 3.10;  // Bet365: high away
      h2h[2].outcome_draw_odds = 3.95; // WH: high draw
      // arb = 1/2.55 + 1/3.10 + 1/3.95 = 0.3922 + 0.3226 + 0.2532 = 0.9680 → +3.31%
    }
  }

  // Match 1 (Liverpool vs Man City - soccer 3-way): H2H arb
  {
    const mid = matchIds[1];
    const h2h = allMatchOdds.filter((o) => o.match_id === mid && o.market_type === 'h2h');
    if (h2h.length >= 3) {
      h2h[0].outcome_1_odds = 3.20;  // high home
      h2h[1].outcome_2_odds = 2.65;  // high away
      h2h[2].outcome_draw_odds = 4.30; // high draw
      // arb = 1/3.20 + 1/2.65 + 1/4.30 = 0.3125 + 0.3774 + 0.2326 = 0.9224 → +7.76%
    }
  }

  // Match 3 (Lakers vs Celtics - NBA 2-way): H2H arb
  {
    const mid = matchIds[3];
    const h2h = allMatchOdds.filter((o) => o.match_id === mid && o.market_type === 'h2h');
    if (h2h.length >= 2) {
      h2h[0].outcome_1_odds = 2.15;  // high home
      h2h[1].outcome_2_odds = 2.10;  // high away
      // arb = 1/2.15 + 1/2.10 = 0.4651 + 0.4762 = 0.9413 → +5.87%
    }
  }

  // Match 4 (Warriors vs Nuggets - NBA): Spread arb at -3.5
  {
    const mid = matchIds[4];
    const spread = allMatchOdds.filter(
      (o) => o.match_id === mid && o.market_type === 'spreads' && o.handicap_point === -3.5
    );
    if (spread.length >= 2) {
      spread[0].outcome_1_odds = 2.08;
      spread[1].outcome_2_odds = 2.05;
      // arb = 1/2.08 + 1/2.05 = 0.4808 + 0.4878 = 0.9686 → +3.14%
    }
  }

  // Match 5 (Yankees vs Red Sox): Totals arb at first total line
  {
    const mid = matchIds[5];
    const totals = allMatchOdds.filter(
      (o) => o.match_id === mid && o.market_type === 'totals'
    );
    const pts = [...new Set(totals.map((o) => o.handicap_point))];
    if (pts.length > 0) {
      const target = totals.filter((o) => o.handicap_point === pts[0]);
      if (target.length >= 2) {
        target[0].outcome_1_odds = 2.12;
        target[1].outcome_2_odds = 2.05;
        // arb = 1/2.12 + 1/2.05 = 0.4717 + 0.4878 = 0.9595 → +4.05%
      }
    }
  }

  // Match 0 (Arsenal vs Chelsea): Spread arb at -0.5
  {
    const mid = matchIds[0];
    const spread = allMatchOdds.filter(
      (o) => o.match_id === mid && o.market_type === 'spreads' && o.handicap_point === -0.5
    );
    if (spread.length >= 2) {
      spread[0].outcome_1_odds = 2.15;
      spread[1].outcome_2_odds = 2.10;
      // arb = 1/2.15 + 1/2.10 = 0.4651 + 0.4762 = 0.9413 → +5.87%
    }
  }

  // Match 2 (Real Madrid vs Barcelona - soccer 3-way): H2H arb
  {
    const mid = matchIds[2];
    const h2h = allMatchOdds.filter((o) => o.match_id === mid && o.market_type === 'h2h');
    if (h2h.length >= 3) {
      h2h[0].outcome_1_odds = 2.70;
      h2h[1].outcome_2_odds = 2.85;
      h2h[2].outcome_draw_odds = 4.50;
      // arb = 1/2.70 + 1/2.85 + 1/4.50 = 0.3704 + 0.3509 + 0.2222 = 0.9434 → +5.66%
    }
  }
}

function generateMockData() {
  const allOdds = [];
  const allArbs = [];

  for (const match of MATCHES) {
    const odds = generateOddsForMatch(match);
    allOdds.push(...odds);
  }

  // Inject arb opportunities
  injectArbitrage(allOdds);

  // Detect arbs
  for (const match of MATCHES) {
    const matchOdds = allOdds.filter((o) => o.match_id === match.id);
    const arbs = findArbitrageInOdds(matchOdds, match);
    allArbs.push(...arbs);
  }

  // Build MatchWithOdds
  const matchesWithOdds = MATCHES.map((match) => ({
    ...match,
    odds: allOdds.filter((o) => o.match_id === match.id),
    arbitrage_opportunities: allArbs.filter((a) => a.match_id === match.id),
  }));

  return { matches: MATCHES, odds: allOdds, arbitrage: allArbs, matchesWithOdds };
}

// Cache mock data so it's consistent within a session
let cachedData = null;

function getMockData() {
  if (!cachedData) {
    cachedData = generateMockData();
  }
  return cachedData;
}

function refreshMockData() {
  cachedData = generateMockData();
  return cachedData;
}

module.exports = { getMockData, refreshMockData };
