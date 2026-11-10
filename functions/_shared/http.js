/** Shared HTTP helpers for Cloudflare Pages Functions */

// Browser must NOT cache API responses (stale HTML caused "not valid JSON" errors).
// Freshness is handled server-side: a Cron Trigger rebuilds the feed every 5 minutes
// and stores it in KV. s-maxage only caches at the CDN edge, not in the browser.
export const CACHE_CONTROL = "no-store";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": CACHE_CONTROL,
      ...CORS_HEADERS,
    },
  });
}

export function corsPreflightResponse() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function methodNotAllowed() {
  return jsonResponse({ error: "Method not allowed" }, 405);
}
