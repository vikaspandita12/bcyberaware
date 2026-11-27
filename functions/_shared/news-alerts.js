/**
 * Breaking incident news for Telegram: data breaches, ransomware attacks,
 * cyberattacks on named organisations, and zero-days under active attack.
 *
 * The priority score is built for vulnerabilities (exploitation, EPSS, CVSS), so a
 * story like "hackers stole customer data from a retailer" scores low and was never
 * posted. This module picks those stories out by what they describe, from
 * established news outlets only, so the channel also carries the day's major news.
 */
import { sectorsOf, byId } from "./sectors.js";

// Outlets whose items are never treated as breaking news (chatter, unverified, or video links)
const NOT_NEWS_SOURCES = /telegram: darkfeed|mastodon|bluesky|reddit|hacker news \(yc\)|infosec\.exchange/i;

// What is NOT an incident report even if it mentions one
const NOT_INCIDENT = /\b(raises|funding|\$\d+(\.\d+)?\s?(m|million|b|billion)\b.*(round|seed|series)|emerges from stealth|acquires|acquisition|guidelines?|framework for|webinar|podcast|how to|tips|explained|what is|week in review|weekly recap|recap|roundup|survey|report finds|study|predictions|researchers (uncover|find|discover)|tally|boasts|opinion|interview|sponsored)\b/i;

const KINDS = [
  { kind: "ransomware", emoji: "💀", label: "RANSOMWARE ATTACK", tag: "Ransomware",
    re: /ransomware (attack|gang|group|hits?|struck|claims?)|(hit|struck|crippled|disrupted) by ransomware|ransomware.*(claimed|attack on|hits?)|claimed by .* (ransomware|group)/i },
  { kind: "breach", emoji: "🔓", label: "DATA BREACH", tag: "DataBreach",
    re: /\bdata breach\b|\bbreach(ed)?\b.*\b(data|customers?|users?|patients?|records|accounts|employees)|\b(stole|stolen|steal(s|ing)?)\b.*\b(data|records|credentials|information|emails?|passwords|files)|\bleak(ed|s)?\b.*\b(data|records|customer|passwords|secrets|keys|emails?)|\bexpos(es|ed)\b.*\b(customer|user|patient|personal|sensitive|records|data|passwords|secrets|keys)|\bhackers? (claim|say|leak|sell|dump)|(million|thousand|\d+k)\b.*\b(records|customers|users|accounts|email addresses)/i },
  { kind: "attack", emoji: "⚠️", label: "CYBERATTACK", tag: "Cyberattack",
    re: /\bcyber ?-?attack(ed|s)?\b|\b(was|were|been|got) hacked\b|\bhacked\b|\bsystems? (down|outage|offline)\b.*(attack|hack)|\bshuts? down\b.*(attack|hack|breach)|\bextortion\b|\bdisrupt(s|ed|ion)\b.*\b(attack|hackers)/i },
  { kind: "zeroday", emoji: "🔥", label: "ZERO-DAY UNDER ATTACK", tag: "ZeroDay",
    re: /\bzero[- ]?day\b.*\b(exploit(ed)?|attack|under|abused|in the wild)|\bactively exploited\b|\bexploited in (the )?wild\b|\bunder (active )?attack\b|\bhackers (exploit|abuse|target)\b/i },
];

export function classifyNews(a) {
  if (!a || !a.title) return null;
  if (a.category && a.category !== "news") return null;
  if (NOT_NEWS_SOURCES.test(a.source || "")) return null;
  const title = String(a.title);
  if (NOT_INCIDENT.test(title)) return null;
  // Decide on the headline; the summary only confirms (headlines are what outlets stand behind)
  for (const k of KINDS) if (k.re.test(title)) return k;
  return null;
}

const DO_NEXT = {
  breach: "If you use or supply this organisation: expect phishing that uses the stolen data, reset any shared passwords, and rotate API keys or tokens you gave them.",
  ransomware: "Check your own exposure to the usual entry points (VPN, remote access, unpatched edge devices) and confirm your offline backups restore cleanly.",
  attack: "If they are your supplier or partner, ask them for an incident update and review the access they have into your systems.",
  zeroday: "Patch as soon as a fix is available; until then apply the vendor's mitigations and look for signs of compromise.",
};

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cut = (s, n) => { s = String(s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const cleanSummary = s => String(s || "").replace(/https?:\/\/\S+/g, "").replace(/@\w+/g, "").replace(/\s+/g, " ").trim();
const DAY = 24 * 60 * 60 * 1000;

/** Rank: corroborated stories first, then breaches/ransomware over generic attacks, then newest. */
const KIND_WEIGHT = { ransomware: 3, breach: 3, zeroday: 2, attack: 2 };
const rank = (x, y) => (y.sources_count || 1) - (x.sources_count || 1) || KIND_WEIGHT[y._kind.kind] - KIND_WEIGHT[x._kind.kind] || (y.ts || 0) - (x.ts || 0);

/** Incident stories from the last `maxAgeMs`, best first. */
export function incidentNews(payload, now, maxAgeMs = DAY) {
  const items = [...(payload?.news || []), ...(payload?.advisories || []), ...(payload?.exploits || [])];
  const out = [];
  for (const a of items) {
    if ((now - (a.ts || 0)) > maxAgeMs || (a.ts || 0) > now + 3600e3) continue;
    const k = classifyNews(a);
    if (!k) continue;
    out.push(Object.assign(Object.create(a), a, { _kind: k }));
  }
  return out.sort(rank);
}

export function formatNewsAlert(a) {
  const k = a._kind || classifyNews(a);
  const lines = [`${k.emoji} <b>${k.label}</b> · breaking`, `<b>${esc(cut(a.title, 220))}</b>`];
  const sum = cleanSummary(a.summary);
  if (sum && sum.toLowerCase() !== String(a.title).toLowerCase()) lines.push(esc(cut(sum, 300)));
  const ind = sectorsOf(a).map(id => byId(id)).filter(Boolean).map(s => `${s.emoji} ${s.name.replace(/ \(.*\)$/, "")}`).join(" · ");
  lines.push(`<b>Industries:</b> ${esc(ind)}`);
  const others = (a.also || []).map(o => o.source).filter(Boolean);
  const srcLink = a.source_url ? `<a href="${esc(a.source_url)}">${esc(a.source)}</a>` : esc(a.source);
  lines.push(`<b>Reported by:</b> ${srcLink}${others.length ? ` + ${esc(others.slice(0, 2).join(", "))}${others.length > 2 ? ` (+${others.length - 2} more)` : ""}` : ""}`);
  const doNext = k.kind === "zeroday" && a.action?.do_now ? a.action.do_now : DO_NEXT[k.kind];
  lines.push(`🛡️ <b>What to do:</b> ${esc(cut(doNext, 300))}`);
  if (a.cve_ids?.length) lines.push(a.cve_ids.slice(0, 3).map(c => `<code>${esc(c)}</code>`).join(" "));
  const tags = ["#" + k.tag, ...sectorsOf(a).map(id => "#" + byId(id).tag), "#News"];
  lines.push([...new Set(tags)].join(" "));
  return lines.join("\n\n").slice(0, 4000);
}

export function newsButtons(a, botUsername, site) {
  const row = [];
  if (a.source_url) row.push({ text: "📰 Read the story", url: a.source_url });
  row.push({ text: "📊 Dashboard", url: site });
  const rows = [row];
  if (botUsername) rows.push([{ text: "🎯 Get alerts for my industry", url: `https://t.me/${botUsername}?start=industries` }]);
  return { inline_keyboard: rows };
}

/** Evening roundup: the day's most important security news, incidents first. */
export function pickRoundup(payload, now, n = 8) {
  const seen = new Set(), out = [];
  const incidents = incidentNews(payload, now, DAY);
  const rest = (payload?.news || [])
    .filter(a => (now - (a.ts || 0)) <= DAY && !NOT_NEWS_SOURCES.test(a.source || "") && !NOT_INCIDENT.test(a.title || ""))
    .sort((x, y) => (y.sources_count || 1) - (x.sources_count || 1) || (y.priority?.score || 0) - (x.priority?.score || 0) || (y.ts || 0) - (x.ts || 0));
  for (const a of [...incidents, ...rest]) {
    const key = String(a.title).toLowerCase().replace(/[^a-z0-9]+/g, " ").slice(0, 60);
    if (seen.has(a.id) || seen.has(key)) continue;
    seen.add(a.id); seen.add(key);
    out.push(a);
    if (out.length === n) break;
  }
  return out;
}

export function formatRoundup(items, now, site) {
  const day = new Date(now).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
  const rows = items.map((a, i) => {
    const k = a._kind || classifyNews(a);
    const icon = k ? k.emoji : "📰";
    const title = a.source_url ? `<a href="${esc(a.source_url)}">${esc(cut(a.title, 140))}</a>` : esc(cut(a.title, 140));
    const more = (a.sources_count || 1) > 1 ? ` (+${a.sources_count - 1})` : "";
    return `${i + 1}. ${icon} ${title}\n   <i>${esc(a.source)}${more}</i>`;
  });
  return [
    `🌆 <b>Today in cyber · ${esc(day)}</b>`,
    `The ${items.length} security stories that matter today. Breaches and attacks first:`,
    rows.join("\n\n"),
    `Everything in one place: <a href="${site}">advisory.bcyberaware.co.in</a>`,
    "#TodayInCyber #News",
  ].join("\n\n").slice(0, 4000);
}
