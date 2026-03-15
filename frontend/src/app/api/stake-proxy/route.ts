/**
 * Stake.com GraphQL API Proxy — Vercel Edge Function
 *
 * Stake.com's API is behind Cloudflare JS Challenge which blocks
 * direct server-side (Node.js) requests. This Edge Function proxies
 * GraphQL queries through Vercel's edge infrastructure.
 *
 * POST /api/stake-proxy
 * Body: { query: string, variables?: object }
 * Returns: Stake GraphQL API response
 *
 * GET /api/stake-proxy
 * Returns: connectivity test
 */

export const runtime = 'edge';
export const preferredRegion = ['icn1', 'sin1', 'hnd1']; // Korea, Singapore, Tokyo

const STAKE_GQL = 'https://stake.com/_api/graphql';

const HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  Accept: 'application/json',
  'Content-Type': 'application/json',
  Origin: 'https://stake.com',
  Referer: 'https://stake.com/sports/soccer',
  'Sec-CH-UA': '"Chromium";v="122", "Google Chrome";v="122"',
  'Sec-CH-UA-Mobile': '?0',
  'Sec-CH-UA-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
};

/**
 * GET — connectivity test
 */
export async function GET() {
  const start = Date.now();
  const diagnostics: Record<string, unknown> = {
    region: process.env.VERCEL_REGION || 'unknown',
    timestamp: new Date().toISOString(),
  };

  try {
    // Simple test query — just get sport name
    const body = JSON.stringify({
      query: `query { slugSport(sport: "soccer") { id name } }`,
    });

    const res = await fetch(STAKE_GQL, {
      method: 'POST',
      headers: HEADERS,
      body,
    });

    diagnostics.status = res.status;
    diagnostics.ok = res.ok;
    diagnostics.contentType = res.headers.get('content-type');

    const text = await res.text();
    diagnostics.bodyLength = text.length;
    diagnostics.isCloudflareChallenge =
      text.includes('challenge') || text.includes('__CF');

    if (res.ok && !diagnostics.isCloudflareChallenge) {
      try {
        const json = JSON.parse(text);
        diagnostics.hasData = !!json.data;
        diagnostics.sportName = json.data?.slugSport?.name;
      } catch {
        diagnostics.parseError = true;
        diagnostics.bodySnippet = text.substring(0, 300);
      }
    } else {
      diagnostics.bodySnippet = text.substring(0, 300);
    }
  } catch (e) {
    diagnostics.error = e instanceof Error ? e.message : String(e);
  }

  diagnostics.durationMs = Date.now() - start;
  return Response.json(diagnostics);
}

/**
 * POST — proxy GraphQL request to Stake.com
 */
export async function POST(request: Request) {
  try {
    const { query, variables } = await request.json();

    if (!query) {
      return Response.json(
        { error: 'query is required' },
        { status: 400 },
      );
    }

    const body = JSON.stringify({ query, variables: variables || {} });

    const response = await fetch(STAKE_GQL, {
      method: 'POST',
      headers: {
        ...HEADERS,
        'Content-Length': String(new TextEncoder().encode(body).length),
      },
      body,
    });

    const text = await response.text();

    // Check for Cloudflare challenge
    if (
      !response.ok ||
      text.includes('Just a moment') ||
      text.includes('__CF')
    ) {
      return Response.json(
        {
          error: `Stake API blocked (status ${response.status})`,
          region: process.env.VERCEL_REGION || 'unknown',
          isCloudflare: true,
          bodySnippet: text.substring(0, 200),
        },
        { status: 502 },
      );
    }

    const data = JSON.parse(text);

    return Response.json(data, {
      headers: {
        'X-Proxy-Region': process.env.VERCEL_REGION || 'unknown',
        'Cache-Control': 'no-store',
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
