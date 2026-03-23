/**
 * English → Korean name mapping for Telegram notifications.
 * Mirrors frontend/src/lib/teamNames.ts and leagueNames.ts
 */

const LEAGUE_NAME_MAP = {
  // Soccer - Major
  'Premier League': '프리미어리그', 'English Premier League': '프리미어리그', 'EPL': '프리미어리그',
  'La Liga': '라리가', 'Spain - La Liga': '라리가',
  'Bundesliga': '분데스리가', 'Germany - Bundesliga': '분데스리가',
  'Serie A': '세리에 A', 'Italy - Serie A': '세리에 A',
  'Ligue 1': '리그 1', 'France - Ligue 1': '리그 1',
  // Soccer - International
  'UEFA Champions League': 'UEFA 챔피언스리그', 'Champions League': 'UEFA 챔피언스리그',
  'International Clubs - UEFA Champions League': 'UEFA 챔피언스리그',
  'UEFA Europa League': 'UEFA 유로파리그', 'Europa League': 'UEFA 유로파리그',
  'International Clubs - UEFA Europa League': 'UEFA 유로파리그',
  'UEFA Europa Conference League': 'UEFA 컨퍼런스리그',
  // Soccer - Asian
  'K League 1': 'K리그 1', 'K-League': 'K리그 1', 'South Korea - K League 1': 'K리그 1',
  'J-League': 'J리그', 'J1 League': 'J리그',
  // Soccer - Other
  'Eredivisie': '에레디비시', 'Championship': '챔피언십', 'EFL Championship': '챔피언십',
  'Scottish Premiership': '스코틀랜드 프리미어십',
  'MLS': 'MLS', 'Super Lig': '쉬페르리그',
  // Soccer - International
  'FIFA World Cup': 'FIFA 월드컵', 'UEFA Euro': 'UEFA 유로',
  'AFC Champions League': 'AFC 챔피언스리그',
  // Other sports
  'NBA': 'NBA', 'Euroleague': '유로리그', 'KBL': 'KBL',
  'MLB': 'MLB', 'KBO': 'KBO', 'NPB': 'NPB',
  'NHL': 'NHL',
};

const TEAM_NAME_MAP = {
  // EPL
  'Manchester City': '맨시티', 'Manchester United': '맨유', 'Liverpool': '리버풀',
  'Arsenal': '아스널', 'Arsenal FC': '아스널', 'Chelsea': '첼시', 'Chelsea FC': '첼시',
  'Tottenham Hotspur': '토트넘', 'Tottenham': '토트넘', 'Newcastle United': '뉴캐슬',
  'Brighton and Hove Albion': '브라이튼', 'Brighton': '브라이튼', 'Aston Villa': '애스턴빌라',
  'West Ham United': '웨스트햄', 'AFC Bournemouth': '본머스', 'Bournemouth': '본머스',
  'Fulham': '풀럼', 'Fulham FC': '풀럼', 'Crystal Palace': '크리스탈팰리스',
  'Brentford': '브렌트포드', 'Everton': '에버턴', 'Wolverhampton Wanderers': '울버햄턴',
  'Nottingham Forest': '노팅엄', 'Burnley': '번리', 'Sheffield United': '셰필드유',
  'Ipswich Town': '입스위치', 'Leicester City': '레스터', 'Southampton': '사우샘프턴',
  'Leeds United': '리즈U', 'Sunderland': '선덜랜드',
  // La Liga
  'Barcelona': '바르셀로나', 'FC Barcelona': '바르셀로나', 'Real Madrid': '레알마드리드',
  'Atletico Madrid': '아틀레티코', 'Atlético Madrid': '아틀레티코',
  'Girona': '지로나', 'Real Sociedad': '소시에다드', 'Real Betis': '베티스',
  'Villarreal': '비야레알', 'Valencia': '발렌시아', 'Sevilla': '세비야',
  'Celta Vigo': '셀타비고', 'Mallorca': '마요르카', 'Osasuna': '오사수나',
  'Getafe': '헤타페', 'Rayo Vallecano': '라요바예카노', 'Espanyol': '에스파뇰',
  'Athletic Bilbao': '빌바오', 'Athletic Club': '빌바오',
  'CD Leganes': '레가네스', 'Real Valladolid': '바야돌리드',
  // Bundesliga
  'Bayern Munich': '바이에른', 'Borussia Dortmund': '도르트문트', 'RB Leipzig': '라이프치히',
  'Bayer Leverkusen': '레버쿠젠', 'Eintracht Frankfurt': '프랑크푸르트',
  'SC Freiburg': '프라이부르크', 'Freiburg': '프라이부르크',
  'VfB Stuttgart': '슈투트가르트', 'VfL Wolfsburg': '볼프스부르크', 'Wolfsburg': '볼프스부르크',
  'TSG Hoffenheim': '호펜하임', 'Hoffenheim': '호펜하임',
  'Borussia Monchengladbach': '묀헨글라드바흐', 'Mainz 05': '마인츠', 'Mainz': '마인츠',
  'FC Augsburg': '아우크스부르크', 'Union Berlin': '우니온베를린',
  'FC St. Pauli': '장크트파울리', 'Holstein Kiel': '홀슈타인킬',
  'Werder Bremen': '브레멘', 'FC Heidenheim': '하이덴하임',
  // Serie A
  'Inter Milan': '인테르', 'FC Internazionale': '인테르', 'Juventus': '유벤투스',
  'AC Milan': '밀란', 'Napoli': '나폴리', 'SSC Napoli': '나폴리',
  'AS Roma': '로마', 'Roma': '로마', 'Lazio': '라치오', 'SS Lazio': '라치오',
  'Atalanta': '아탈란타', 'Fiorentina': '피오렌티나', 'ACF Fiorentina': '피오렌티나',
  'Bologna': '볼로냐', 'Torino': '토리노', 'Udinese': '우디네세',
  'Genoa': '제노아', 'Cagliari': '칼리아리', 'Como': '코모', 'Como 1907': '코모',
  'Lecce': '레체', 'Parma': '파르마', 'Monza': '몬차', 'Empoli': '엠폴리',
  'Venezia': '베네치아',
  // Ligue 1
  'Paris Saint Germain': 'PSG', 'Paris Saint-Germain': 'PSG', 'PSG': 'PSG',
  'AS Monaco': '모나코', 'Monaco': '모나코', 'Marseille': '마르세유',
  'Olympique Marseille': '마르세유', 'Lille': '릴', 'Lille OSC': '릴',
  'Lyon': '리옹', 'Olympique Lyon': '리옹', 'Rennes': '렌', 'Nice': '니스',
  'Strasbourg': '스트라스부르', 'Toulouse': '툴루즈', 'Montpellier': '몽펠리에',
  'Nantes': '낭트', 'FC Nantes': '낭트', 'Brest': '브레스트',
  'RC Lens': '랑스', 'Lens': '랑스', 'Auxerre': '오세르',
  'Saint-Etienne': '생테티엔', 'Le Havre': '르아브르', 'Angers': '앙제',
  'Stade de Reims': '랭스',
  // NBA
  'Los Angeles Lakers': '레이커스', 'LA Lakers': '레이커스', 'Boston Celtics': '셀틱스',
  'Denver Nuggets': '너겟츠', 'Milwaukee Bucks': '밀워키', 'Philadelphia 76ers': '식서즈',
  'Phoenix Suns': '선즈', 'Golden State Warriors': '워리어스',
  'Los Angeles Clippers': '클리퍼스', 'LA Clippers': '클리퍼스',
  'Miami Heat': '히트', 'Dallas Mavericks': '매버릭스', 'New York Knicks': '닉스',
  'Cleveland Cavaliers': '캐벌리어스', 'Sacramento Kings': '킹스',
  'Memphis Grizzlies': '그리즐리스', 'Minnesota Timberwolves': '팀버울브스',
  'Oklahoma City Thunder': '선더', 'Toronto Raptors': '랩터스',
  'San Antonio Spurs': '스퍼스', 'Chicago Bulls': '불스', 'Atlanta Hawks': '호크스',
  'Washington Wizards': '위저즈', 'Orlando Magic': '매직', 'Detroit Pistons': '피스톤스',
  'Indiana Pacers': '페이서스', 'Brooklyn Nets': '넷츠', 'Houston Rockets': '로켓츠',
  'New Orleans Pelicans': '펠리컨스', 'Portland Trail Blazers': '포틀랜드',
  'Charlotte Hornets': '호넷츠', 'Utah Jazz': '재즈',
  // NHL
  'Edmonton Oilers': '에드먼턴', 'Toronto Maple Leafs': '토론토ML',
  'Vegas Golden Knights': '베가스', 'Dallas Stars': '댈러스S',
  'Carolina Hurricanes': '캐롤라이나', 'New York Rangers': 'NY레인저스',
  'New York Islanders': 'NY아일랜더스', 'Tampa Bay Lightning': '탬파베이',
  'Colorado Avalanche': '콜로라도A', 'Florida Panthers': '플로리다P',
  'Winnipeg Jets': '위니펙', 'Pittsburgh Penguins': '피츠버그',
  'Boston Bruins': '보스턴B', 'Washington Capitals': '워싱턴C',
  'Montreal Canadiens': '몬트리올C', 'Columbus Blue Jackets': '콜럼버스BJ',
  'Nashville Predators': '내슈빌P', 'New Jersey Devils': '뉴저지',
  'Ottawa Senators': '오타와', 'St. Louis Blues': '세인트루이스B',
  'Detroit Red Wings': '디트로이트RW', 'Calgary Flames': '캘거리',
  'Seattle Kraken': '시애틀K', 'Vancouver Canucks': '밴쿠버C',
  'Anaheim Ducks': '애너하임', 'Buffalo Sabres': '버팔로',
  'Chicago Blackhawks': '블랙호크스', 'Philadelphia Flyers': '필라델피아F',
  'San Jose Sharks': '산호세', 'Los Angeles Kings': 'LA킹스',
  'Minnesota Wild': '미네소타W',
  // MLB
  'Los Angeles Dodgers': '다저스', 'New York Yankees': '양키스', 'Houston Astros': '애스트로스',
  'Atlanta Braves': '브레이브스', 'Baltimore Orioles': '오리올스', 'Boston Red Sox': '레드삭스',
  'Chicago Cubs': '컵스', 'Cleveland Guardians': '가디언스', 'Texas Rangers': '텍사스R',
  'Philadelphia Phillies': '필리스', 'San Diego Padres': '파드리스',
  'San Francisco Giants': '자이언츠', 'Seattle Mariners': '매리너스',
  'New York Mets': '메츠', 'Milwaukee Brewers': '브루어스', 'Minnesota Twins': '트윈스',
  'Tampa Bay Rays': '레이스', 'Toronto Blue Jays': '블루제이스',
  'Kansas City Royals': '로열스', 'Detroit Tigers': '타이거즈',
  // K-League
  'FC Seoul': 'FC서울', 'Jeonbuk Hyundai Motors': '전북현대', 'Ulsan Hyundai': '울산현대',
  'Pohang Steelers': '포항스틸러스', 'Daegu FC': '대구FC', 'Gangwon FC': '강원FC',
  'Incheon United': '인천유나이티드', 'Suwon FC': '수원FC', 'Gimcheon Sangmu': '김천상무',
  'Daejeon Hana Citizen': '대전하나', 'Gwangju FC': '광주FC',
};

/**
 * 영어 리그명 → 한국어. 매핑 없으면 원본 반환.
 */
function getKoreanLeagueName(league) {
  if (!league) return league;
  if (league.startsWith('[KR] ')) return league.slice(5);
  if (LEAGUE_NAME_MAP[league]) return LEAGUE_NAME_MAP[league];
  // Partial match
  for (const [key, value] of Object.entries(LEAGUE_NAME_MAP)) {
    if (league.includes(key) || key.includes(league)) return value;
  }
  return league;
}

/**
 * 영어 팀명 → 한국어. 매핑 없으면 원본 반환.
 */
function getKoreanTeamName(name) {
  if (!name) return name;
  if (TEAM_NAME_MAP[name]) return TEAM_NAME_MAP[name];
  // Strip FC/SC/CF suffixes/prefixes
  const stripped = name
    .replace(/\s+(FC|SC|CF|AC|BC|AFC|SFC|BK|FK|SK|IF|FF|SV|SE)$/i, '')
    .replace(/^(FC|SC|CF|AC|BC|AFC|SFC|BK|FK|SK|IF|FF|SV|SE)\s+/i, '')
    .trim();
  if (stripped !== name && TEAM_NAME_MAP[stripped]) return TEAM_NAME_MAP[stripped];
  return name;
}

module.exports = { getKoreanLeagueName, getKoreanTeamName };
