/**
 * BCyberAware — Cloudflare Worker entry (workers.dev + custom domains)
 * Routes /api/* to feed handlers; everything else from static assets.
 */
import { corsPreflightResponse, methodNotAllowed } from "./functions/_shared/http.js";
import { handleFeedRequest } from "./functions/_shared/feed-core.js";
import { handleDarkwebRequest } from "./functions/_shared/darkweb-core.js";

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/proxy" || pathname === "/api/proxy/") {
      if (request.method === "OPTIONS") return corsPreflightResponse();
      if (request.method !== "GET") return methodNotAllowed();
      return handleFeedRequest(request);
    }

    if (pathname === "/api/darkweb" || pathname === "/api/darkweb/") {
      if (request.method === "OPTIONS") return corsPreflightResponse();
      if (request.method !== "GET") return methodNotAllowed();
      return handleDarkwebRequest(request);
    }

    return env.ASSETS.fetch(request);
  },
};
