/**
 * Team Logo Service
 *
 * Fetches team logos from TheSportsDB (free, no API key required).
 * Caches results in-memory + Supabase to avoid repeated API calls.
 */

const { createHttpClient } = require('../config/httpClient');
const supabase = require('../config/supabase');
const { createServiceLogger } = require('../config/logger');

const log = createServiceLogger('TeamLogo');
const http = createHttpClient('TheSportsDB', { timeout: 10000 });

const BASE_URL = 'https://www.thesportsdb.com/api/v1/json/3';

// In-memory cache: teamName → logoUrl
const logoCache = {};

/**
 * Get logo URL for a team name.
 * 1. Check in-memory cache
 * 2. Check DB (team_stats or dedicated cache)
 * 3. Fetch from TheSportsDB API
 * @returns {string|null} Logo URL or null
 */
async function getTeamLogo(teamName) {
  if (!teamName || teamName === '미정') return null;

  // 1. In-memory cache
  if (logoCache[teamName] !== undefined) {
    return logoCache[teamName];
  }

  // 2. DB cache (team_stats table has logo_url if we store it)
  try {
    const { data } = await supabase
      .from('team_stats')
      .select('logo_url')
      .eq('team_name', teamName)
      .not('logo_url', 'is', null)
      .limit(1)
      .single();

    if (data?.logo_url) {
      logoCache[teamName] = data.logo_url;
      return data.logo_url;
    }
  } catch {
    // team_stats might not have logo_url column yet, or no match — continue
  }

  // 3. Fetch from TheSportsDB
  try {
    const { data: response } = await http.get(`${BASE_URL}/searchteams.php`, {
      params: { t: teamName },
    });

    const teams = response?.teams;
    if (teams && teams.length > 0) {
      const logo = teams[0].strBadge || teams[0].strLogo || null;
      logoCache[teamName] = logo;

      // Save to DB for persistence
      if (logo) {
        supabase
          .from('team_stats')
          .update({ logo_url: logo })
          .eq('team_name', teamName)
          .then(({ error }) => {
            if (error) {
              // Column might not exist yet — that's fine
            }
          })
          .catch(() => {});
      }

      return logo;
    }
  } catch (err) {
    log.warn('TheSportsDB fetch failed', { team: teamName, error: err.message });
  }

  // Not found
  logoCache[teamName] = null;
  return null;
}

/**
 * Batch fetch logos for multiple team names.
 * Returns a map: { teamName: logoUrl }
 */
async function getTeamLogos(teamNames) {
  const unique = [...new Set(teamNames.filter(Boolean))];
  const result = {};

  // Split into cached and uncached
  const uncached = [];
  for (const name of unique) {
    if (logoCache[name] !== undefined) {
      result[name] = logoCache[name];
    } else {
      uncached.push(name);
    }
  }

  // Batch DB lookup for uncached
  if (uncached.length > 0) {
    try {
      const { data: dbLogos } = await supabase
        .from('team_stats')
        .select('team_name, logo_url')
        .in('team_name', uncached)
        .not('logo_url', 'is', null);

      if (dbLogos) {
        for (const row of dbLogos) {
          logoCache[row.team_name] = row.logo_url;
          result[row.team_name] = row.logo_url;
        }
      }
    } catch {
      // Column might not exist
    }

    // Fetch remaining from API in background (don't block response)
    const stillMissing = uncached.filter((n) => result[n] === undefined);
    if (stillMissing.length > 0) {
      // Return null for now, fetch in background for next request
      for (const name of stillMissing) {
        result[name] = null;
      }
      // Background fetch (fire-and-forget)
      fetchLogosInBackground(stillMissing);
    }
  }

  return result;
}

/**
 * Fetch logos in background without blocking the response.
 * Results are cached for subsequent requests.
 */
let bgFetchRunning = false;
const bgQueue = [];

async function fetchLogosInBackground(teams) {
  bgQueue.push(...teams);
  if (bgFetchRunning) return;
  bgFetchRunning = true;

  while (bgQueue.length > 0) {
    const name = bgQueue.shift();
    if (!name || logoCache[name] !== undefined) continue;

    try {
      const { data: response } = await http.get(`${BASE_URL}/searchteams.php`, {
        params: { t: name },
      });
      const logo = response?.teams?.[0]?.strBadge || null;
      logoCache[name] = logo;

      if (logo) {
        supabase.from('team_stats').update({ logo_url: logo }).eq('team_name', name).then(() => {}).catch(() => {});
      }
    } catch {
      logoCache[name] = null;
    }

    // Rate limit: 500ms between API calls
    await new Promise((r) => setTimeout(r, 500));
  }

  bgFetchRunning = false;
}

/**
 * 서버 시작 시 DB에서 모든 로고를 인메모리 캐시로 프리로드.
 */
async function preloadLogos() {
  try {
    const { data } = await supabase
      .from('team_stats')
      .select('team_name, logo_url')
      .not('logo_url', 'is', null);

    if (data) {
      for (const row of data) {
        logoCache[row.team_name] = row.logo_url;
      }
      log.info(`Preloaded ${data.length} team logos into cache`);
    }
  } catch (err) {
    log.warn('Logo preload failed (column may not exist)', { error: err.message });
  }
}

module.exports = { getTeamLogo, getTeamLogos, preloadLogos };
