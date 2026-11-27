/**
 * BCyberAware — Telegram channel + personal industry alerts
 *
 * Channel (runs inside the scheduled refresh, every 5 minutes):
 *  - Instant alert for every new ACT NOW item (priority >= 70), with industry
 *    hashtags (#Healthcare, #Finance…) and buttons under the message.
 *  - Morning brief at 09:00 IST: top 5, industry watch, CISA deadlines this week.
 *  - Friday pulse poll (18:00 IST) on the week's biggest threats.
 *
 * Bot (private chat, instant through a webhook at /api/telegram):
 *  - /start or /industries: pick industries with tap-to-toggle buttons.
 *  - Subscribers get ACT NOW alerts for their industries and a personal
 *    morning brief, by direct message.
 *  - /brief, /cve CVE-…, /stop, /help; /test for the channel owner.
 *
 * Switched off unless BOTH secrets are set on the Worker:
 *   TELEGRAM_BOT_TOKEN  — from @BotFather
 *   TELEGRAM_CHANNEL    — the channel's public username, e.g. @bcyberaware
 * Optional: TELEGRAM_WEBHOOK = "off" keeps the old 5-minute polling for commands.
 *
 * State lives in KV: what was posted (never re-posted after a restart), the
 * subscribers (chat id → chosen industries, nothing else) and a small outbox of
 * direct messages, drained a few per run to stay inside the Worker's request budget.
 */
import { SECTORS, ALL_CHOICES, byId, sectorsOf, hashtagsOf, matches } from "./sectors.js";
import { incidentNews, formatNewsAlert, newsButtons, pickRoundup, formatRoundup } from "./news-alerts.js";

const STATE_KEY = "telegram:state:v1";
const SUBS_KEY = "telegram:subs:v1";
const OUTBOX_KEY = "telegram:outbox:v1";
const SITE = "https://advisory.bcyberaware.co.in";
const WEBHOOK_URL = `${SITE}/api/telegram`;
const WEBHOOK_VERSION = 1;
const MAX_ALERTS_PER_RUN = 3;
const ALERT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DIGEST_UTC_MINUTES = 3 * 60 + 30;  // 03:30 UTC = 09:00 IST
const POLL_UTC_MINUTES = 12 * 60 + 30;   // Friday 12:30 UTC = 18:00 IST
const ROUNDUP_UTC_MINUTES = 13 * 60;     // 13:00 UTC = 18:30 IST, daily "Today in cyber"
const NEWS_MAX_PER_DAY = 10;             // breaking breach / attack / zero-day stories per UTC day
const NEWS_MIN_GAP_MS = 40 * 60 * 1000;  // at most one breaking story every 40 minutes
const NEWS_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const REMEMBER = 400;
const RUN_BUDGET = 16;                   // Telegram requests per scheduled run (Worker limit is 50 in total)
const WEBHOOK_DM_BUDGET = 20;            // direct messages a webhook call may also deliver
const OUTBOX_MAX = 3000;
const DAY = 24 * 60 * 60 * 1000;

export const telegramConfigured = env => !!(env?.TELEGRAM_BOT_TOKEN && env?.TELEGRAM_CHANNEL);
const webhookWanted = env => String(env?.TELEGRAM_WEBHOOK || "").toLowerCase() !== "off";

export function channelUrl(env) {
  const c = String(env?.TELEGRAM_CHANNEL || "").trim();
  if (!/^@[A-Za-z0-9_]{5,32}$/.test(c)) return null;
  return `https://t.me/${c.slice(1)}`;
}

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cut = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const allItems = d => [...(d?.advisories || []), ...(d?.exploits || []), ...(d?.news || [])];
const byPriority = (x, y) => y.priority.score - x.priority.score || (y.ts || 0) - (x.ts || 0);
const bar = score => { const n = Math.max(0, Math.min(10, Math.round(score / 10))); return "▰".repeat(n) + "▱".repeat(10 - n); };
const dayLabel = now => new Date(now).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const botLink = (username, param = "industries") => username ? `https://t.me/${username}?start=${param}` : null;
const sectorList = ids => ids.map(id => byId(id)).filter(Boolean).map(s => `${s.emoji} ${s.name.replace(/ \(.*\)$/, "")}`).join(" · ");

function uniqueByCve(items, n) {
  const picked = [], seen = new Set();
  for (const a of items) {
    const cves = a.cve_ids || [];
    if (cves.some(c => seen.has(c))) continue;
    cves.forEach(c => seen.add(c));
    picked.push(a);
    if (picked.length === n) break;
  }
  return picked;
}

// ── Message formats ───────────────────────────────────────────────────────────

export function formatAlert(a) {
  const p = a.priority, act = a.action || {};
  const lines = [
    `🚨 <b>${esc(p.label)} · ${p.score}/100</b>  ${bar(p.score)}`,
    `<b>${esc(cut(a.title, 200))}</b>`,
  ];
  if (act.ai?.in_short) lines.push(esc(cut(act.ai.in_short, 260)));
  const facts = [];
  if (a.kev) facts.push("🔥 On CISA KEV");
  else if (a.exploit_in_wild) facts.push("🔥 Exploited in the wild");
  if (a.patch_available) facts.push("🩹 Patch available");
  if (facts.length) lines.push(facts.join("  ·  "));
  lines.push(`<b>Why:</b> ${esc(cut(p.reasons.slice(0, 3).join(" · "), 260))}`);
  if (act.affected) lines.push(`<b>Affected:</b> ${esc(cut(act.affected, 140))}`);
  if (act.do_now) lines.push(`<b>Do now:</b> ${esc(cut(act.do_now, 300))}`);
  if (act.deadline) lines.push(`<b>CISA deadline:</b> ${esc(act.deadline)}`);
  const ind = sectorsOf(a);
  lines.push(`<b>Industries:</b> ${esc(sectorList(ind))}`);
  if (a.cve_ids?.length) lines.push(a.cve_ids.slice(0, 3).map(c => `<code>${esc(c)}</code>`).join(" "));
  const src = a.source_url ? `<a href="${esc(a.source_url)}">${esc(a.source)}</a>` : esc(a.source);
  lines.push(`Source: ${src} · <a href="${SITE}">BCyberAware</a>`);
  lines.push(hashtagsOf(a).join(" "));
  return lines.join("\n\n").slice(0, 4000);
}

/** Buttons under a channel alert. */
export function alertButtons(a, botUsername) {
  const row1 = [{ text: "📊 Full analysis", url: SITE }];
  const cve = (a.cve_ids || [])[0];
  if (cve) row1.push({ text: `🔎 ${cve}`, url: `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cve)}` });
  const rows = [row1];
  const link = botLink(botUsername);
  if (link) rows.push([{ text: "🎯 Get alerts for my industry", url: link }]);
  return { inline_keyboard: rows };
}

/** Industries with the most must-act items in the last two days. */
export function industryWatch(d, now) {
  const counts = new Map();
  for (const a of allItems(d)) {
    if (!a.priority || a.priority.score < 50 || (now - (a.ts || 0)) > 2 * DAY) continue;
    for (const id of sectorsOf(a)) if (id !== "cross") counts.set(id, (counts.get(id) || 0) + 1);
  }
  return [...counts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5).map(([id, n]) => ({ sector: byId(id), n }));
}

/** CISA KEV deadlines falling in the next 7 days, soonest first. */
export function upcomingDeadlines(d, now) {
  const out = [], seen = new Set();
  for (const a of allItems(d)) {
    const dl = a.action?.deadline; if (!dl) continue;
    const t = Date.parse(dl); if (!Number.isFinite(t)) continue;
    if (t < now - DAY || t > now + 7 * DAY) continue;
    const key = (a.cve_ids || [])[0] || a.id; if (seen.has(key)) continue; seen.add(key);
    out.push({ t, dl, a });
  }
  return out.sort((x, y) => x.t - y.t).slice(0, 4);
}

export function formatDigest(items, now, { payload = null, botUsername = null } = {}) {
  const rows = items.map((a, i) => {
    const doNow = a.action?.do_now ? `\n   ➜ ${esc(cut(a.action.do_now, 170))}` : "";
    const ind = sectorsOf(a).map(id => byId(id).emoji).join("");
    return `${i + 1}. <b>[${a.priority.score} ${esc(a.priority.label)}]</b> ${ind} ${esc(cut(a.title, 150))}${doNow}`;
  });
  const parts = [
    `☀️ <b>BCyberAware morning brief · ${esc(dayLabel(now))}</b>`,
    `🔥 <b>Top ${items.length} to act on today</b>, ranked by evidence:`,
    rows.join("\n\n"),
  ];
  if (payload) {
    const watch = industryWatch(payload, now);
    if (watch.length) parts.push(`🏭 <b>Industry watch</b> (must-act items, last 48h)\n${watch.map(w => `${w.sector.emoji} ${esc(w.sector.name)}: <b>${w.n}</b>`).join("\n")}`);
    const due = upcomingDeadlines(payload, now);
    if (due.length) parts.push(`⏰ <b>CISA patch deadlines this week</b>\n${due.map(x => `• <b>${esc(x.dl)}</b> — ${esc(cut((x.a.cve_ids || [])[0] ? `${x.a.cve_ids[0]} · ${x.a.action?.affected || x.a.title}` : x.a.title, 110))}`).join("\n")}`);
  }
  const link = botLink(botUsername);
  parts.push(`Full details and what to hunt for: <a href="${SITE}">advisory.bcyberaware.co.in</a>` + (link ? `\n🎯 Only want your industry? <a href="${link}">Get personal alerts</a>` : ""));
  parts.push("#MorningBrief");
  return parts.join("\n\n").slice(0, 4000);
}

export function pickDigest(d) {
  return uniqueByCve(allItems(d).filter(a => a.priority).sort(byPriority), 5);
}

/** Top items for a set of industries (personal brief / /brief). */
export function pickForSectors(d, chosen, now, n = 3) {
  const recent = allItems(d).filter(a => a.priority && a.priority.score >= 40 && (now - (a.ts || 0)) < 3 * DAY && matches(a, chosen));
  return uniqueByCve(recent.sort(byPriority), n);
}

const briefRow = (a, i) => `${i + 1}. <b>[${a.priority.score} ${esc(a.priority.label)}]</b> ${esc(cut(a.title, 140))}` + (a.action?.do_now ? `\n   ➜ ${esc(cut(a.action.do_now, 160))}` : "");

export function formatPersonalBrief(d, chosen, now) {
  const items = pickForSectors(d, chosen, now, 3);
  const parts = [`🎯 <b>Your industry brief · ${esc(dayLabel(now))}</b>`, `For: ${esc(sectorList(chosen))}`];
  parts.push(items.length ? items.map(briefRow).join("\n\n") : "✅ Nothing urgent for your industries in the last 3 days.");
  // Someone who follows only specific industries still hears about the must-act
  // items that hit every organisation (Microsoft, VPNs, browsers…)
  if (!chosen.includes("cross")) {
    const shown = new Set(items.map(a => a.id));
    const everyone = pickForSectors(d, ["cross"], now, 4).filter(a => a.priority.score >= 70 && !shown.has(a.id)).slice(0, 2);
    if (everyone.length) parts.push(`🌐 <b>Also critical for every organisation</b>\n${everyone.map(briefRow).join("\n\n")}`);
  }
  parts.push(`Change industries: /industries · Any CVE: send its ID · <a href="${SITE}">Open dashboard</a>`);
  return parts.join("\n\n").slice(0, 4000);
}

export function formatPersonalAlert(a, chosen) {
  const mine = sectorsOf(a).filter(id => chosen.includes(id));
  return [`🎯 <b>For your industry:</b> ${esc(sectorList(mine))}`, formatAlert(a)].join("\n").slice(0, 4000);
}

export function formatCve(d, cve) {
  const hits = allItems(d).filter(a => (a.cve_ids || []).includes(cve)).sort((x, y) => (y.priority?.score || 0) - (x.priority?.score || 0));
  const nvd = `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cve)}`;
  if (!hits.length) return `🔎 <b>${esc(cve)}</b>\n\nNot in BCyberAware's live feed right now (it tracks the last few weeks).\n\nDetails: <a href="${nvd}">NVD</a>`;
  const a = hits[0], p = a.priority || { score: 0, label: "INFO", reasons: [] }, act = a.action || {};
  const lines = [`🔎 <b>${esc(cve)}</b> · <b>${p.score}/100 ${esc(p.label)}</b>  ${bar(p.score)}`, `<b>${esc(cut(a.title, 200))}</b>`];
  if (act.ai?.in_short) lines.push(esc(cut(act.ai.in_short, 260)));
  if (p.reasons?.length) lines.push(`<b>Why:</b> ${esc(cut(p.reasons.slice(0, 3).join(" · "), 260))}`);
  if (act.do_now) lines.push(`<b>Do now:</b> ${esc(cut(act.do_now, 300))}`);
  if (act.deadline) lines.push(`<b>CISA deadline:</b> ${esc(act.deadline)}`);
  lines.push(`<b>Industries:</b> ${esc(sectorList(sectorsOf(a)))}`);
  lines.push(`Seen in ${hits.length} report${hits.length > 1 ? "s" : ""} · <a href="${nvd}">NVD</a> · <a href="${SITE}">Dashboard</a>`);
  return lines.join("\n\n").slice(0, 4000);
}

export function formatTest(payload, now) {
  const top = pickDigest(payload)[0];
  const lines = [
    `✅ <b>Test message from BCyberAware</b>`,
    `The alert bot is connected and can post here. Sent ${esc(new Date(now).toLocaleString("en-IN", IST))} IST.`,
    `What arrives automatically:\n• Every new "Act now" threat, within about 5 minutes, tagged by industry\n• Breaking news on major breaches, ransomware attacks and zero-days\n• A morning brief at 9:00 am IST and "Today in cyber" at 6:30 pm IST\n• A Friday pulse poll at 6:00 pm IST`,
  ];
  if (top) lines.push(`Top priority right now: <b>[${top.priority.score} ${esc(top.priority.label)}]</b> ${esc(cut(top.title, 150))}`);
  lines.push(`<a href="${SITE}">advisory.bcyberaware.co.in</a>`);
  return lines.join("\n\n");
}

const WELCOME = `👋 <b>Welcome to BCyberAware alerts</b>

Pick the industries you protect. You'll get:
• 🚨 Must-act threats and major breaches in those industries, by direct message
• ☀️ A personal brief at 9:00 am IST

Tap to select, then press <b>Done</b>.`;

export function industryKeyboard(chosen) {
  const btn = s => ({ text: `${chosen.includes(s.id) ? "✅" : "▫️"} ${s.emoji} ${s.id === "cross" ? "Cross-industry" : s.name}`, callback_data: `t:${s.id}` });
  const rows = [];
  for (let i = 0; i < SECTORS.length; i += 2) rows.push(SECTORS.slice(i, i + 2).map(btn));
  rows.push([btn(byId("cross"))]);
  rows.push([{ text: "Select all", callback_data: "all" }, { text: "Clear", callback_data: "none" }]);
  rows.push([{ text: "✔️ Done", callback_data: "done" }]);
  return { inline_keyboard: rows };
}

const HELP = `<b>BCyberAware bot</b>

/industries — choose your industries
/brief — your industry brief now (or <code>/brief all</code>)
/cve CVE-2026-1234 — look up any CVE (or just send the ID)
/stop — stop direct messages
/help — this message`;

const COMMANDS = [
  { command: "industries", description: "Choose the industries you protect" },
  { command: "brief", description: "Your industry brief right now" },
  { command: "cve", description: "Look up a CVE, e.g. /cve CVE-2026-1234" },
  { command: "stop", description: "Stop direct messages" },
  { command: "help", description: "What this bot does" },
];

// ── Telegram API ──────────────────────────────────────────────────────────────
const IST = { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true };

class TgError extends Error { constructor(msg, status) { super(msg); this.status = status; } }

function client(env, fetchImpl, budget = Infinity) {
  const token = String(env.TELEGRAM_BOT_TOKEN).trim();
  const c = {
    left: budget,
    async call(method, body) {
      if (c.left <= 0) throw new TgError("request budget used", 0);
      c.left--;
      const r = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}),
      });
      let j = null; try { j = await r.json(); } catch {}
      if (!r.ok || (j && j.ok === false)) throw new TgError(j?.description || `HTTP ${r.status}`, r.status);
      return j?.result;
    },
    send(chatId, text, markup) {
      const body = { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true };
      if (markup) body.reply_markup = markup;
      return c.call("sendMessage", body);
    },
  };
  return c;
}

export async function webhookSecret(env) {
  const data = new TextEncoder().encode(`bcyberaware-webhook:${String(env.TELEGRAM_BOT_TOKEN || "").trim()}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 48);
}

const kvJson = async (store, key, fallback) => { try { return (await store.get(key, { type: "json" })) || fallback; } catch { return fallback; } };

// ── Scheduled run ─────────────────────────────────────────────────────────────

/** Called once per scheduled refresh, after the snapshot is stored. Never throws. */
export async function publishToTelegram(env, payload, store, now, { fetchImpl = fetch, timeoutMs = 4000 } = {}) {
  const result = { configured: telegramConfigured(env), alerts: 0, digest: false, error: null };
  if (!result.configured || !store) return result;

  const timed = p => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), timeoutMs))]);
  const tg = client(env, fetchImpl, RUN_BUDGET);
  let state;
  try { state = await store.get(STATE_KEY, { type: "json" }); } catch { return result; }
  const first = !state;
  state = state || { ids: [], cves: [], digest_day: null };
  const posted = new Set(state.ids), postedCves = new Set(state.cves);
  let changed = false;

  // Subscribers and outbox are read lazily (one KV read each, only when needed)
  let subs = null, outbox = null, subsChanged = false, outboxChanged = false;
  const loadSubs = async () => (subs ??= await kvJson(store, SUBS_KEY, {}));
  const loadOutbox = async () => (outbox ??= await kvJson(store, OUTBOX_KEY, []));
  const enqueue = async (chat, text) => { const ob = await loadOutbox(); if (ob.length < OUTBOX_MAX) { ob.push({ c: chat, t: text }); outboxChanged = true; } };

  // One-time setup: instant bot replies through a webhook, plus the "/" command menu
  if (webhookWanted(env) && state.webhook !== WEBHOOK_VERSION) {
    try {
      const me = await timed(tg.call("getMe"));
      state.bot_username = me?.username || null;
      await timed(tg.call("setWebhook", { url: WEBHOOK_URL, secret_token: await webhookSecret(env), allowed_updates: ["message", "callback_query"], max_connections: 10 }));
      await timed(tg.call("setMyCommands", { commands: COMMANDS })).catch(() => {});
      state.webhook = WEBHOOK_VERSION;
      changed = true;
      result.webhook = "set";
    } catch (e) { result.webhook = `not set: ${String(e?.message || e).slice(0, 100)}`; }
  }

  const fresh = allItems(payload)
    .filter(a => a.priority?.label === "ACT NOW" && (now - (a.ts || 0)) < ALERT_MAX_AGE_MS)
    .filter(a => !posted.has(a.id) && !(a.cve_ids || []).some(c => postedCves.has(c)))
    .sort((x, y) => y.priority.score - x.priority.score);

  const remember = a => { posted.add(a.id); (a.cve_ids || []).forEach(c => postedCves.add(c)); changed = true; };

  if (first) {
    fresh.forEach(remember); // baseline silently: no flood of old alerts on day one
  } else {
    for (const a of fresh.slice(0, MAX_ALERTS_PER_RUN)) {
      try { await timed(tg.send(env.TELEGRAM_CHANNEL, formatAlert(a), alertButtons(a, state.bot_username))); remember(a); result.alerts++; }
      catch (e) { result.error = String(e?.message || e).slice(0, 160); break; }
      // Same alert, by direct message, to everyone who follows one of its industries
      const s = await loadSubs();
      for (const [chat, sub] of Object.entries(s)) if (matches(a, sub.s || [])) await enqueue(chat, formatPersonalAlert(a, sub.s));
    }
  }

  const d = new Date(now);
  const today = d.toISOString().slice(0, 10);
  const minutes = d.getUTCHours() * 60 + d.getUTCMinutes();

  // Breaking incident news: breaches, ransomware, cyberattacks, zero-days under attack.
  // These score low as vulnerabilities, so they are picked by what the story describes.
  if (!result.error) {
    if (state.news_day !== today) { state.news_day = today; state.news_count = 0; changed = true; }
    const postedNews = new Set(state.news_ids || []);
    const recentTitles = (state.news_titles || []).filter(x => now - x.at < 2 * DAY);
    const fresh = incidentNews(payload, now, NEWS_MAX_AGE_MS)
      .filter(a => !postedNews.has(a.id) && !posted.has(a.id) && !(a.cve_ids || []).some(c => postedCves.has(c)) && !recentTitles.some(x => sameStory(x.t, a.title)));
    const due = state.news_count < NEWS_MAX_PER_DAY && (now - (state.news_last_at || 0)) >= NEWS_MIN_GAP_MS;
    const a = fresh.find(x => !postedNews.has(x.id));
    if (!first && due && a) {
      try {
        await timed(tg.send(env.TELEGRAM_CHANNEL, formatNewsAlert(a), newsButtons(a, state.bot_username, SITE)));
        postedNews.add(a.id); (a.cve_ids || []).forEach(c => postedCves.add(c));
        recentTitles.push({ t: a.title, at: now });
        state.news_count++; state.news_last_at = now; result.news = 1;
        // Direct message to subscribers whose own industries the story is about
        const s = await loadSubs();
        for (const [chat, sub] of Object.entries(s)) if (sectorsOf(a).some(id => id !== "cross" && (sub.s || []).includes(id))) await enqueue(chat, formatNewsAlert(a));
      } catch (e) { result.error = String(e?.message || e).slice(0, 160); }
    }
    state.news_ids = [...postedNews].slice(-REMEMBER);
    state.news_titles = recentTitles.slice(-40);
    changed = true;
  }

  // Evening roundup: "Today in cyber", the day's most important stories with links
  if (!result.error && !first && state.roundup_day !== today && minutes >= ROUNDUP_UTC_MINUTES) {
    const items = pickRoundup(payload, now, 8);
    if (items.length >= 3) {
      try {
        await timed(tg.send(env.TELEGRAM_CHANNEL, formatRoundup(items, now, SITE)));
        state.roundup_day = today; changed = true; result.roundup = true;
      } catch (e) { result.error = String(e?.message || e).slice(0, 160); }
    }
  }
  if (!result.error && state.digest_day !== today && minutes >= DIGEST_UTC_MINUTES) {
    const items = pickDigest(payload);
    if (items.length) {
      try {
        await timed(tg.send(env.TELEGRAM_CHANNEL, formatDigest(items, now, { payload, botUsername: state.bot_username })));
        state.digest_day = today; changed = true; result.digest = true;
        const s = await loadSubs();
        for (const [chat, sub] of Object.entries(s)) if (sub.s?.length) await enqueue(chat, formatPersonalBrief(payload, sub.s, now));
      } catch (e) { result.error = String(e?.message || e).slice(0, 160); }
    }
  }

  // Friday pulse poll in the channel
  const week = isoWeek(d);
  if (!result.error && !first && d.getUTCDay() === 5 && minutes >= POLL_UTC_MINUTES && state.poll_week !== week) {
    const top = pickDigest(payload).slice(0, 4);
    if (top.length >= 2) {
      try {
        await timed(tg.call("sendPoll", {
          chat_id: env.TELEGRAM_CHANNEL,
          question: "📊 Friday pulse: which of this week's threats worries your team most?",
          options: [...top.map(a => cut(a.title, 95)), "None of these affect us"].map(text => ({ text })),
          is_anonymous: true, allows_multiple_answers: true,
        }));
        state.poll_week = week; changed = true; result.poll = true;
      } catch (e) { result.poll_error = String(e?.message || e).slice(0, 120); state.poll_week = week; changed = true; }
    }
  }

  // Without a webhook, commands are polled here instead (answered within ~5 minutes)
  if (!state.webhook) {
    try {
      const cmd = await pollCommands(env, payload, state, now, tg, timed, store);
      if (cmd.changed) changed = true;
      result.commands = cmd.handled;
    } catch {}
  }

  // Deliver queued direct messages with whatever request budget is left
  if ((await loadOutbox()).length && tg.left > 0) {
    const r = await drainOutbox(tg, outbox, await loadSubs(), tg.left, timed);
    if (r.sent || r.dropped) { outboxChanged = true; result.direct = r.sent; }
    if (r.removed) subsChanged = true;
  }

  // Remember the outcome so the status endpoint can explain a silent channel.
  const last = result.error ? { error: result.error, at: now } : (result.alerts || result.digest) ? { ok: true, at: now } : null;
  if (last && (state.last?.error || null) !== (last.error || null)) { state.last = last; changed = true; }
  else if (last?.ok && state.last && !state.last.ok) { state.last = last; changed = true; }

  if (changed) {
    state.ids = [...posted].slice(-REMEMBER);
    state.cves = [...postedCves].slice(-REMEMBER);
    try { await store.put(STATE_KEY, JSON.stringify(state)); } catch {}
  }
  if (subsChanged) { try { await store.put(SUBS_KEY, JSON.stringify(subs)); } catch {} }
  if (outboxChanged) { try { await store.put(OUTBOX_KEY, JSON.stringify(outbox)); } catch {} }
  return result;
}

const STOP = new Set("breach breaches breached data customer customers users hackers hacker attack attacks cyberattack security vulnerability vulnerabilities flaw flaws exposes exposed after with from says said confirms confirmed over more than into their that this have been were about amid following warns exploited exploit actively critical million thousands company affecting wider third party ransomware gang group claims claimed council hits struck stole stolen steals leak leaked leaks records hospital university bank government agency firm giant operator".split(" "));
const words = t => new Set(String(t || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(w => w.length >= 4 && !STOP.has(w)));
/** Two headlines about the same incident from different outlets. */
export function sameStory(a, b) {
  const A = words(a), B = words(b); if (!A.size || !B.size) return false;
  let n = 0; for (const w of A) if (B.has(w)) n++;
  return n >= 2 && n / Math.min(A.size, B.size) >= 0.3;
}

function isoWeek(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${Math.ceil(((t - y0) / DAY + 1) / 7)}`;
}

/** Send up to `max` queued direct messages. Users who blocked the bot are unsubscribed. */
async function drainOutbox(tg, outbox, subs, max, timed) {
  const out = { sent: 0, dropped: 0, removed: false };
  while (outbox.length && out.sent + out.dropped < max) {
    const m = outbox[0];
    try { await timed(tg.send(m.c, m.t)); out.sent++; outbox.shift(); }
    catch (e) {
      if (e?.status === 403 || e?.status === 400) {
        // Blocked, deleted or never started the bot: drop their queue and subscription
        for (let i = outbox.length - 1; i >= 0; i--) if (String(outbox[i].c) === String(m.c)) { outbox.splice(i, 1); out.dropped++; }
        if (subs[m.c]) { delete subs[m.c]; out.removed = true; }
      } else break; // rate limit or network: try again next run
    }
  }
  return out;
}

// ── Commands and buttons (shared by the webhook and the polling fallback) ─────

const CVE_RE = /\bCVE-\d{4}-\d{4,7}\b/i;

async function isChannelAdmin(env, tg, userId, timed) {
  try {
    const member = await timed(tg.call("getChatMember", { chat_id: String(env.TELEGRAM_CHANNEL).trim(), user_id: userId }));
    return member?.status === "creator" || member?.status === "administrator";
  } catch { return false; }
}

/**
 * Handle one Telegram update. `ctx` gives the snapshot and the subscriber map;
 * returns { handled, subsChanged }. Never throws.
 */
export async function handleUpdate(env, update, ctx) {
  const { tg, timed, now } = ctx;
  const out = { handled: 0, posted: 0, subsChanged: false };
  const subs = ctx.subs;
  try {
    // Button taps in the industry picker
    const cq = update.callback_query;
    if (cq) {
      const chat = cq.message?.chat?.id; if (chat == null || cq.message.chat.type !== "private") return out;
      const key = String(chat);
      const cur = new Set(subs[key]?.s || []);
      const data = String(cq.data || "");
      if (data.startsWith("t:") && byId(data.slice(2))) { const id = data.slice(2); cur.has(id) ? cur.delete(id) : cur.add(id); }
      else if (data === "all") ALL_CHOICES.forEach(s => cur.add(s.id));
      else if (data === "none") cur.clear();
      const chosen = ALL_CHOICES.map(s => s.id).filter(id => cur.has(id));
      if (chosen.length) subs[key] = { s: chosen, at: subs[key]?.at || now }; else delete subs[key];
      out.subsChanged = true;
      if (data === "done") {
        await timed(tg.call("answerCallbackQuery", { callback_query_id: cq.id, text: chosen.length ? "Saved" : "No industries selected" })).catch(() => {});
        await timed(tg.call("editMessageReplyMarkup", { chat_id: chat, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [] } })).catch(() => {});
        if (chosen.length) {
          await timed(tg.send(chat, `✅ <b>Saved.</b> You'll get must-act alerts and a 9:00 am IST brief for:\n${esc(sectorList(chosen))}\n\nHere's your brief for right now 👇`));
          const d = await ctx.payload();
          if (d) await timed(tg.send(chat, formatPersonalBrief(d, chosen, now)));
        } else {
          await timed(tg.send(chat, "No industries selected, so no direct messages. Send /industries any time to choose."));
        }
      } else {
        await timed(tg.call("answerCallbackQuery", { callback_query_id: cq.id })).catch(() => {});
        await timed(tg.call("editMessageReplyMarkup", { chat_id: chat, message_id: cq.message.message_id, reply_markup: industryKeyboard(chosen) })).catch(() => {});
      }
      out.handled++;
      return out;
    }

    const m = update.message;
    if (!m || m.chat?.type !== "private" || typeof m.text !== "string") return out;
    const chat = m.chat.id, key = String(chat);
    const text = m.text.trim();
    const [rawCmd, ...args] = text.split(/\s+/);
    const cmd = rawCmd.startsWith("/") ? rawCmd.split("@")[0].toLowerCase() : "";
    const reply = (t, markup) => timed(tg.send(chat, t, markup)).catch(() => {});
    const chosen = subs[key]?.s || [];

    if (cmd === "/start" || cmd === "/industries" || cmd === "/sectors" || cmd === "/settings") {
      await reply(cmd === "/start" ? WELCOME : "Tap to change your industries, then press <b>Done</b>.", industryKeyboard(chosen));
    } else if (cmd === "/brief") {
      const d = await ctx.payload();
      if (!d) await reply("The feed is refreshing, try again in a minute.");
      else if (/^all$/i.test(args[0] || "") || !chosen.length) await reply(formatDigest(pickDigest(d), now, { payload: d }) + (chosen.length ? "" : "\n\nTip: /industries to get a brief for your industry only."));
      else await reply(formatPersonalBrief(d, chosen, now));
    } else if (cmd === "/cve" || (!cmd && CVE_RE.test(text))) {
      const id = (text.match(CVE_RE) || [])[0];
      if (!id) await reply("Send a CVE ID, for example <code>/cve CVE-2026-1234</code>.");
      else { const d = await ctx.payload(); await reply(d ? formatCve(d, id.toUpperCase()) : "The feed is refreshing, try again in a minute."); }
    } else if (cmd === "/stop") {
      if (subs[key]) { delete subs[key]; out.subsChanged = true; }
      await reply("🔕 Direct messages stopped. You can still follow the channel" + (channelUrl(env) ? `: ${esc(channelUrl(env))}` : ".") + "\n\nSend /industries to start again.");
    } else if (cmd === "/test") {
      if (!(await isChannelAdmin(env, tg, m.from?.id, timed))) { await reply("Sorry, only the owner of the BCyberAware channel can use /test."); return out; }
      try {
        const d = await ctx.payload();
        await timed(tg.send(env.TELEGRAM_CHANNEL, formatTest(d, now)));
        // Also show the current top threat in the full alert format, with its buttons
        const top = d ? pickDigest(d)[0] : null;
        if (top) {
          const me = await timed(tg.call("getMe")).catch(() => null);
          await timed(tg.send(env.TELEGRAM_CHANNEL, formatAlert(top), alertButtons(top, me?.username))).catch(() => {});
        }
        await reply(`✅ Test message posted to ${esc(env.TELEGRAM_CHANNEL)}, with a sample alert in the new format.`);
        out.handled++; out.posted = 1;
      } catch (e) { await reply(`❌ Could not post to the channel: ${esc(String(e?.message || e).slice(0, 120))}`); }
      return out;
    } else if (cmd === "/help") {
      await reply(HELP + (channelUrl(env) ? `\n\nChannel: ${esc(channelUrl(env))}` : ""));
    } else {
      await reply(HELP);
    }
    out.handled++;
  } catch {}
  return out;
}

/** Polling fallback (no webhook): read new messages with getUpdates. */
async function pollCommands(env, payload, state, now, tg, timed, store) {
  const out = { handled: 0, changed: false };
  const updates = await timed(tg.call("getUpdates", { offset: state.update_offset || 0, timeout: 0, limit: 20, allowed_updates: ["message", "callback_query"] }));
  if (!updates?.length) return out;
  state.update_offset = Math.max(...updates.map(u => u.update_id)) + 1; // acknowledge everything fetched
  out.changed = true;
  const subs = await kvJson(store, SUBS_KEY, {});
  let subsChanged = false;
  for (const u of updates.slice(-3)) {
    const r = await handleUpdate(env, u, { tg, timed, now, subs, payload: async () => payload });
    out.handled += r.posted; if (r.subsChanged) subsChanged = true;
  }
  if (subsChanged) { try { await store.put(SUBS_KEY, JSON.stringify(subs)); } catch {} }
  return out;
}

// ── Webhook (instant replies) ─────────────────────────────────────────────────

/** POST /api/telegram — called by Telegram for every message or button tap. */
export async function handleTelegramWebhook(request, env, { loadPayload, fetchImpl = fetch, now = Date.now(), timeoutMs = 5000 } = {}) {
  if (request.method !== "POST") return new Response("method not allowed", { status: 405 });
  if (!telegramConfigured(env)) return new Response("not configured", { status: 404 });
  const got = request.headers.get("x-telegram-bot-api-secret-token") || "";
  if (got !== (await webhookSecret(env))) return new Response("forbidden", { status: 403 });
  let update; try { update = await request.json(); } catch { return new Response("ok"); }
  const store = env.FEED_KV;
  if (!store) return new Response("ok");

  const timed = p => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), timeoutMs))]);
  const tg = client(env, fetchImpl, 40);
  const subs = await kvJson(store, SUBS_KEY, {});
  let cached;
  const payload = async () => (cached ??= loadPayload ? await loadPayload().catch(() => null) : null);
  const r = await handleUpdate(env, update, { tg, timed, now, subs, payload });
  if (r.subsChanged) { try { await store.put(SUBS_KEY, JSON.stringify(subs)); } catch {} }

  // Use this call's spare request budget to deliver a few queued direct messages
  try {
    const outbox = await kvJson(store, OUTBOX_KEY, []);
    if (outbox.length) {
      const dr = await drainOutbox(tg, outbox, subs, Math.min(WEBHOOK_DM_BUDGET, tg.left), timed);
      if (dr.sent || dr.dropped) await store.put(OUTBOX_KEY, JSON.stringify(outbox));
      if (dr.removed) await store.put(SUBS_KEY, JSON.stringify(subs));
    }
  } catch {}
  return new Response("ok");
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
      bot: st.bot_username ? `@${st.bot_username}` : null,
      instant_replies: !!st.webhook,
      poll_sent_for: st.poll_week || null,
      news_posted_today: st.news_day ? (st.news_count || 0) : 0,
      roundup_sent_for: st.roundup_day || null,
      industry_subscribers: Object.keys((await store.get(SUBS_KEY, { type: "json" })) || {}).length,
      direct_messages_queued: ((await store.get(OUTBOX_KEY, { type: "json" })) || []).length,
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
