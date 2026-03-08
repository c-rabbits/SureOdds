const axios = require('axios');
require('dotenv').config();

const BASE_URL = 'https://api.the-odds-api.com/v4';
const API_KEY = process.env.ODDS_API_KEY;

// Sports to track (configurable via ODDS_SPORTS env var, comma-separated)
const DEFAULT_SPORTS = [
  'soccer_epl',
  'soccer_spain_la_liga',
  'soccer_germany_bundesliga',
  'soccer_italy_serie_a',
  'soccer_france_ligue_one',
];

const EXTRA_SPORTS = [
  'basketball_nba',
  'baseball_mlb',
  'icehockey_nhl',
  'basketball_euroleague',
  'soccer_japan_j_league',
  'soccer_korea_kleague1',
];

const SPORTS = process.env.ODDS_SPORTS
  ? process.env.ODDS_SPORTS.split(',').map((s) => s.trim())
  : DEFAULT_SPORTS;

// Markets to fetch (configurable via ODDS_MARKETS env var)
const DEFAULT_MARKETS = ['h2h', 'spreads', 'totals'];
const MARKETS = process.env.ODDS_MARKETS
  ? process.env.ODDS_MARKETS.split(',').map((m) => m.trim())
  : DEFAULT_MARKETS;

// Bookmakers to track
const BOOKMAKERS = ['bet365', 'pinnacle', 'stake', 'unibet', 'betfair'];

// Track remaining API quota from response headers
let lastQuotaInfo = { used: null, remaining: null, updatedAt: null };

function getQuotaInfo() {
  return { ...lastQuotaInfo };
}

async function fetchOdds(sport, markets = MARKETS) {
  if (!API_KEY) {
    console.warn('ODDS_API_KEY not set. Using mock data.');
    return getMockOdds(sport);
  }

  try {
    const response = await axios.get(`${BASE_URL}/sports/${sport}/odds`, {
      params: {
        apiKey: API_KEY,
        regions: 'eu',
        markets: markets.join(','),
        bookmakers: BOOKMAKERS.join(','),
        oddsFormat: 'decimal',
      },
    });

    // Track API quota from response headers
    const used = response.headers['x-requests-used'];
    const remaining = response.headers['x-requests-remaining'];
    if (used !== undefined || remaining !== undefined) {
      lastQuotaInfo = {
        used: used ? parseInt(used, 10) : lastQuotaInfo.used,
        remaining: remaining ? parseInt(remaining, 10) : lastQuotaInfo.remaining,
        updatedAt: new Date().toISOString(),
      };
    }

    return response.data;
  } catch (err) {
    console.error(`Failed to fetch odds for ${sport}:`, err.message);
    return [];
  }
}

async function fetchAllOdds(sports = SPORTS, markets = MARKETS) {
  const results = [];
  for (const sport of sports) {
    const odds = await fetchOdds(sport, markets);
    results.push(...odds);
    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 500));
  }
  return { data: results, creditsUsed: sports.length * markets.length };
}

/**
 * Mock data for development/testing without an API key.
 * Includes h2h, spreads, and totals markets.
 */
function getMockOdds(sport) {
  const leagues = {
    soccer_epl: 'Premier League',
    soccer_spain_la_liga: 'La Liga',
    soccer_germany_bundesliga: 'Bundesliga',
    soccer_italy_serie_a: 'Serie A',
    soccer_france_ligue_one: 'Ligue 1',
    basketball_nba: 'NBA',
    baseball_mlb: 'MLB',
    icehockey_nhl: 'NHL',
  };

  const mockTeams = {
    soccer_epl: [
      { home: 'Arsenal', away: 'Chelsea' },
      { home: 'Manchester City', away: 'Liverpool' },
      { home: 'Tottenham', away: 'Manchester United' },
    ],
    soccer_spain_la_liga: [
      { home: 'Real Madrid', away: 'Barcelona' },
      { home: 'Atletico Madrid', away: 'Sevilla' },
    ],
    soccer_germany_bundesliga: [
      { home: 'Bayern Munich', away: 'Borussia Dortmund' },
      { home: 'RB Leipzig', away: 'Bayer Leverkusen' },
    ],
    soccer_italy_serie_a: [
      { home: 'Juventus', away: 'AC Milan' },
      { home: 'Inter Milan', away: 'Napoli' },
    ],
    soccer_france_ligue_one: [
      { home: 'PSG', away: 'Marseille' },
      { home: 'Lyon', away: 'Monaco' },
    ],
    basketball_nba: [
      { home: 'LA Lakers', away: 'Boston Celtics' },
      { home: 'Golden State Warriors', away: 'Miami Heat' },
    ],
    baseball_mlb: [
      { home: 'NY Yankees', away: 'LA Dodgers' },
      { home: 'Houston Astros', away: 'Atlanta Braves' },
    ],
    icehockey_nhl: [
      { home: 'Toronto Maple Leafs', away: 'Montreal Canadiens' },
      { home: 'NY Rangers', away: 'Boston Bruins' },
    ],
  };

  const teams = mockTeams[sport] || [{ home: 'Team A', away: 'Team B' }];
  const isSoccer = sport.startsWith('soccer');

  return teams.map((m, i) => {
    const homeBase = 1.8 + Math.random() * 1.2;
    const awayBase = 1.8 + Math.random() * 1.2;
    const drawBase = 3.0 + Math.random() * 0.8;

    const bookmakerData = [
      { key: 'bet365', title: 'Bet365' },
      { key: 'pinnacle', title: 'Pinnacle' },
      { key: 'unibet', title: 'Unibet' },
      { key: 'stake', title: 'Stake' },
      { key: 'betfair', title: 'Betfair' },
    ];

    return {
      id: `mock_${sport}_${i}_${Date.now()}`,
      sport_key: sport,
      sport_title: leagues[sport] || sport,
      commence_time: new Date(Date.now() + (i + 1) * 3600000 * (6 + Math.random() * 48)).toISOString(),
      home_team: m.home,
      away_team: m.away,
      bookmakers: bookmakerData.map((bm) => {
        const hVar = (Math.random() - 0.5) * 0.3;
        const aVar = (Math.random() - 0.5) * 0.3;
        const dVar = (Math.random() - 0.5) * 0.3;

        const markets = [];

        // H2H market
        const h2hOutcomes = [
          { name: m.home, price: parseFloat((homeBase + hVar).toFixed(2)) },
          { name: m.away, price: parseFloat((awayBase + aVar).toFixed(2)) },
        ];
        if (isSoccer) {
          h2hOutcomes.push({ name: 'Draw', price: parseFloat((drawBase + dVar).toFixed(2)) });
        }
        markets.push({ key: 'h2h', outcomes: h2hOutcomes });

        // Spreads market
        const spreadPoint = isSoccer ? -0.5 : -(1.5 + Math.floor(Math.random() * 5));
        markets.push({
          key: 'spreads',
          outcomes: [
            { name: m.home, price: parseFloat((1.85 + (Math.random() - 0.5) * 0.2).toFixed(2)), point: spreadPoint },
            { name: m.away, price: parseFloat((1.95 + (Math.random() - 0.5) * 0.2).toFixed(2)), point: -spreadPoint },
          ],
        });

        // Totals market
        const totalLine = isSoccer ? 2.5 : 180 + Math.floor(Math.random() * 40);
        markets.push({
          key: 'totals',
          outcomes: [
            { name: 'Over', price: parseFloat((1.87 + (Math.random() - 0.5) * 0.2).toFixed(2)), point: totalLine },
            { name: 'Under', price: parseFloat((1.93 + (Math.random() - 0.5) * 0.2).toFixed(2)), point: totalLine },
          ],
        });

        return { key: bm.key, title: bm.title, markets };
      }),
    };
  });
}

module.exports = { fetchAllOdds, fetchOdds, getQuotaInfo, SPORTS, EXTRA_SPORTS, MARKETS, BOOKMAKERS, DEFAULT_SPORTS };
