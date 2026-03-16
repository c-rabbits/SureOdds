/**
 * Team Stats Transformer
 *
 * Transforms raw API-Football standings data into team_stats DB rows.
 * Calculates attack/defense ratings and ELO from standings.
 */

const { LEAGUES } = require('./apiFootball');

// League base ELO (higher = stronger league overall)
const LEAGUE_BASE_ELO = {
  EPL: 1600,
  LA_LIGA: 1580,
  BUNDESLIGA: 1560,
  SERIE_A: 1560,
  LIGUE_1: 1520,
};

// API-Football team name → our canonical English name overrides
const NAME_OVERRIDES = {
  'Manchester City': 'Manchester City',
  'Manchester United': 'Manchester United',
  'Paris Saint Germain': 'Paris Saint Germain',
  'Atletico Madrid': 'Atletico Madrid',
  'Bayern Munich': 'Bayern Munich',
  'Borussia Monchengladbach': 'Borussia Monchengladbach',
  // API-Football specific names that differ from our convention
  'Bayer 04 Leverkusen': 'Bayer Leverkusen',
  'Borussia Mönchengladbach': 'Borussia Monchengladbach',
  'FC Augsburg': 'FC Augsburg',
  'TSG 1899 Hoffenheim': 'TSG Hoffenheim',
  '1. FC Heidenheim 1846': 'FC Heidenheim',
  '1. FC Köln': 'FC Koln',
  '1. FC Union Berlin': 'Union Berlin',
  'FC St. Pauli 1910': 'FC St. Pauli',
  'VfL Bochum 1848': 'VfL Bochum',
  'SV Darmstadt 98': 'SV Darmstadt 98',
  'SC Freiburg': 'SC Freiburg',
  'VfB Stuttgart': 'VfB Stuttgart',
  'VfL Wolfsburg': 'VfL Wolfsburg',
  'Eintracht Frankfurt': 'Eintracht Frankfurt',
  'Werder Bremen': 'Werder Bremen',
  'Brighton & Hove Albion': 'Brighton and Hove Albion',
  'Wolverhampton': 'Wolverhampton Wanderers',
  'AFC Bournemouth': 'AFC Bournemouth',
  'West Ham': 'West Ham United',
  'Newcastle': 'Newcastle United',
  'Nottingham Forest': 'Nottingham Forest',
  'Sheffield Utd': 'Sheffield United',
  'Luton': 'Luton Town',
  'AS Monaco': 'AS Monaco',
  'Stade Rennais': 'Rennes',
  'LOSC Lille': 'Lille',
  'Olympique Lyonnais': 'Lyon',
  'Olympique Marseille': 'Marseille',
  'OGC Nice': 'Nice',
  'RC Strasbourg Alsace': 'Strasbourg',
  'Stade Brestois 29': 'Brest',
  'Stade de Reims': 'Stade de Reims',
  'Montpellier HSC': 'Montpellier',
  'FC Nantes': 'Nantes',
  'Angers SCO': 'Angers',
  'Le Havre AC': 'Le Havre',
  'AS Saint-Étienne': 'Saint-Etienne',
  'AJ Auxerre': 'Auxerre',
  'RC Lens': 'RC Lens',
  'SSC Napoli': 'Napoli',
  'AS Roma': 'AS Roma',
  'SS Lazio': 'Lazio',
  'ACF Fiorentina': 'Fiorentina',
  'Hellas Verona': 'Hellas Verona',
  'US Lecce': 'US Lecce',
  'US Salernitana 1919': 'Salernitana',
  'Empoli FC': 'Empoli',
  'Frosinone Calcio': 'Frosinone',
  'AC Monza': 'Monza',
  'Rayo Vallecano': 'Rayo Vallecano',
  'Athletic Club': 'Athletic Bilbao',
  'Deportivo Alavés': 'Deportivo Alaves',
  'UD Las Palmas': 'Las Palmas',
  'RC Celta de Vigo': 'Celta Vigo',
  'Cádiz CF': 'Cadiz',
  'Granada CF': 'Granada',
  'RCD Mallorca': 'Mallorca',
  'Getafe CF': 'Getafe',
  'Real Sociedad': 'Real Sociedad',
  'Real Betis': 'Real Betis',
  'CA Osasuna': 'Osasuna',
  'Villarreal CF': 'Villarreal',
  'Valencia CF': 'Valencia',
  'Sevilla FC': 'Sevilla',
  'RCD Espanyol': 'Espanyol',
  'FC Barcelona': 'Barcelona',
  'Real Valladolid CF': 'Real Valladolid',
  'CD Leganés': 'Leganes',
};

/**
 * Normalize API-Football team name to our canonical English name.
 */
function normalizeTeamName(apiName) {
  return NAME_OVERRIDES[apiName] || apiName;
}

/**
 * Transform raw standings data into team_stats rows.
 */
function transformStandingsToTeamStats(standings, leagueKey, season) {
  const league = LEAGUES[leagueKey];
  if (!league || !standings || standings.length === 0) return [];

  return standings.map((entry) => {
    const mp = entry.all?.played || 0;
    const gf = entry.all?.goals?.for || 0;
    const ga = entry.all?.goals?.against || 0;

    return {
      team_name: normalizeTeamName(entry.team?.name || 'Unknown'),
      sport: league.sport,
      league: league.name,
      season: String(season),
      matches_played: mp,
      goals_scored: gf,
      goals_conceded: ga,
      avg_goals_scored: mp > 0 ? parseFloat((gf / mp).toFixed(2)) : 0,
      avg_goals_conceded: mp > 0 ? parseFloat((ga / mp).toFixed(2)) : 0,
      form_last5: (entry.form || '').slice(-5), // Last 5 chars: W/D/L
      rank: entry.rank || 0,
      _leagueKey: leagueKey, // internal, not saved to DB
    };
  });
}

/**
 * Calculate attack and defense ratings relative to league average.
 * Groups by league, calculates per-league averages, then rates each team.
 */
function calculateLeagueRatings(allTeamRows) {
  // Group by league
  const byLeague = {};
  for (const row of allTeamRows) {
    if (!byLeague[row._leagueKey]) byLeague[row._leagueKey] = [];
    byLeague[row._leagueKey].push(row);
  }

  for (const [, teams] of Object.entries(byLeague)) {
    const totalMP = teams.reduce((s, t) => s + t.matches_played, 0);
    const totalGF = teams.reduce((s, t) => s + t.goals_scored, 0);
    const totalGA = teams.reduce((s, t) => s + t.goals_conceded, 0);

    const leagueAvgScored = totalMP > 0 ? totalGF / totalMP : 1;
    const leagueAvgConceded = totalMP > 0 ? totalGA / totalMP : 1;

    for (const team of teams) {
      if (team.matches_played > 0 && leagueAvgScored > 0) {
        team.attack_rating = parseFloat((team.avg_goals_scored / leagueAvgScored).toFixed(3));
      } else {
        team.attack_rating = 1.0;
      }

      if (team.matches_played > 0 && leagueAvgConceded > 0) {
        team.defense_rating = parseFloat((team.avg_goals_conceded / leagueAvgConceded).toFixed(3));
      } else {
        team.defense_rating = 1.0;
      }
    }
  }

  return allTeamRows;
}

/**
 * Calculate initial ELO ratings from standings position.
 * Top team gets base + 150, bottom team gets base - 150.
 */
function calculateEloFromStandings(allTeamRows) {
  // Group by league
  const byLeague = {};
  for (const row of allTeamRows) {
    if (!byLeague[row._leagueKey]) byLeague[row._leagueKey] = [];
    byLeague[row._leagueKey].push(row);
  }

  for (const [leagueKey, teams] of Object.entries(byLeague)) {
    const baseElo = LEAGUE_BASE_ELO[leagueKey] || 1500;
    const teamCount = teams.length;

    for (const team of teams) {
      if (teamCount > 1 && team.rank > 0) {
        // Linear interpolation: 1st gets +150, last gets -150
        const positionBonus = ((teamCount - team.rank) / (teamCount - 1)) * 300 - 150;
        team.elo_rating = parseFloat((baseElo + positionBonus).toFixed(2));
      } else {
        team.elo_rating = baseElo;
      }
    }
  }

  return allTeamRows;
}

/**
 * Clean internal fields before DB insert.
 */
function cleanForDb(teamRows) {
  return teamRows.map(({ _leagueKey, rank, ...row }) => ({
    ...row,
    updated_at: new Date().toISOString(),
  }));
}

module.exports = {
  transformStandingsToTeamStats,
  calculateLeagueRatings,
  calculateEloFromStandings,
  cleanForDb,
  normalizeTeamName,
};
