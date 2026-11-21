/**
 * BCyberAware — Telegram channel publishing (runs inside the scheduled refresh)
 *
 *  - Instant alert for every new ACT NOW item (priority >= 70).
 *  - One morning digest per day (09:00 IST) with the top 5 priorities.
 *
 * Switched off unless BOTH secrets are set on the Worker (Cloudflare dashboard →
 * Workers → bcyberaware → Settings → Variables and Secrets):
 *   TELEGRAM_BOT_TOKEN  — from @BotFather
 *   TELEGRAM_CHANNEL    — the channel's public username, e.g. @bcyberaware
 *
 * State (which items were already posted) lives in KV under one key, so a
 * restart never re-posts old alerts. On the very first run the current ACT NOW
 * items are recorded silently instead of flooding the channel.
 */

const STATE_KEY = "telegram:state:v1";
const SITE = "https://advisory.bcyberaware.co.in";
const MAX_ALERTS_PER_RUN = 3;
const ALERT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DIGEST_UTC_MINUTES = 3 * 60 + 30; // 03:30 UTC = 09:00 IST
const REMEMBER = 400;

export const telegramConfigured = env => !!(env?.TELEGRAM_BOT_TOKEN && env?.TELEGRAM_CHANNEL);

export function channelUrl(env) {
  const c = String(env?.TELEGRAM_CHANNEL || "").trim();
  if (!/^@[A-Za-z0-9_]{5,32}$/.test(c)) return null;
  return `https://t.me/${c.slice(1)}`;
}

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cut = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const allItems = d => [...(d.advisories || []), ...(d.exploits || []), ...(d.news || [])];

export function formatAlert(a) {
  const p = a.priority, act = a.action || {};
  const lines = [
    `🚨 <b>${esc(p.label)} · ${p.score}/100</b>`,
    `<b>${esc(cut(a.title, 200))}</b>`,
  ];
  if (act.ai?.in_short) lines.push(esc(cut(act.ai.in_short, 260)));
  lines.push(`<b>Why:</b> ${esc(cut(p.reasons.slice(0, 3).join(" · "), 260))}`);
  if (act.affected) lines.push(`<b>Affected:</b> ${esc(cut(act.affected, 140))}`);
  if (act.do_now) lines.push(`<b>Do now:</b> ${esc(cut(act.do_now, 300))}`);
  if (act.deadline) lines.push(`<b>CISA deadline:</b> ${esc(act.deadline)}`);
  if (a.cve_ids?.length) lines.push(a.cve_ids.slice(0, 3).map(c => `<code>${esc(c)}</code>`).join(" "));
  const src = a.source_url ? `<a href="${esc(a.source_url)}">${esc(a.source)}</a>` : esc(a.source);
  lines.push(`Source: ${src} · <a href="${SITE}">BCyberAware</a>`);
  return lines.join("\n\n").slice(0, 4000);
}

export function formatDigest(items, now) {
  const day = new Date(now).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  const rows = items.map((a, i) => {
    const doNow = a.action?.do_now ? `\n   ➜ ${esc(cut(a.action.do_now, 170))}` : "";
    return `${i + 1}. <b>[${a.priority.score} ${esc(a.priority.label)}]</b> ${esc(cut(a.title, 150))}${doNow}`;
  });
  return [
    `☀️ <b>BCyberAware morning brief · ${esc(day)}</b>`,
    `Top ${items.length} cyber threats to act on today, ranked by evidence:`,
    rows.join("\n\n"),
    `Full details and what to hunt for: <a href="${SITE}">advisory.bcyberaware.co.in</a>`,
  ].join("\n\n").slice(0, 4000);
}

export function pickDigest(d) {
  const picked = [], seen = new Set();
  for (const a of allItems(d).filter(a => a.priority).sort((x, y) => y.priority.score - x.priority.score || (y.ts || 0) - (x.ts || 0))) {
    const cves = a.cve_ids || [];
    if (cves.some(c => seen.has(c))) continue;
    cves.forEach(c => seen.add(c));
    picked.push(a);
    if (picked.length === 5) break;
  }
  return picked;
}

async function send(env, text, fetchImpl) {
  const r = await fetchImpl(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHANNEL, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  if (!r.ok) {
    let why = `HTTP ${r.status}`;
    try { why = (await r.json()).description || why; } catch {}
    throw new Error(why);
  }
}

/** Called once per scheduled refresh, after the snapshot is stored. Never throws. */
export async function publishToTelegram(env, payload, store, now, { fetchImpl = fetch, timeoutMs = 4000 } = {}) {
  const result = { configured: telegramConfigured(env), alerts: 0, digest: false, error: null };
  if (!result.configured || !store) return result;

  const timed = p => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), timeoutMs))]);
  let state;
  try { state = await store.get(STATE_KEY, { type: "json" }); } catch { return result; }
  const first = !state;
  state = state || { ids: [], cves: [], digest_day: null };
  const posted = new Set(state.ids), postedCves = new Set(state.cves);
  let changed = false;

  const fresh = allItems(payload)
    .filter(a => a.priority?.label === "ACT NOW" && (now - (a.ts || 0)) < ALERT_MAX_AGE_MS)
    .filter(a => !posted.has(a.id) && !(a.cve_ids || []).some(c => postedCves.has(c)))
    .sort((x, y) => y.priority.score - x.priority.score);

  const remember = a => { posted.add(a.id); (a.cve_ids || []).forEach(c => postedCves.add(c)); changed = true; };

  if (first) {
    fresh.forEach(remember); // baseline silently: no flood of old alerts on day one
  } else {
    for (const a of fresh.slice(0, MAX_ALERTS_PER_RUN)) {
      try { await timed(send(env, formatAlert(a), fetchImpl)); remember(a); result.alerts++; }
      catch (e) { result.error = String(e?.message || e).slice(0, 160); break; }
    }
  }

  const d = new Date(now);
  const today = d.toISOString().slice(0, 10);
  const minutes = d.getUTCHours() * 60 + d.getUTCMinutes();
  if (!result.error && state.digest_day !== today && minutes >= DIGEST_UTC_MINUTES) {
    const items = pickDigest(payload);
    if (items.length) {
      try { await timed(send(env, formatDigest(items, now), fetchImpl)); state.digest_day = today; changed = true; result.digest = true; }
      catch (e) { result.error = String(e?.message || e).slice(0, 160); }
    }
  }

  if (changed) {
    state.ids = [...posted].slice(-REMEMBER);
    state.cves = [...postedCves].slice(-REMEMBER);
    try { await store.put(STATE_KEY, JSON.stringify(state)); } catch {}
  }
  return result;
}
