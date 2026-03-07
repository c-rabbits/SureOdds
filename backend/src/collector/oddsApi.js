const axios = require('axios');
require('dotenv').config();

const BASE_URL = 'https://api.the-odds-api.com/v4';
const API_KEY = process.env.ODDS_API_KEY;

// Sports to track
const SPORTS = ['soccer_epl', 'soccer_spain_la_liga', 'soccer_germany_bundesliga', 'soccer_italy_serie_a', 'soccer_france_ligue_one'];

// Bookmakers to track
const BOOKMAKERS = ['bet365', 'pinnacle', 'stake', 'unibet', 'betfair'];

async function fetchOdds(sport) {
  if (!API_KEY) {
    console.warn('ODDS_API_KEY not set. Using mock data.');
    return getMockOdds(sport);
  }

  try {
    const response = await axios.get(`${BASE_URL}/sports/${sport}/odds`, {
      params: {
        apiKey: API_KEY,
        regions: 'eu',
        markets: 'h2h',
        bookmakers: BOOKMAKERS.join(','),
        oddsFormat: 'decimal',
      },
    });
    return response.data;
  } catch (err) {
    console.error(`Failed to fetch odds for ${sport}:`, err.message);
    return [];
  }
}

async function fetchAllOdds() {
  const results = [];
  for (const sport of SPORTS) {
    const odds = await fetchOdds(sport);
    results.push(...odds);
    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 500));
  }
  return results;
}

/**
 * Mock data for development/testing without an API key.
 */
function getMockOdds(sport) {
  const leagues = {
    soccer_epl: 'Premier League',
    soccer_spain_la_liga: 'La Liga',
    soccer_germany_bundesliga: 'Bundesliga',
    soccer_italy_serie_a: 'Serie A',
    soccer_france_ligue_one: 'Ligue 1',
  };

  const mockMatches = [
    { home: 'Arsenal', away: 'Chelsea' },
    { home: 'Manchester City', away: 'Liverpool' },
    { home: 'Real Madrid', away: 'Barcelona' },
    { home: 'Bayern Munich', away: 'Borussia Dortmund' },
    { home: 'Juventus', away: 'AC Milan' },
  ];

  return mockMatches.slice(0, 2).map((m, i) => ({
    id: `mock_${sport}_${i}`,
    sport_key: sport,
    sport_title: leagues[sport] || sport,
    commence_time: new Date(Date.now() + (i + 1) * 3600000 * 24).toISOString(),
    home_team: m.home,
    away_team: m.away,
    bookmakers: [
      {
        key: 'bet365',
        title: 'Bet365',
        markets: [
          {
            key: 'h2h',
            outcomes: [
              { name: m.home, price: 2.1 + Math.random() * 0.5 },
              { name: 'Draw', price: 3.2 + Math.random() * 0.4 },
              { name: m.away, price: 3.4 + Math.random() * 0.6 },
            ],
          },
        ],
      },
      {
        key: 'pinnacle',
        title: 'Pinnacle',
        markets: [
          {
            key: 'h2h',
            outcomes: [
              { name: m.home, price: 2.08 + Math.random() * 0.5 },
              { name: 'Draw', price: 3.25 + Math.random() * 0.4 },
              { name: m.away, price: 3.45 + Math.random() * 0.6 },
            ],
          },
        ],
      },
      {
        key: 'unibet',
        title: 'Unibet',
        markets: [
          {
            key: 'h2h',
            outcomes: [
              { name: m.home, price: 2.05 + Math.random() * 0.5 },
              { name: 'Draw', price: 3.15 + Math.random() * 0.4 },
              { name: m.away, price: 3.5 + Math.random() * 0.6 },
            ],
          },
        ],
      },
    ],
  }));
}

module.exports = { fetchAllOdds, fetchOdds, SPORTS, BOOKMAKERS };
