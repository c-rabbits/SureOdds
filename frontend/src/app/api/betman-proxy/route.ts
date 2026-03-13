/**
 * Betman API Proxy — Vercel Edge Function (Korea ICN region)
 *
 * betman.co.kr blocks overseas IPs, so we proxy requests through
 * a Vercel Edge Function deployed to Korea (Incheon).
 *
 * POST /api/betman-proxy
 * Body: { gmId: string, gmTs: string }
 * Returns: betman API JSON response
 *
 * GET /api/betman-proxy
 * Returns: connectivity test result
 */

export const runtime = 'edge';
export const preferredRegion = 'icn1'; // Incheon, Korea

const BETMAN_URL = 'https://www.betman.co.kr/buyPsblGame/gameInfoInq.do';
const BETMAN_HOME = 'https://www.betman.co.kr';

const HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'Content-Type': 'application/json; charset=UTF-8',
  'X-Requested-With': 'XMLHttpRequest',
  Referer: 'https://www.betman.co.kr/main/mainPage/gamebuy/gameSlip.do',
  Origin: 'https://www.betman.co.kr',
};

/**
 * GET — connectivity test (check if edge can reach betman.co.kr)
 */
export async function GET() {
  const start = Date.now();
  const diagnostics: Record<string, unknown> = {
    region: process.env.VERCEL_REGION || 'unknown',
    timestamp: new Date().toISOString(),
  };

  // Test 1: Can we reach betman.co.kr at all?
  try {
    const homeRes = await fetch(BETMAN_HOME, {
      method: 'GET',
      headers: {
        'User-Agent': HEADERS['User-Agent'],
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      redirect: 'follow',
    });
    diagnostics.homeStatus = homeRes.status;
    diagnostics.homeOk = homeRes.ok;
    diagnostics.homeContentType = homeRes.headers.get('content-type');
    const homeBody = await homeRes.text();
    diagnostics.homeBodyLength = homeBody.length;
    diagnostics.homeBodySnippet = homeBody.substring(0, 200);
  } catch (e) {
    diagnostics.homeError = e instanceof Error ? e.message : String(e);
  }

  // Test 2: Can we hit the API endpoint?
  try {
    const body = JSON.stringify({
      gmId: 'G101',
      gmTs: '260033',
      gameYear: '',
      _sbmInfo: { debugMode: 'false' },
    });
    const apiRes = await fetch(BETMAN_URL, {
      method: 'POST',
      headers: HEADERS,
      body,
    });
    diagnostics.apiStatus = apiRes.status;
    diagnostics.apiOk = apiRes.ok;
    diagnostics.apiContentType = apiRes.headers.get('content-type');
    const apiBody = await apiRes.text();
    diagnostics.apiBodyLength = apiBody.length;
    if (apiRes.ok) {
      try {
        const json = JSON.parse(apiBody);
        diagnostics.hasCurrentLottery = !!json.currentLottery;
        diagnostics.hasCompSchedules = !!json.compSchedules;
        diagnostics.saleStatus = json.currentLottery?.saleStatus;
        diagnostics.recordCount = json.compSchedules?.datas?.length || 0;
      } catch {
        diagnostics.apiBodySnippet = apiBody.substring(0, 300);
      }
    } else {
      diagnostics.apiBodySnippet = apiBody.substring(0, 300);
    }
  } catch (e) {
    diagnostics.apiError = e instanceof Error ? e.message : String(e);
  }

  diagnostics.durationMs = Date.now() - start;

  return Response.json(diagnostics);
}

/**
 * POST — proxy betman API request
 */
export async function POST(request: Request) {
  try {
    const { gmId, gmTs } = await request.json();

    if (!gmId || !gmTs) {
      return Response.json({ error: 'gmId and gmTs are required' }, { status: 400 });
    }

    const body = JSON.stringify({
      gmId,
      gmTs: String(gmTs),
      gameYear: '',
      _sbmInfo: { debugMode: 'false' },
    });

    const response = await fetch(BETMAN_URL, {
      method: 'POST',
      headers: HEADERS,
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      return Response.json(
        {
          error: `Betman API returned ${response.status}`,
          region: process.env.VERCEL_REGION || 'unknown',
          body: text.substring(0, 500),
        },
        { status: response.status },
      );
    }

    const data = await response.json();

    // Add metadata
    return Response.json(data, {
      headers: {
        'X-Proxy-Region': process.env.VERCEL_REGION || 'unknown',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json(
      {
        error: message,
        region: process.env.VERCEL_REGION || 'unknown',
      },
      { status: 500 },
    );
  }
}
