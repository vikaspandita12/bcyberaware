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

async function send(env, text, fetchImpl, chatId) {
  const r = await fetchImpl(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId ?? env.TELEGRAM_CHANNEL, text, parse_mode: "HTML", disable_web_page_preview: true }),
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

  // Private commands sent to the bot (/test, /start). Polled here, every 5 minutes.
  try {
    const cmd = await handleCommands(env, payload, state, now, fetchImpl, timed);
    if (cmd.changed) changed = true;
    result.commands = cmd.handled;
  } catch {}

  // Remember the outcome so the status endpoint can explain a silent channel.
  // Written only when it changes, to stay well inside the free KV write budget.
  const last = result.error ? { error: result.error, at: now } : (result.alerts || result.digest) ? { ok: true, at: now } : null;
  if (last && (state.last?.error || null) !== (last.error || null)) { state.last = last; changed = true; }
  else if (last?.ok && state.last && !state.last.ok) { state.last = last; changed = true; }

  if (changed) {
    state.ids = [...posted].slice(-REMEMBER);
    state.cves = [...postedCves].slice(-REMEMBER);
    try { await store.put(STATE_KEY, JSON.stringify(state)); } catch {}
  }
  return result;
}

// ── Bot commands ───────────────────────────────────────────────────────────────
// The bot has no webhook; the scheduled refresh polls getUpdates instead, so a
// command is answered within about 5 minutes. Only the channel's owner or an
// admin may use /test, checked against Telegram's own member list.
const MAX_COMMANDS_PER_RUN = 3;
const IST = { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true };

export function formatTest(payload, now) {
  const top = pickDigest(payload)[0];
  const lines = [
    `✅ <b>Test message from BCyberAware</b>`,
    `The alert bot is connected and can post here. Sent ${esc(new Date(now).toLocaleString("en-IN", IST))} IST.`,
    `What arrives automatically:\n• Every new "Act now" threat, within about 5 minutes\n• A morning brief with the top 5 threats at 9:00 am IST`,
  ];
  if (top) lines.push(`Top priority right now: <b>[${top.priority.score} ${esc(top.priority.label)}]</b> ${esc(cut(top.title, 150))}`);
  lines.push(`<a href="${SITE}">advisory.bcyberaware.co.in</a>`);
  return lines.join("\n\n");
}

async function api(env, method, params, fetchImpl) {
  const qs = new URLSearchParams(params || {}).toString();
  const r = await fetchImpl(`https://api.telegram.org/bot${String(env.TELEGRAM_BOT_TOKEN).trim()}/${method}${qs ? "?" + qs : ""}`);
  const body = await r.json().catch(() => null);
  if (!body?.ok) throw new Error(body?.description || `HTTP ${r.status}`);
  return body.result;
}

async function handleCommands(env, payload, state, now, fetchImpl, timed) {
  const out = { handled: 0, changed: false };
  const offset = state.update_offset || 0;
  const updates = await timed(api(env, "getUpdates", { offset: String(offset), timeout: "0", limit: "20", allowed_updates: JSON.stringify(["message"]) }, fetchImpl));
  if (!updates?.length) return out;
  // Acknowledge everything fetched, even ignored messages, so nothing is re-read
  state.update_offset = Math.max(...updates.map(u => u.update_id)) + 1;
  out.changed = true;

  const cmds = updates
    .map(u => u.message)
    .filter(m => m?.chat?.type === "private" && typeof m.text === "string" && m.text.startsWith("/"))
    .slice(-MAX_COMMANDS_PER_RUN);
  for (const m of cmds) {
    const cmd = m.text.trim().split(/[\s@]/)[0].toLowerCase();
    const reply = text => timed(send(env, text, fetchImpl, m.chat.id)).catch(() => {});
    if (cmd === "/test") {
      let allowed = false;
      try {
        const member = await timed(api(env, "getChatMember", { chat_id: String(env.TELEGRAM_CHANNEL).trim(), user_id: String(m.from.id) }, fetchImpl));
        allowed = member?.status === "creator" || member?.status === "administrator";
      } catch {}
      if (!allowed) { await reply("Sorry, only the owner of the BCyberAware channel can use /test."); continue; }
      try {
        await timed(send(env, formatTest(payload, now), fetchImpl));
        await reply(`✅ Test message posted to ${esc(env.TELEGRAM_CHANNEL)}.`);
        out.handled++;
      } catch (e) { await reply(`❌ Could not post to the channel: ${esc(String(e?.message || e).slice(0, 120))}`); }
    } else if (cmd === "/start" || cmd === "/help") {
      await reply(`This bot posts BCyberAware threat alerts to ${esc(env.TELEGRAM_CHANNEL)}.\n\nJoin the channel for alerts: ${esc(channelUrl(env) || SITE)}\n\nChannel owner: send /test to post a test message.`);
    }
  }
  return out;
}

/** For the status endpoint: last Telegram outcome and today's brief. Never throws. */
export async function telegramStatus(store) {
  if (!store) return null;
  try {
    const st = await store.get(STATE_KEY, { type: "json" });
    if (!st) return { state: "not run yet" };
    return {
      last_error: st.last?.error || null,
      last_error_at: st.last?.error ? new Date(st.last.at).toISOString() : null,
      last_success_at: st.last?.ok ? new Date(st.last.at).toISOString() : null,
      brief_sent_for: st.digest_day || null,
      alerts_remembered: (st.ids || []).length,
    };
  } catch { return null; }
}

// ── Live diagnosis for the status endpoint ─────────────────────────────────────
// Asks Telegram, right now, whether the configured token works and whether the
// bot may post in the channel. Reports only yes/no checks on the token's format
// (never its value or length), which catch the usual paste mistakes.
let _check = null; // per-isolate memo so a busy status page can't hammer Telegram
const CHECK_MEMO_MS = 30 * 1000;

export function tokenFormat(token) {
  const t = String(token ?? "");
  const m = t.trim().match(/^(\d+):([A-Za-z0-9_-]+)$/);
  return {
    looks_like_number_colon_secret: !!m,
    secret_part_full_length: m ? m[2].length === 35 : false,
    extra_spaces: t !== t.trim(),
    has_quotes: /["'`]/.test(t),
    has_line_break: /[\r\n]/.test(t),
  };
}

export async function checkTelegram(env, { fetchImpl = fetch, timeoutMs = 4000, now = Date.now() } = {}) {
  if (!telegramConfigured(env)) return null;
  if (_check && now - _check.at < CHECK_MEMO_MS) return _check.value;
  const token = String(env.TELEGRAM_BOT_TOKEN).trim();
  const call = async (method, params) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const qs = new URLSearchParams(params || {}).toString();
      const r = await fetchImpl(`https://api.telegram.org/bot${token}/${method}${qs ? "?" + qs : ""}`, { signal: ctrl.signal });
      let body = null; try { body = await r.json(); } catch {}
      return { ok: !!body?.ok, status: r.status, description: body?.description || `HTTP ${r.status}`, result: body?.result };
    } catch (e) { return { ok: false, status: 0, description: "request failed" }; }
    finally { clearTimeout(t); }
  };
  const value = { checked_at: new Date(now).toISOString(), token_format: tokenFormat(env.TELEGRAM_BOT_TOKEN) };
  const me = await call("getMe");
  value.token_valid = me.ok;
  value.telegram_says = me.ok ? "OK" : me.description;
  if (me.ok) {
    value.bot_username = me.result?.username || null;
    const member = await call("getChatMember", { chat_id: String(env.TELEGRAM_CHANNEL).trim(), user_id: String(me.result.id) });
    value.bot_role_in_channel = member.ok ? member.result?.status : null;
    value.bot_can_post = member.ok ? (member.result?.status === "creator" || member.result?.can_post_messages === true) : false;
    if (!member.ok) value.channel_problem = member.description;
  }
  value.verdict = !me.ok
    ? (me.status === 404 ? "Token is malformed: it must be the bot number, a colon, then the secret." : "Telegram rejects this token: it was revoked or mistyped. Get a fresh one from @BotFather and paste the whole thing.")
    : !value.bot_can_post ? "Token works, but the bot cannot post in the channel: make it an administrator with 'Post Messages' on."
    : "All good: the bot can post in the channel.";
  _check = { at: now, value };
  return value;
}
