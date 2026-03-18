/**
 * League name Korean mapping.
 * DB stores league names from various sources (OddsAPI, Pinnacle, Betman).
 * This maps them to Korean display names.
 */

const LEAGUE_NAME_MAP: Record<string, string> = {
  // === Soccer - Major Leagues ===
  'Premier League': '프리미어리그',
  'English Premier League': '프리미어리그',
  'EPL': '프리미어리그',
  'La Liga': '라리가',
  'Spain - La Liga': '라리가',
  'Bundesliga': '분데스리가',
  'Germany - Bundesliga': '분데스리가',
  'Serie A': '세리에 A',
  'Italy - Serie A': '세리에 A',
  'Ligue 1': '리그 1',
  'France - Ligue 1': '리그 1',

  // === Soccer - International Clubs ===
  'UEFA Champions League': 'UEFA 챔피언스리그',
  'International Clubs - UEFA Champions League': 'UEFA 챔피언스리그',
  'Champions League': 'UEFA 챔피언스리그',
  'UEFA Europa League': 'UEFA 유로파리그',
  'International Clubs - UEFA Europa League': 'UEFA 유로파리그',
  'Europa League': 'UEFA 유로파리그',
  'UEFA Europa Conference League': 'UEFA 컨퍼런스리그',
  'International Clubs - UEFA Europa Conference League': 'UEFA 컨퍼런스리그',

  // === Soccer - Asian ===
  'K League 1': 'K리그 1',
  'K-League': 'K리그 1',
  'South Korea - K League 1': 'K리그 1',
  'J-League': 'J리그',
  'J1 League': 'J리그',
  'Japan - J1 League': 'J리그',

  // === Soccer - Other European ===
  'Eredivisie': '에레디비시',
  'Netherlands - Eredivisie': '에레디비시',
  'Primeira Liga': '프리메이라리가',
  'Portugal - Primeira Liga': '프리메이라리가',
  'Super Lig': '쉬페르리그',
  'Turkey - Super Lig': '쉬페르리그',
  'Scottish Premiership': '스코틀랜드 프리미어십',
  'Belgium - First Division A': '벨기에 퍼스트 디비전',
  'Championship': '챔피언십',
  'England - Championship': '챔피언십',
  'EFL Championship': '챔피언십',

  // === Soccer - International ===
  'FIFA World Cup': 'FIFA 월드컵',
  'UEFA Euro': 'UEFA 유로',
  'AFC Champions League': 'AFC 챔피언스리그',
  'Copa Libertadores': '코파 리베르타도레스',
  'Copa America': '코파 아메리카',

  // === Basketball ===
  'NBA': 'NBA',
  'Euroleague': '유로리그',
  'KBL': 'KBL',

  // === Baseball ===
  'MLB': 'MLB',
  'KBO': 'KBO',
  'NPB': 'NPB',

  // === Ice Hockey ===
  'NHL': 'NHL',
};

/**
 * Get Korean league name. Returns original if no mapping found.
 * Handles [KR] prefix from Betman data.
 */
export function getKoreanLeagueName(league: string): string {
  if (!league) return '-';

  // Betman data already has Korean names with [KR] prefix
  if (league.startsWith('[KR] ')) {
    return league.slice(5);
  }

  // Direct lookup
  if (LEAGUE_NAME_MAP[league]) {
    return LEAGUE_NAME_MAP[league];
  }

  // Try partial match (e.g., "England - Premier League" contains "Premier League")
  for (const [key, value] of Object.entries(LEAGUE_NAME_MAP)) {
    if (league.includes(key) || key.includes(league)) {
      return value;
    }
  }

  return league;
}
