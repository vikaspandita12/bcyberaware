import { corsPreflightResponse, methodNotAllowed } from "../_shared/http.js";
import { handleFeedRequest } from "../_shared/feed-core.js";

export async function onRequest(context) {
  const { request } = context;

  if (request.method === "OPTIONS") return corsPreflightResponse();
  if (request.method !== "GET") return methodNotAllowed();

  return handleFeedRequest(request);
}
