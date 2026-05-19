import { corsPreflightResponse, methodNotAllowed } from "../_shared/http.js";
import { handleDarkwebRequest } from "../_shared/darkweb-core.js";

export async function onRequest(context) {
  const { request } = context;

  if (request.method === "OPTIONS") return corsPreflightResponse();
  if (request.method !== "GET") return methodNotAllowed();

  return handleDarkwebRequest(request);
}
