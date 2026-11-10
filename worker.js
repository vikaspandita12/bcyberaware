/**
 * BCyberAware — Cloudflare Worker entry (workers.dev + custom domains)
 * Routes /api/* to feed handlers; everything else from static assets.
 * A Cron Trigger refreshes the feed every 5 minutes and stores it in KV.
 */
import { corsPreflightResponse, methodNotAllowed } from "./functions/_shared/http.js";
import { handleFeedRequest, handleRssRequest, runScheduledRefresh } from "./functions/_shared/feed-core.js";
import { handleDarkwebRequest } from "./functions/_shared/darkweb-core.js";
import { handleChatRequest } from "./functions/_shared/chat-core.js";

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    // AI Threat Analyst (Workers AI — free tier, streaming)
    if (pathname === "/api/chat" || pathname === "/api/chat/") {
      if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
      if (request.method !== "POST") return methodNotAllowed();
      return handleChatRequest(request, env);
    }

    if (pathname === "/api/proxy" || pathname === "/api/proxy/") {
      if (request.method === "OPTIONS") return corsPreflightResponse();
      if (request.method !== "GET") return methodNotAllowed();
      return handleFeedRequest(request, env);
    }

    // RSS feed — subscribe from any reader, no account needed
    if (pathname === "/feed.xml" || pathname === "/rss.xml" || pathname === "/feed" || pathname === "/rss") {
      if (request.method !== "GET") return methodNotAllowed();
      return handleRssRequest(request, env);
    }

    if (pathname === "/api/darkweb" || pathname === "/api/darkweb/") {
      if (request.method === "OPTIONS") return corsPreflightResponse();
      if (request.method !== "GET") return methodNotAllowed();
      return handleDarkwebRequest(request);
    }

    return env.ASSETS.fetch(request);
  },

  // Cron Trigger (see wrangler.jsonc) — keeps the stored feed snapshot fresh so
  // visitors never wait on upstream sources.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduledRefresh(env).then(
      r => console.log("scheduled refresh", JSON.stringify(r)),
      e => console.error("scheduled refresh failed", e?.message || e),
    ));
  },
};
