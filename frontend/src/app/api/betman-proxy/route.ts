/**
 * Betman API Proxy — Vercel Edge Function (Korea ICN region)
 *
 * betman.co.kr blocks overseas IPs, so we proxy requests through
 * a Vercel Edge Function deployed to Korea (Incheon).
 *
 * POST /api/betman-proxy
 * Body: { gmId: string, gmTs: string }
 * Returns: betman API JSON response
 */

export const runtime = 'edge';
export const preferredRegion = 'icn1'; // Incheon, Korea

const BETMAN_URL = 'https://www.betman.co.kr/buyPsblGame/gameInfoInq.do';

const HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'Content-Type': 'application/json; charset=UTF-8',
  'X-Requested-With': 'XMLHttpRequest',
  Referer: 'https://www.betman.co.kr/main/mainPage/gamebuy/gameSlip.do',
};

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
      return Response.json(
        { error: `Betman API returned ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
