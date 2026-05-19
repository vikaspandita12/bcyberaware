/** Shared HTTP helpers for Cloudflare Pages Functions */

// Browser must NOT cache API responses (stale HTML caused "not valid JSON" errors).
// The Worker's in-memory cache handles the 2-hour refresh server-side.
// s-maxage only caches at the CDN edge, not in the browser.
export const CACHE_CONTROL = "no-store, s-maxage=7200, stale-while-revalidate=3600";

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
