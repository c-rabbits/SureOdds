/**
 * Team Name Matcher
 *
 * Matches Korean team names (from Betman) to international team names (from The Odds API).
 * Strategy:
 *   1. Manual mapping table (주요 팀 사전 등록)
 *   2. Date + league + time proximity matching (fallback)
 *   3. User can manually link matches via the frontend
 */

const supabase = require('../config/supabase');

/**
 * Korean → English team name mapping.
 * Key: Korean shortened name (as shown on Betman)
 * Value: English name (as shown on The Odds API)
 */
const TEAM_NAME_MAP = {
  // ─── EPL ───
  '맨시티': 'Manchester City',
  '맨체스터시티': 'Manchester City',
  '맨유': 'Manchester United',
  '맨체스터유나이티드': 'Manchester United',
  '리버풀': 'Liverpool',
  '아스널': 'Arsenal',
  '아스날': 'Arsenal',
  '첼시': 'Chelsea',
  '토트넘': 'Tottenham Hotspur',
  '뉴캐슬': 'Newcastle United',
  '브라이튼': 'Brighton and Hove Albion',
  '애스턴빌라': 'Aston Villa',
  '웨스트햄': 'West Ham United',
  '본머스': 'AFC Bournemouth',
  '풀럼': 'Fulham FC',
  '크리스탈팰리스': 'Crystal Palace',
  '브렌트포드': 'Brentford',
  '에버턴': 'Everton',
  '울버햄턴': 'Wolverhampton Wanderers',
  '노팅엄': 'Nottingham Forest',
  '번리': 'Burnley',
  '셰필드유': 'Sheffield United',
  '루턴': 'Luton Town',
  '입스위치': 'Ipswich Town',
  '레스터': 'Leicester City',
  '사우샘프턴': 'Southampton',

  // ─── La Liga ───
  '바르셀로나': 'Barcelona',
  '레알마드리드': 'Real Madrid',
  '아틀레티코': 'Atletico Madrid',
  '아틀레티코마드리드': 'Atletico Madrid',
  '지로나': 'Girona',
  '소시에다드': 'Real Sociedad',
  '레알소시에다드': 'Real Sociedad',
  '베티스': 'Real Betis',
  '비야레알': 'Villarreal',
  '발렌시아': 'Valencia',
  '세비야': 'Sevilla',
  '셀타비고': 'Celta Vigo',
  '마요르카': 'Mallorca',
  '라스팔마스': 'Las Palmas',
  '오사수나': 'Osasuna',
  '알라베스': 'Deportivo Alaves',
  '카디스': 'Cadiz',
  '그라나다': 'Granada',
  '헤타페': 'Getafe',
  '라요바예카노': 'Rayo Vallecano',
  '에스파뇰': 'Espanyol',

  // ─── Bundesliga ───
  '바이에른': 'Bayern Munich',
  '뮌헨': 'Bayern Munich',
  '도르트문트': 'Borussia Dortmund',
  '라이프치히': 'RB Leipzig',
  '레버쿠젠': 'Bayer Leverkusen',
  '프랑크푸르트': 'Eintracht Frankfurt',
  '프라이부르크': 'SC Freiburg',
  '브레멘': 'Werder Bremen',
  '볼프스부르크': 'VfL Wolfsburg',
  '호펜하임': 'TSG Hoffenheim',
  '묀헨글라드바흐': 'Borussia Monchengladbach',
  '슈투트가르트': 'VfB Stuttgart',
  '마인츠': 'Mainz 05',
  '아우크스부르크': 'FC Augsburg',
  '쾰른': 'FC Koln',
  '다름슈타트': 'SV Darmstadt 98',
  '하이덴하임': 'FC Heidenheim',
  '우니온베를린': 'Union Berlin',

  // ─── Serie A ───
  '인테르': 'Inter Milan',
  '유벤투스': 'Juventus',
  '밀란': 'AC Milan',
  '나폴리': 'Napoli',
  '로마': 'AS Roma',
  '라치오': 'Lazio',
  '아탈란타': 'Atalanta',
  '피오렌티나': 'Fiorentina',
  '볼로냐': 'Bologna',
  '토리노': 'Torino',
  '모나코': 'AS Monaco',

  // ─── Ligue 1 ───
  '파리생제르맹': 'Paris Saint Germain',
  'PSG': 'Paris Saint Germain',
  '마르세유': 'Marseille',
  '릴': 'Lille',
  '리옹': 'Lyon',
  '렌': 'Rennes',
  '니스': 'Nice',
  '스트라스부르': 'Strasbourg',
  '툴루즈': 'Toulouse',
  '몽펠리에': 'Montpellier',
  '낭트': 'Nantes',
  '앙제': 'Angers',
  '르아브르': 'Le Havre',
  '생테티엔': 'Saint-Etienne',
  '브레스트': 'Brest',
  '랭스': 'Stade de Reims',
  '렌느': 'Rennes',

  // ─── UCL / UEL / UECL ───
  '갈라타사': 'Galatasaray',
  '갈라타사라이': 'Galatasaray',
  '바르셀로': 'Barcelona',
  '바르사': 'Barcelona',
  '레알마드': 'Real Madrid',
  '맨체스C': 'Manchester City',
  '맨체스U': 'Manchester United',
  '보되글림': 'Bodo/Glimt',
  '스포르CP': 'Sporting CP',
  '스포르팅': 'Sporting CP',
  '베식타스': 'Besiktas',
  '페네르바체': 'Fenerbahce',
  '바이뮌헨': 'Bayern Munich',
  '바이에른뮌헨': 'Bayern Munich',
  '포르투': 'FC Porto',
  '벤피카': 'Benfica',
  '셀틱FC': 'Celtic',
  '레인저스': 'Rangers',
  'AT마드': 'Atletico Madrid',
  'AT마드리드': 'Atletico Madrid',
  '도르트문': 'Borussia Dortmund',
  '인터밀란': 'Inter Milan',
  'AC밀란': 'AC Milan',
  '살츠부르크': 'Red Bull Salzburg',
  'RB라이프': 'RB Leipzig',
  '클럽브뤼': 'Club Brugge',
  '아약스': 'Ajax',
  'PSV': 'PSV Eindhoven',
  '페예노르': 'Feyenoord',

  // ─── NBA ───
  '레이커스': 'Los Angeles Lakers',
  'LA레이커스': 'Los Angeles Lakers',
  '셀틱스': 'Boston Celtics',
  '보스턴': 'Boston Celtics',
  '너겟츠': 'Denver Nuggets',
  '덴버': 'Denver Nuggets',
  '버킹스': 'Milwaukee Bucks',
  '밀워키': 'Milwaukee Bucks',
  '식서즈': 'Philadelphia 76ers',
  '필라델피아': 'Philadelphia 76ers',
  '선즈': 'Phoenix Suns',
  '피닉선즈': 'Phoenix Suns',
  '피닉센즈': 'Phoenix Suns',
  '피닉스': 'Phoenix Suns',
  '워리어스': 'Golden State Warriors',
  '골든스테이트': 'Golden State Warriors',
  '클리퍼스': 'Los Angeles Clippers',
  'LA클리퍼스': 'Los Angeles Clippers',
  '히트': 'Miami Heat',
  '마이애미': 'Miami Heat',
  '매버릭스': 'Dallas Mavericks',
  '댈러스': 'Dallas Mavericks',
  '닉스': 'New York Knicks',
  '뉴욕': 'New York Knicks',
  '캐벌리어스': 'Cleveland Cavaliers',
  '클리블랜드': 'Cleveland Cavaliers',
  '킹스': 'Sacramento Kings',
  '새크라멘토': 'Sacramento Kings',
  '그리즐리스': 'Memphis Grizzlies',
  '멤피스': 'Memphis Grizzlies',
  '펠리컨스': 'New Orleans Pelicans',
  '뉴올리언스': 'New Orleans Pelicans',
  '팀버울브스': 'Minnesota Timberwolves',
  '미네소타': 'Minnesota Timberwolves',
  '선더': 'Oklahoma City Thunder',
  '오클라호마': 'Oklahoma City Thunder',
  '트레일블레이저스': 'Portland Trail Blazers',
  '포틀랜드': 'Portland Trail Blazers',
  '포틀트레': 'Portland Trail Blazers',
  '랩터스': 'Toronto Raptors',
  '토론토': 'Toronto Raptors',
  '스퍼스': 'San Antonio Spurs',
  '샌안토니오': 'San Antonio Spurs',
  '재즈': 'Utah Jazz',
  '유타': 'Utah Jazz',
  '불스': 'Chicago Bulls',
  '시카고': 'Chicago Bulls',
  '시카불스': 'Chicago Bulls',
  '호크스': 'Atlanta Hawks',
  '애틀랜타': 'Atlanta Hawks',
  '위저즈': 'Washington Wizards',
  '워싱턴': 'Washington Wizards',
  '매직': 'Orlando Magic',
  '올랜도': 'Orlando Magic',
  '피스톤스': 'Detroit Pistons',
  '디트로이트': 'Detroit Pistons',
  '페이서스': 'Indiana Pacers',
  '인디애나': 'Indiana Pacers',
  '인디페이': 'Indiana Pacers',
  '넷츠': 'Brooklyn Nets',
  '브루클린': 'Brooklyn Nets',
  '호넷츠': 'Charlotte Hornets',
  '샬럿': 'Charlotte Hornets',
  '샬럿호네': 'Charlotte Hornets',
  '샬롯호네': 'Charlotte Hornets',
  '로켓츠': 'Houston Rockets',
  '휴스턴': 'Houston Rockets',
  '래프터스': 'Toronto Raptors',
  '새크킹스': 'Sacramento Kings',

  // ─── KBL ───
  '서울삼성': 'Seoul Samsung Thunders',
  '안양정관': 'Anyang KGC',
  '원주DB': 'Wonju DB Promy',
  '서울SK': 'Seoul SK Knights',
  '고양캐롯': 'Goyang Carrot Jumpers',
  '부산KCC': 'Busan KCC Egis',
  '창원LG': 'Changwon LG Sakers',
  '대구한국가스공사': 'Daegu KOGAS Pegasus',
  '수원KT': 'Suwon KT Sonicboom',
  '울산현대모비스': 'Ulsan Hyundai Mobis Phoebus',

  // ─── A-League ───
  '애들유나': 'Adelaide United',
  '웰링피닉': 'Wellington Phoenix',
  '멜번시티': 'Melbourne City FC',
  '멜번빅토리': 'Melbourne Victory',
  '시드니FC': 'Sydney FC',
  '웨스턴유나이티드': 'Western United',
  '센트럴코스트마리너스': 'Central Coast Mariners',
  '브리즈번로어': 'Brisbane Roar',
  '퍼스글로리': 'Perth Glory',
  '매쿼리유나이티드': 'Macarthur FC',
  '웨스턴시드니': 'Western Sydney Wanderers',
  '뉴캐슬제츠': 'Newcastle Jets',
};

/**
 * Attempt to find the English name for a Korean team name.
 * Returns the English name or null if not found.
 */
function findEnglishName(koreanName) {
  if (!koreanName) return null;

  // Direct lookup
  const direct = TEAM_NAME_MAP[koreanName];
  if (direct) return direct;

  // Try removing spaces and common suffixes
  const cleaned = koreanName.replace(/\s+/g, '');
  const cleanedLookup = TEAM_NAME_MAP[cleaned];
  if (cleanedLookup) return cleanedLookup;

  // Try partial match (Korean name is contained in a known key)
  for (const [key, value] of Object.entries(TEAM_NAME_MAP)) {
    if (cleaned.includes(key) || key.includes(cleaned)) {
      return value;
    }
  }

  return null;
}

/**
 * Try to match a Betman domestic match to an existing international match in DB.
 *
 * Strategy: Find matches with similar teams, same sport category, and close start_time.
 * @returns {string|null} The existing match ID if found, or null.
 */
async function findMatchingInternationalMatch(domesticMatch) {
  const homeEn = findEnglishName(domesticMatch.home_team);
  const awayEn = findEnglishName(domesticMatch.away_team);

  if (!homeEn || !awayEn) return null;

  // Search by team names + start_time within 24 hours
  const startTime = new Date(domesticMatch.start_time);
  const timeBefore = new Date(startTime.getTime() - 24 * 3600 * 1000).toISOString();
  const timeAfter = new Date(startTime.getTime() + 24 * 3600 * 1000).toISOString();

  const { data: candidates } = await supabase
    .from('matches')
    .select('id, external_id, home_team, away_team, start_time')
    .not('external_id', 'like', 'betman_%')
    .gte('start_time', timeBefore)
    .lte('start_time', timeAfter);

  if (!candidates || candidates.length === 0) return null;

  // Score each candidate by team name similarity
  for (const candidate of candidates) {
    const homeMatch =
      candidate.home_team.toLowerCase().includes(homeEn.toLowerCase()) ||
      homeEn.toLowerCase().includes(candidate.home_team.toLowerCase());
    const awayMatch =
      candidate.away_team.toLowerCase().includes(awayEn.toLowerCase()) ||
      awayEn.toLowerCase().includes(candidate.away_team.toLowerCase());

    if (homeMatch && awayMatch) {
      return candidate.id;
    }
  }

  return null;
}

module.exports = {
  TEAM_NAME_MAP,
  findEnglishName,
  findMatchingInternationalMatch,
};
