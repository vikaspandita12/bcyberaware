/** Shared HTTP helpers for Cloudflare Pages Functions */

export const CACHE_CONTROL = "public, max-age=7200, s-maxage=7200, stale-while-revalidate=3600";

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
