/**
 * BCyberAware – AI Threat Analyst (Cloudflare Workers AI)
 *
 * POST /api/chat  { messages: [{role:"user"|"assistant", content:string}, ...] }
 * → text/event-stream of {"response":"…"} chunks (Workers AI native SSE format)
 *
 * - Zero-cost: runs on the Workers AI free daily allowance (no API key).
 * - Grounded: the live threat-feed snapshot is injected as context, so the
 *   analyst answers from what is actually on the dashboard right now.
 * - Guarded: per-IP rate limit, message-size caps, history trimming, and a
 *   scoped system prompt (cybersecurity only).
 */

import { getFeedContext, loadSharedFeed } from "./feed-core.js";

const DEFAULT_MODEL   = "@cf/meta/llama-3.1-8b-instruct-fast";
const MAX_MSG_CHARS   = 1200;
const MAX_HISTORY     = 8;        // last N turns sent to the model
const MAX_TOKENS      = 700;
const RL_WINDOW_MS    = 10 * 60 * 1000;
const RL_MAX_REQUESTS = 20;       // per IP per window

const RATE = new Map();           // ip -> { count, resetAt }

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
  "X-Accel-Buffering": "no",
};
const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" };

function err(status, message) {
  return new Response(JSON.stringify({ error: message }), { status, headers: JSON_HEADERS });
}

function rateLimited(ip) {
  const now = Date.now();
  const e = RATE.get(ip);
  if (!e || now > e.resetAt) { RATE.set(ip, { count: 1, resetAt: now + RL_WINDOW_MS }); return false; }
  e.count++;
  if (RATE.size > 5000) RATE.clear();   // memory guard
  return e.count > RL_MAX_REQUESTS;
}

function systemPrompt(context) {
  const today = new Date().toUTCString().slice(0, 16);
  return `You are the BCyberAware Threat Analyst — an expert cybersecurity assistant embedded in the BCyberAware live threat-intelligence dashboard built by Vikas Pandita (Global Head of Security Architecture, GenAI security specialist).

Today is ${today}.

YOUR ROLE
- Answer questions about cybersecurity: vulnerabilities, CVEs, exploits, ransomware, threat actors, incident response, secure architecture, cloud/AI security, compliance (NIST, ISO 27001, OWASP, MITRE ATT&CK/ATLAS), and awareness.
- When the user asks about "latest", "today", "current", "breaking" or "what's happening", answer FROM THE LIVE FEED CONTEXT below and cite the item title and source. Say clearly when something is not in the current feed.
- Give practical, prioritised guidance: what to patch first, how to detect, how to mitigate. Use short headers and bullet points. Be concise (under ~250 words unless asked for detail).
- Mention GCC / Middle East or India relevance when the context flags it.

RULES
- Stay strictly on cybersecurity and this dashboard. For unrelated requests, politely decline in one sentence and offer a security-related alternative.
- Never provide working malware, exploit code, or step-by-step attack instructions against systems the user does not own. Defensive explanations are fine.
- Do not invent CVE numbers, dates or statistics. If unsure, say so.
- Never claim to be a human. You are an AI assistant running on Cloudflare Workers AI.
- If LIVE FEED CONTEXT is present, you MUST use it for "today/latest" questions. Never fall back to old well-known CVEs (Log4j, EternalBlue, etc.) as if they were current.

${context ? `LIVE FEED CONTEXT (items currently on this dashboard)\n${context}` : "LIVE FEED CONTEXT: unavailable on this request. Answer from general knowledge, say you cannot see the live feed right now, and do not invent today's headlines."}`;
}

export async function handleChatRequest(request, env) {
  if (!env?.AI) return err(503, "AI assistant is not enabled on this deployment (missing Workers AI binding).");

  const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "anon";
  if (rateLimited(ip)) return err(429, "You've reached the free assistant limit for now — please try again in a few minutes.");

  let body;
  try { body = await request.json(); } catch { return err(400, "Invalid JSON body"); }

  const raw = Array.isArray(body?.messages) ? body.messages : [];
  const history = raw
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_HISTORY)
    .map(m => ({ role: m.role, content: m.content.trim().slice(0, MAX_MSG_CHARS) }));

  if (!history.length || history[history.length - 1].role !== "user") return err(400, "Last message must be from the user");

  await loadSharedFeed(env);
  const clientCtx = typeof body.context === "string" ? body.context.trim().slice(0, 6000) : "";
  const ctx = clientCtx || getFeedContext();
  const messages = [{ role: "system", content: systemPrompt(ctx) }, ...history];
  const model = env.AI_MODEL || DEFAULT_MODEL;

  try {
    const stream = await env.AI.run(model, { messages, stream: true, max_tokens: MAX_TOKENS, temperature: 0.3 });
    return new Response(stream, { status: 200, headers: SSE_HEADERS });
  } catch (e) {
    const msg = String(e?.message || e);
    const quota = /quota|limit|exceeded|429/i.test(msg);
    return err(quota ? 429 : 502, quota
      ? "The free AI allowance for today has been used up. It resets daily — please try again later."
      : "AI model error: " + msg.slice(0, 120));
  }
}
