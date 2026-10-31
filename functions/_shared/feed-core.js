/**
 * BCyberAware – Live Threat Feed v3 (Cloudflare Workers)
 *
 * Architecture:
 *  - Declarative SOURCE REGISTRY — every source runs with its own timeout,
 *    latency measurement, and error capture (no single slow feed can stall the rest).
 *  - source_health[] telemetry returned to the UI → real LIVE/DOWN status board.
 *  - breaking[] — incident-grade items (<48h, breach/hack/zero-day language) for the ticker.
 *  - stale-while-error: if a refresh collapses (<10 items), the previous good
 *    snapshot is served instead of a broken page.
 *
 * Cache: 2 hours (in-memory per isolate)
 */

import { jsonResponse } from "./http.js";

const CACHE    = {};
const CACHE_MS = 2 * 60 * 60 * 1000; // 2 hours
const FETCH_TIMEOUT_MS = 9000;

const UA = { "User-Agent": "Mozilla/5.0 (compatible; BCyberAware/3.0; +https://advisory.bcyberaware.co.in)" };

// ── Resilient fetch with per-source timeout ───────────────────────────────────
async function fetchWithTimeout(url, ms = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort("timeout"), ms);
  try {
    return await fetch(url, { headers: UA, signal: ctrl.signal, redirect: "follow" });
  } finally {
    clearTimeout(t);
  }
}

// ── Source registry ───────────────────────────────────────────────────────────
// cat: advisory | exploit | news   ·  fn returns normalized item[]
const SOURCES = [
  { key: "cisa_kev",     name: "CISA KEV",               flag: "🇺🇸", cat: "advisory", fn: fetchCISAKEV },
  { key: "cisa_alerts",  name: "CISA Alerts",            flag: "🇺🇸", cat: "advisory", fn: fetchCISAAlerts },
  { key: "nvd",          name: "NVD / CVE.org",          flag: "🌐", cat: "advisory", fn: fetchNVDCritical },
  { key: "ghsa",         name: "GitHub Advisory (GHSA)", flag: "🐙", cat: "advisory", fn: fetchGitHubAdvisories },
  { key: "certin",       name: "CERT-In (India)",        flag: "🇮🇳", cat: "advisory", fn: fetchCERTIn },
  { key: "ncsc_uk",      name: "NCSC UK",                flag: "🇬🇧", cat: "advisory", fn: () => rss("https://www.ncsc.gov.uk/api/1/services/v1/news-rss-feed.xml", { id_prefix: "NCSC-UK", source: "NCSC UK", source_url: "https://www.ncsc.gov.uk", source_color: "#003078", source_flag: "🇬🇧", category: "advisory", default_sev: "HIGH", patch_avail: true, limit: 12, countries: ["GB"] }) },
  { key: "cert_eu",      name: "CERT-EU",                flag: "🇪🇺", cat: "advisory", fn: () => rss("https://cert.europa.eu/publications/security-advisories-rss", { id_prefix: "CERTEU", source: "CERT-EU", source_url: "https://cert.europa.eu", source_color: "#003399", source_flag: "🇪🇺", category: "advisory", default_sev: "HIGH", patch_avail: true, limit: 12, countries: ["DE", "FR", "NL", "IT", "ES"] }) },
  { key: "jpcert",       name: "JPCERT/CC (Japan)",      flag: "🇯🇵", cat: "advisory", fn: () => rss("https://www.jpcert.or.jp/english/rss/jpcert-en.rdf", { id_prefix: "JPCERT", source: "JPCERT/CC", source_url: "https://www.jpcert.or.jp/english/", source_color: "#bc002d", source_flag: "🇯🇵", category: "advisory", default_sev: "HIGH", patch_avail: true, limit: 10, countries: ["JP", "SG", "KR"] }) },
  { key: "cis_adv",      name: "CIS Security Advisories",flag: "🛡️", cat: "advisory", fn: () => rss("https://www.cisecurity.org/feed/advisories", { id_prefix: "CIS", source: "CIS Advisories", source_url: "https://www.cisecurity.org/advisory", source_color: "#005a9c", source_flag: "🛡️", category: "advisory", default_sev: "HIGH", patch_avail: true, limit: 12, countries: ["US", "CA", "GB", "AE"] }) },
  { key: "cisco_psirt",  name: "Cisco PSIRT",            flag: "🛡️", cat: "advisory", fn: () => rss("https://sec.cloudapps.cisco.com/security/center/psirtrss20/CiscoSecurityAdvisory.xml", { id_prefix: "CISCO", source: "Cisco PSIRT", source_url: "https://sec.cloudapps.cisco.com/security/center/publicationListing.x", source_color: "#049fd9", source_flag: "🛡️", category: "advisory", default_sev: "HIGH", patch_avail: true, limit: 12, countries: ["US", "GB", "DE", "AE", "SA", "IN"] }) },
  { key: "pan_psirt",    name: "Palo Alto PSIRT",        flag: "🔥", cat: "advisory", fn: () => rss("https://security.paloaltonetworks.com/rss.xml", { id_prefix: "PANSA", source: "Palo Alto PSIRT", source_url: "https://security.paloaltonetworks.com", source_color: "#fa582d", source_flag: "🔥", category: "advisory", default_sev: "HIGH", patch_avail: true, limit: 12, countries: ["US", "GB", "AE", "SA", "IN"] }) },
  { key: "forti_psirt",  name: "FortiGuard PSIRT",       flag: "🧱", cat: "advisory", fn: () => rss("https://www.fortiguard.com/rss/ir.xml", { id_prefix: "FGIR", source: "FortiGuard PSIRT", source_url: "https://www.fortiguard.com/psirt", source_color: "#ee3124", source_flag: "🧱", category: "advisory", default_sev: "HIGH", patch_avail: true, limit: 12, countries: ["US", "GB", "DE", "AE", "SA", "IN"] }) },
  { key: "ms_security",  name: "Microsoft Security",     flag: "🇺🇸", cat: "advisory", fn: () => rss("https://www.microsoft.com/en-us/security/blog/feed/", { id_prefix: "MSSEC", source: "Microsoft Security", source_url: "https://www.microsoft.com/en-us/security/blog/", source_color: "#0078d4", source_flag: "🇺🇸", category: "advisory", default_sev: "HIGH", patch_avail: true, limit: 10, countries: ["US", "GB", "DE", "AE", "SA", "IN"] }) },

  { key: "exploitdb",    name: "Exploit-DB",             flag: "⚡", cat: "exploit", fn: () => rss("https://www.exploit-db.com/rss.xml", { id_prefix: "EDBID", source: "Exploit-DB", source_url: "https://www.exploit-db.com", source_color: "#cc0000", source_flag: "⚡", category: "exploit", default_sev: "HIGH", exploit_wild: true, limit: 20, countries: ["US", "RU", "CN"] }) },
  { key: "zdi",          name: "ZDI 0-Day Pipeline",     flag: "🧨", cat: "exploit", fn: () => rss("https://www.zerodayinitiative.com/rss/upcoming/", { id_prefix: "ZDI", source: "ZDI 0-Day Pipeline", source_url: "https://www.zerodayinitiative.com/advisories/upcoming/", source_color: "#d32f2f", source_flag: "🧨", category: "exploit", default_sev: "HIGH", exploit_wild: false, limit: 20, countries: ["US", "GB", "DE", "JP"] }) },

  { key: "thn",          name: "The Hacker News",        flag: "📰", cat: "news", fn: () => rss("https://feeds.feedburner.com/TheHackersNews", { id_prefix: "THN", source: "The Hacker News", source_url: "https://thehackernews.com", source_color: "#e91e63", source_flag: "📰", category: "news", default_sev: "HIGH", limit: 15, countries: ["US", "CN", "RU", "IR"] }) },
  { key: "bleeping",     name: "Bleeping Computer",      flag: "📰", cat: "news", fn: () => rss("https://www.bleepingcomputer.com/feed/", { id_prefix: "BC", source: "Bleeping Computer", source_url: "https://www.bleepingcomputer.com", source_color: "#2196f3", source_flag: "📰", category: "news", default_sev: "MEDIUM", limit: 15, countries: ["US", "RU", "CN"] }) },
  { key: "therecord",    name: "The Record",             flag: "🎙️", cat: "news", fn: () => rss("https://therecord.media/feed", { id_prefix: "TRECORD", source: "The Record", source_url: "https://therecord.media", source_color: "#111827", source_flag: "🎙️", category: "news", default_sev: "HIGH", limit: 12, countries: ["US", "RU", "CN", "UA"] }) },
  { key: "cyberscoop",   name: "CyberScoop",             flag: "📰", cat: "news", fn: () => rss("https://cyberscoop.com/feed/", { id_prefix: "CSCOOP", source: "CyberScoop", source_url: "https://cyberscoop.com", source_color: "#00b0ff", source_flag: "📰", category: "news", default_sev: "HIGH", limit: 10, countries: ["US"] }) },
  { key: "secaffairs",   name: "Security Affairs",       flag: "📰", cat: "news", fn: () => rss("https://securityaffairs.com/feed", { id_prefix: "SECAFF", source: "Security Affairs", source_url: "https://securityaffairs.com", source_color: "#263238", source_flag: "📰", category: "news", default_sev: "HIGH", limit: 12, countries: ["US", "GB", "IT", "RU", "CN"] }) },
  { key: "hackread",     name: "HackRead",               flag: "📰", cat: "news", fn: () => rss("https://hackread.com/feed/", { id_prefix: "HREAD", source: "HackRead", source_url: "https://hackread.com", source_color: "#37474f", source_flag: "📰", category: "news", default_sev: "MEDIUM", limit: 10, countries: ["US", "GB", "PK", "IN"] }) },
  { key: "register",     name: "The Register Security",  flag: "🇬🇧", cat: "news", fn: () => rss("https://www.theregister.com/security/headlines.atom", { id_prefix: "ELREG", source: "The Register", source_url: "https://www.theregister.com/security/", source_color: "#ff0000", source_flag: "🇬🇧", category: "news", default_sev: "MEDIUM", limit: 12, countries: ["GB", "US"] }) },
  { key: "sans",         name: "SANS ISC",               flag: "🔍", cat: "news", fn: () => rss("https://isc.sans.edu/rssfeed.xml", { id_prefix: "SANS", source: "SANS ISC", source_url: "https://isc.sans.edu", source_color: "#ff9800", source_flag: "🔍", category: "news", default_sev: "MEDIUM", limit: 12, countries: ["US"] }) },
  { key: "secweek",      name: "SecurityWeek",           flag: "📰", cat: "news", fn: () => rss("https://feeds.feedburner.com/securityweek", { id_prefix: "SECWK", source: "SecurityWeek", source_url: "https://www.securityweek.com", source_color: "#1565c0", source_flag: "📰", category: "news", default_sev: "HIGH", limit: 12, countries: ["US", "CN", "RU", "IR"] }) },
  { key: "krebs",        name: "Krebs on Security",      flag: "📰", cat: "news", fn: () => rss("https://krebsonsecurity.com/feed/", { id_prefix: "KREBS", source: "Krebs on Security", source_url: "https://krebsonsecurity.com", source_color: "#4a148c", source_flag: "📰", category: "news", default_sev: "HIGH", limit: 10, countries: ["US", "RU", "CN"] }) },
  { key: "talos",        name: "Cisco Talos",            flag: "🛡️", cat: "news", fn: () => rss("https://blog.talosintelligence.com/rss/", { id_prefix: "TALOS", source: "Cisco Talos", source_url: "https://blog.talosintelligence.com", source_color: "#049fd9", source_flag: "🛡️", category: "news", default_sev: "HIGH", limit: 12, countries: ["US", "GB", "DE", "AE", "SA"] }) },
  { key: "unit42",       name: "Unit 42 (Palo Alto)",    flag: "🔬", cat: "news", fn: () => rss("https://unit42.paloaltonetworks.com/feed/", { id_prefix: "UNIT42", source: "Unit 42", source_url: "https://unit42.paloaltonetworks.com", source_color: "#fa582d", source_flag: "🔬", category: "news", default_sev: "HIGH", limit: 10, countries: ["US", "GB", "AE", "SA"] }) },
  { key: "checkpoint",   name: "Check Point Research",   flag: "🔬", cat: "news", fn: () => rss("https://research.checkpoint.com/feed/", { id_prefix: "CPR", source: "Check Point Research", source_url: "https://research.checkpoint.com", source_color: "#e8308a", source_flag: "🔬", category: "news", default_sev: "HIGH", limit: 10, countries: ["US", "IL", "GB", "AE"] }) },
  { key: "crowdstrike",  name: "CrowdStrike Threat Intel",flag: "🦅", cat: "news", fn: () => rss("https://www.crowdstrike.com/en-us/blog/feed", { id_prefix: "CRWD", source: "CrowdStrike", source_url: "https://www.crowdstrike.com/en-us/blog/", source_color: "#e01f27", source_flag: "🦅", category: "news", default_sev: "HIGH", limit: 10, countries: ["US", "GB", "DE", "AE", "IN"] }) },
  { key: "mandiant",     name: "Mandiant (Google Cloud)",flag: "🔥", cat: "news", fn: () => rss("https://cloudblog.withgoogle.com/topics/threat-intelligence/rss/", { id_prefix: "MNDT", source: "Mandiant", source_url: "https://cloud.google.com/blog/topics/threat-intelligence", source_color: "#ea4335", source_flag: "🔥", category: "news", default_sev: "HIGH", limit: 10, countries: ["US", "CN", "RU", "IR", "KP"] }) },
  { key: "sophos",       name: "Sophos X-Ops",           flag: "🛡️", cat: "news", fn: () => rss("https://news.sophos.com/en-us/category/threat-research/feed/", { id_prefix: "SOPHOS", source: "Sophos X-Ops", source_url: "https://news.sophos.com/en-us/category/threat-research/", source_color: "#005bc8", source_flag: "🛡️", category: "news", default_sev: "HIGH", limit: 10, countries: ["US", "GB", "IN", "AE"] }) },
  { key: "rapid7",       name: "Rapid7 Emergent Threats",flag: "🚀", cat: "news", fn: () => rss("https://blog.rapid7.com/rss/", { id_prefix: "R7", source: "Rapid7", source_url: "https://www.rapid7.com/blog/", source_color: "#e85d00", source_flag: "🚀", category: "news", default_sev: "HIGH", limit: 10, countries: ["US", "GB", "DE"] }) },
  { key: "darkreading",  name: "Dark Reading",           flag: "📰", cat: "news", fn: () => rss("https://www.darkreading.com/rss.xml", { id_prefix: "DARKRD", source: "Dark Reading", source_url: "https://www.darkreading.com", source_color: "#c62828", source_flag: "📰", category: "news", default_sev: "HIGH", limit: 12, countries: ["US", "GB", "DE"] }) },
  { key: "gbhackers",    name: "GBHackers",              flag: "📰", cat: "news", fn: () => rss("https://gbhackers.com/feed/", { id_prefix: "GBH", source: "GBHackers", source_url: "https://gbhackers.com", source_color: "#1b5e20", source_flag: "📰", category: "news", default_sev: "MEDIUM", limit: 10, countries: ["US", "IN"] }) },
  { key: "p0",           name: "Google Project Zero",    flag: "🔬", cat: "news", fn: () => rss("https://googleprojectzero.blogspot.com/feeds/posts/default", { id_prefix: "P0", source: "Google Project Zero", source_url: "https://googleprojectzero.blogspot.com", source_color: "#4285f4", source_flag: "🔬", category: "news", default_sev: "HIGH", exploit_wild: true, limit: 8, countries: ["US", "GB"] }) },
  { key: "malwarebytes", name: "Malwarebytes Labs",      flag: "📰", cat: "news", fn: () => rss("https://www.malwarebytes.com/blog/feed/index.xml", { id_prefix: "MBAM", source: "Malwarebytes Labs", source_url: "https://www.malwarebytes.com/blog", source_color: "#0d47a1", source_flag: "📰", category: "news", default_sev: "MEDIUM", limit: 10, countries: ["US", "GB"] }) },
  { key: "helpnet",      name: "Help Net Security",      flag: "📰", cat: "news", fn: () => rss("https://www.helpnetsecurity.com/feed/", { id_prefix: "HNS", source: "Help Net Security", source_url: "https://www.helpnetsecurity.com", source_color: "#1565c0", source_flag: "📰", category: "news", default_sev: "MEDIUM", limit: 12, countries: ["US", "GB", "DE"] }) },
  { key: "infosecmag",   name: "Infosecurity Magazine",  flag: "📰", cat: "news", fn: () => rss("https://www.infosecurity-magazine.com/rss/news/", { id_prefix: "INFOSEC", source: "Infosecurity Magazine", source_url: "https://www.infosecurity-magazine.com", source_color: "#004d40", source_flag: "📰", category: "news", default_sev: "MEDIUM", limit: 10, countries: ["US", "GB", "DE"] }) },
  { key: "schneier",     name: "Schneier on Security",   flag: "📰", cat: "news", fn: () => rss("https://www.schneier.com/feed/atom/", { id_prefix: "SCHNEIER", source: "Schneier on Security", source_url: "https://www.schneier.com", source_color: "#5d4037", source_flag: "📰", category: "news", default_sev: "MEDIUM", limit: 8, countries: ["US"] }) },
  { key: "ars",          name: "Ars Technica Security",  flag: "📰", cat: "news", filtered: true, fn: fetchArsTechnica },
  { key: "telegram",     name: "Telegram: DarkFeed",     flag: "📡", cat: "news", fn: fetchTelegramDarkFeed },
  { key: "hindu",        name: "The Hindu Tech",         flag: "🇮🇳", cat: "news", filtered: true, fn: fetchTheHindu },
  { key: "econtimes",    name: "Economic Times IT",      flag: "🇮🇳", cat: "news", filtered: true, fn: fetchEconomicTimes },

  // ── Social / community intelligence (all free public APIs — no keys) ──
  { key: "infosec_exchange", name: "infosec.exchange (Mastodon)", flag: "🐘", cat: "social", filtered: true, fn: fetchInfosecExchange },
  { key: "mastodon_tag",     name: "Mastodon #cybersecurity",     flag: "🐘", cat: "social", fn: () => rss("https://mastodon.social/tags/cybersecurity.rss", { id_prefix: "MSTDN", source: "Mastodon #cybersecurity", source_url: "https://mastodon.social/tags/cybersecurity", source_color: "#6364ff", source_flag: "🐘", category: "social", default_sev: "LOW", limit: 15, countries: ["US", "DE", "GB"] }) },
  { key: "bluesky",          name: "Bluesky",                     flag: "🦋", cat: "social", fn: fetchBluesky },
  { key: "hn",               name: "Hacker News (YC)",            flag: "🟠", cat: "social", filtered: true, fn: fetchHackerNewsYC },
  { key: "reddit_netsec",    name: "Reddit r/netsec",             flag: "👽", cat: "social", fn: () => rss("https://www.reddit.com/r/netsec/.rss", { id_prefix: "RNETSEC", source: "Reddit r/netsec", source_url: "https://www.reddit.com/r/netsec/", source_color: "#ff4500", source_flag: "👽", category: "social", default_sev: "LOW", limit: 15, countries: ["US"] }) },
];

// ── Live context for the AI Threat Analyst (compact, token-budgeted) ──────────
export function getFeedContext(maxChars = 6000) {
  const d = CACHE.feed?.data;
  if (!d) return null;
  const line = a => `- [${a.severity}] ${a.title}${a.cve_ids?.length ? " (" + a.cve_ids.slice(0, 2).join(", ") + ")" : ""} — ${a.source}, ${a.date}${a.exploit_in_wild ? " · EXPLOITED IN WILD" : ""}${a.threat_actor ? " · " + a.threat_actor : ""}`;
  const sections = [
    ["BREAKING (last 48h)", (d.breaking || []).slice(0, 8).map(b => `- ${b.title} — ${b.source}`)],
    ["TOP ADVISORIES", (d.advisories || []).slice(0, 14).map(line)],
    ["EXPLOITS / 0-DAY PIPELINE", (d.exploits || []).slice(0, 8).map(line)],
    ["SECURITY NEWS", (d.news || []).slice(0, 14).map(a => `- ${a.title} — ${a.source}, ${a.date}`)],
    ["COMMUNITY CHATTER (social, unverified)", (d.social || []).slice(0, 6).map(a => `- ${a.title} — ${a.source}`)],
    ["THREAT HEATMAP (top countries)", [(d.heatmap || []).slice(0, 6).map(h => `${h.name} ${h.score}pts/${h.level}`).join(" · ")]],
  ];
  let out = `Feed snapshot: ${d.fetched_at_human} · ${d.sources_live}/${d.sources_total} sources live\n`;
  for (const [title, lines] of sections) {
    const block = `\n## ${title}\n${lines.join("\n")}\n`;
    if (out.length + block.length > maxChars) break;
    out += block;
  }
  return out;
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function handleFeedRequest(request, env) {
  const url    = new URL(request.url);
  const action = url.searchParams.get("action");
  const bust   = url.searchParams.get("bust") === "1";

  if (action === "brief") return handleBrief(env);
  if (action !== "feed") return jsonResponse({ error: "Unknown action" }, 400);

  try {
    const now = Date.now();
    if (!bust && CACHE.feed && (now - CACHE.feed.ts) < CACHE_MS)
      return jsonResponse({ ...CACHE.feed.data, from_cache: true });

    // Run every source in parallel, each individually timed and fault-isolated
    const runs = await Promise.all(SOURCES.map(async (src) => {
      const t0 = Date.now();
      try {
        const items = (await src.fn()) || [];
        // Keyword-filtered mainstream feeds are "live" even when 0 items match this cycle
        const ok = items.length > 0 || !!src.filtered;
        return { src, items, health: { key: src.key, name: src.name, flag: src.flag, cat: src.cat, ok, items: items.length, ms: Date.now() - t0 } };
      } catch (e) {
        return { src, items: [], health: { key: src.key, name: src.name, flag: src.flag, cat: src.cat, ok: false, items: 0, ms: Date.now() - t0, error: String(e?.message || e).slice(0, 80) } };
      }
    }));

    const byCat = { advisory: [], exploit: [], news: [], social: [] };
    runs.forEach(({ src, items }) => byCat[src.cat].push(...items));
    // Social hygiene: drop job ads/promos, require security relevance in the post body
    // for hashtag streams (hashtag abusers), and strip Reddit's RSS boilerplate.
    byCat.social = byCat.social
      .filter(a => !SOCIAL_SPAM_RE.test(a.title + " " + (a.summary || "")))
      .filter(a => a.source !== "Mastodon #cybersecurity" || isSecurityText(a.title.replace(/#\w+/g, "")))
      .map(a => {
        let s = (a.summary || "").replace(/submitted by\s+\/u\/\S+/gi, "").replace(/\[link\]|\[comments\]/gi, "").replace(/\s{2,}/g, " ").trim();
        if (s.length < 20) s = a.title;
        return { ...a, summary: s };
      });

    const sortAndDedup = arr => {
      arr.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      return dedup(arr);
    };

    const advisories = sortAndDedup(byCat.advisory).slice(0, 80);
    const exploits   = sortAndDedup(byCat.exploit).slice(0, 40);
    const news       = sortAndDedup(byCat.news).slice(0, 110);
    const social     = sortAndDedup(byCat.social).slice(0, 60);

    // Enrich all CVE-bearing items with FIRST.org EPSS (Exploit Prediction Scoring System)
    await enrichWithEPSS([...advisories, ...exploits, ...news, ...social]);

    const payload = {
      advisories, exploits, news, social,
      breaking:      detectBreaking([...advisories, ...exploits, ...news], now),
      heatmap:       buildHeatmap([...byCat.advisory, ...byCat.exploit, ...byCat.news]),
      source_health: runs.map(r => r.health),
      sources_live:  runs.filter(r => r.health.ok).length,
      sources_total: SOURCES.length,
      fetched_at:       now,
      fetched_at_human: new Date().toUTCString(),
      from_cache:       false,
    };

    // Stale-while-error: refuse to replace a good snapshot with a collapsed one
    const totalItems = advisories.length + exploits.length + news.length;
    if (totalItems < 10 && CACHE.feed)
      return jsonResponse({ ...CACHE.feed.data, from_cache: true, degraded: true });

    CACHE.feed = { ts: now, data: payload };
    return jsonResponse(payload);

  } catch (e) {
    if (CACHE.feed) return jsonResponse({ ...CACHE.feed.data, from_cache: true, degraded: true });
    return jsonResponse({ error: e.message }, 500);
  }
}

// ── AI Situation Summary (Workers AI, cached per feed snapshot) ───────────────
// Generated at most once per feed refresh (~2h) → negligible neuron usage.
async function handleBrief(env) {
  const feed = CACHE.feed;
  if (!feed) return jsonResponse({ brief: null, pending: true, reason: "feed not loaded yet" });
  if (CACHE.brief && CACHE.brief.feedTs === feed.ts) return jsonResponse({ ...CACHE.brief.data, from_cache: true });
  if (!env?.AI) return jsonResponse({ brief: null, pending: false, reason: "AI binding not available" });

  const d = feed.data;
  const prompt = `You are a senior cyber threat intelligence analyst writing the opening "Situation Summary" for a CISO dashboard.
Using ONLY the live feed snapshot below, write 3–4 tight sentences (max 110 words) covering: (1) the most important actively-exploited or critical vulnerabilities to patch now (name products and CVEs from the data), (2) the most significant breach/incident headlines, (3) one line on the overall risk posture. Plain prose, no bullet points, no headers, no preamble, no markdown. Do not invent CVEs or facts not in the data.

${getFeedContext(4500)}`;

  try {
    const res = await env.AI.run(env.AI_MODEL || "@cf/meta/llama-3.1-8b-instruct-fast", {
      messages: [{ role: "user", content: prompt }], max_tokens: 260, temperature: 0.2,
    });
    const brief = String(res?.response || "").replace(/\s+/g, " ").trim();
    if (!brief) throw new Error("empty response");
    const data = { brief, generated_at: Date.now(), generated_at_human: new Date().toUTCString(), sources: d.sources_live, items: (d.advisories?.length || 0) + (d.exploits?.length || 0) + (d.news?.length || 0), model: env.AI_MODEL || "@cf/meta/llama-3.1-8b-instruct-fast" };
    CACHE.brief = { feedTs: feed.ts, data };
    return jsonResponse({ ...data, from_cache: false });
  } catch (e) {
    if (CACHE.brief) return jsonResponse({ ...CACHE.brief.data, from_cache: true, stale: true });
    return jsonResponse({ brief: null, pending: false, reason: String(e?.message || e).slice(0, 120) });
  }
}

// ── Breaking-incident detector ────────────────────────────────────────────────
// Incident-grade language + recency → powers the live ticker
const BREAKING_RE = /\b(breach(ed)?|hacked|hack of|ransomware|zero[- ]day|0[- ]day|actively exploited|exploited in the wild|data leak|leaked|stolen|exfiltrat|compromis|defaced|extortion|takedown|supply[- ]chain attack|wiper|ddos attack|credentials? (dump|theft)|millions? of (records|users|accounts)|under attack|emergency (patch|directive))\b/i;

function detectBreaking(items, now) {
  const maxAge = 48 * 60 * 60 * 1000;
  return items
    .filter(a => a.ts && (now - a.ts) < maxAge && BREAKING_RE.test(a.title + " " + (a.summary || "")))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 14)
    .map(a => ({ id: a.id, title: a.title, source: a.source, source_flag: a.source_flag, source_url: a.source_url, severity: a.severity, ts: a.ts }));
}

// ── 1. CISA KEV (JSON) ────────────────────────────────────────────────────────
async function fetchCISAKEV() {
  const r    = await fetchWithTimeout("https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json");
  const data = await r.json();
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  return data.vulnerabilities
    .filter(v => new Date(v.dateAdded) >= cutoff)
    .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
    .slice(0, 30)
    .map(v => ({
      id: "CISA-KEV-" + v.cveID, title: v.vulnerabilityName,
      severity: "CRITICAL", category: "advisory",
      date: fmtDate(v.dateAdded), ts: new Date(v.dateAdded).getTime(),
      source: "CISA KEV",
      source_url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
      source_color: "#e05000", source_flag: "🇺🇸",
      cve_ids: [v.cveID],
      affected_products: [v.vendorProject + " " + v.product],
      summary: v.shortDescription + " Required action: " + v.requiredAction,
      threat_actor: (v.knownRansomwareCampaignUse && v.knownRansomwareCampaignUse !== "Unknown") ? "Ransomware: " + v.knownRansomwareCampaignUse : null,
      countries: ["US", "GB", "DE", "AU", "CA"],
      middle_east_relevance: getMERelevance([v.vendorProject, v.product], v.vulnerabilityName, v.shortDescription),
      patch_available: true, exploit_in_wild: true,
    }));
}

// ── 2. CISA Alerts (RSS) ──────────────────────────────────────────────────────
async function fetchCISAAlerts() {
  return rss("https://www.cisa.gov/uscert/ncas/alerts.xml", { id_prefix: "CISA-ALERT", source: "CISA Alerts", source_url: "https://www.cisa.gov/news-events/cybersecurity-advisories", source_color: "#e05000", source_flag: "🇺🇸", category: "advisory", default_sev: "HIGH", patch_avail: true, limit: 15, countries: ["US"] });
}

// ── 3. NVD (JSON) ─────────────────────────────────────────────────────────────
async function fetchNVDCritical() {
  const end   = new Date().toISOString().replace(/\.\d{3}Z$/, ".000");
  const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, ".000");
  const r     = await fetchWithTimeout(`https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=${start}&pubEndDate=${end}&cvssV3Severity=CRITICAL&resultsPerPage=20`);
  const data  = await r.json();
  return (data.vulnerabilities || []).flatMap(item => {
    const cve = item.cve;
    const desc = (cve.descriptions || []).find(d => d.lang === "en")?.value || "";
    if (!desc || desc.includes("** RESERVED **")) return [];
    const sev = cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseSeverity || cve.metrics?.cvssMetricV30?.[0]?.cvssData?.baseSeverity || "CRITICAL";
    const cvss = cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore || cve.metrics?.cvssMetricV30?.[0]?.cvssData?.baseScore || 9.8;
    const products = [...new Set((cve.configurations || []).flatMap(c => (c.nodes || []).flatMap(n => (n.cpeMatch || []).map(cpe => { const p = (cpe.criteria || "").split(":"); const v = (p[3] || "").replace(/_/g, " "); const pr = (p[4] || "").replace(/_/g, " "); return v && v !== "*" && pr && pr !== "*" ? `${v} ${pr}` : null }).filter(Boolean))))].slice(0, 4);
    return [{ id: "NVD-" + cve.id, title: desc.length > 100 ? desc.slice(0, 97) + "…" : desc, severity: sev, cvss, category: "advisory", date: fmtDate(cve.published), ts: new Date(cve.published).getTime(), source: "NVD / CVE.org", source_url: `https://nvd.nist.gov/vuln/detail/${cve.id}`, source_color: "#8b0000", source_flag: "🌐", cve_ids: [cve.id], affected_products: products.length ? products : ["Multiple Products"], summary: desc, threat_actor: null, countries: ["US", "GB", "DE", "CN", "RU"], middle_east_relevance: getMERelevance(products, desc, ""), patch_available: (cve.references || []).length > 0, exploit_in_wild: false }];
  });
}

// ── 4. GitHub Security Advisories (GHSA — reviewed critical/high CVEs) ────────
async function fetchGitHubAdvisories() {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort("timeout"), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch("https://api.github.com/advisories?per_page=20&severity=critical", {
      headers: { ...UA, "Accept": "application/vnd.github+json" },
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    return (Array.isArray(data) ? data : []).flatMap(a => {
      if (a.withdrawn_at) return [];
      const title = (a.summary || "").trim();
      if (!title) return [];
      const desc = decodeEntities(String(a.description || title).replace(/<[^>]+>/g, " ").replace(/[#*`>_~]/g, "").replace(/\s{2,}/g, " ").trim());
      const cves = [a.cve_id, ...(a.identifiers || []).filter(i => i.type === "CVE").map(i => i.value)].filter(Boolean);
      const uniqCves = [...new Set(cves)].slice(0, 4);
      const pkgs = [...new Set((a.vulnerabilities || []).map(v => v.package?.name ? `${v.package.ecosystem || ""} ${v.package.name}`.trim() : null).filter(Boolean))].slice(0, 4);
      const patched = (a.vulnerabilities || []).some(v => v.first_patched_version);
      const ts = new Date(a.published_at || Date.now()).getTime();
      const cvss = a.cvss?.score || 9.0;
      return [{
        id: "GHSA-" + a.ghsa_id,
        title: title.length > 125 ? title.slice(0, 122) + "…" : title,
        severity: (a.severity || "CRITICAL").toUpperCase(),
        cvss,
        category: "advisory",
        date: fmtDate(new Date(ts).toISOString()),
        ts,
        source: "GitHub Advisory (GHSA)",
        source_url: a.html_url || `https://github.com/advisories/${a.ghsa_id}`,
        source_color: "#8b5cf6",
        source_flag: "🐙",
        cve_ids: uniqCves,
        affected_products: pkgs.length ? pkgs : ["Open Source / Enterprise Package"],
        summary: desc.length > 320 ? desc.slice(0, 317) + "…" : desc,
        threat_actor: null,
        countries: ["US", "GB", "DE", "IN"],
        middle_east_relevance: getMERelevance(pkgs, title, desc),
        patch_available: patched,
        exploit_in_wild: /exploit in the wild|actively exploited|ransomware/i.test(desc),
      }];
    });
  } finally {
    clearTimeout(t);
  }
}

// ── 5. CERT-In (India) — official RSS with syndication fallback when WAF-blocked
async function fetchCERTIn() {
  try {
    const direct = await rss("https://www.cert-in.org.in/RSS/CertIn_Security_Advisories.xml", { id_prefix: "CERTIN", source: "CERT-In (India)", source_url: "https://www.cert-in.org.in", source_color: "#ff6b00", source_flag: "🇮🇳", category: "advisory", default_sev: "HIGH", patch_avail: true, limit: 15, countries: ["IN"] });
    if (direct && direct.length > 0) return direct;
  } catch {}
  const items = await rss("https://news.google.com/rss/search?q=%22CERT-In%22+advisory+OR+vulnerability+OR+warning+OR+alert&hl=en-IN&gl=IN&ceid=IN:en", {
    id_prefix: "CERTIN",
    source: "CERT-In (India)",
    source_url: "https://www.cert-in.org.in",
    source_color: "#ff6b00",
    source_flag: "🇮🇳",
    category: "advisory",
    default_sev: "HIGH",
    patch_avail: true,
    limit: 12,
    countries: ["IN", "AE"],
  });
  return items.filter(a => /cert-in|indian computer emergency/i.test(a.title + " " + a.summary));
}

// ── FIRST.org EPSS batch enrichment (30-day exploitation probability) ─────────
async function enrichWithEPSS(items) {
  try {
    const cves = [...new Set(items.flatMap(a => a.cve_ids || []).filter(c => /^CVE-\d{4}-\d{4,7}$/.test(c)))].slice(0, 90);
    if (!cves.length) return;
    const r = await fetchWithTimeout(`https://api.first.org/data/v1/epss?cve=${cves.join(",")}`, 5500);
    if (!r.ok) return;
    const data = await r.json();
    const map = {};
    (data.data || []).forEach(row => {
      if (row.cve && row.epss != null) {
        map[row.cve] = {
          epss: Math.round(parseFloat(row.epss) * 1000) / 10, // percentage 0.0 - 100.0
          percentile: Math.round(parseFloat(row.percentile || 0) * 100),
        };
      }
    });
    items.forEach(item => {
      if (!item.cve_ids?.length) return;
      let best = null;
      for (const c of item.cve_ids) {
        if (map[c] && (!best || map[c].epss > best.epss)) best = { cve: c, ...map[c] };
      }
      if (best) {
        item.epss = best.epss;
        item.epss_percentile = best.percentile;
      }
    });
  } catch {}
}

// ── Telegram (HTML scrape) ────────────────────────────────────────────────────
async function fetchTelegramDarkFeed() {
  const r = await fetchWithTimeout("https://t.me/s/secharvester", 14000);
  const html = await r.text();
  const msgs  = [...html.matchAll(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/g)].slice(0, 8);
  const dates = [...html.matchAll(/datetime="([^"]+)"/g)].slice(0, 8);
  const links = [...html.matchAll(/href="(https:\/\/t\.me\/[^"]+)"/g)].slice(0, 8);
  return msgs.flatMap((m, i) => {
    const text = m[1].replace(/<[^>]+>/g, "").trim();
    if (!text || text.length < 20) return [];
    const ts = dates[i] ? new Date(dates[i][1]).getTime() : Date.now();
    return [{ id: `TG-${i}-${ts}`, title: text.slice(0, 100), severity: "HIGH", category: "news", date: fmtDate(new Date(ts).toISOString()), ts, source: "Telegram: DarkFeed", source_url: links[i] ? links[i][1] : "https://t.me/secharvester", source_color: "#0088cc", source_flag: "📡", cve_ids: [], affected_products: [], summary: text.slice(0, 300), threat_actor: null, countries: ["RU", "CN", "IR", "KP", "US"], middle_east_relevance: "MEDIUM", patch_available: false, exploit_in_wild: false }];
  });
}

// ── India mainstream (keyword-filtered) ───────────────────────────────────────
const CYBER_KW = ["cyber", "hack", "breach", "malware", "ransomware", "phishing", "vulnerability", "data leak", "attack", "security", "fraud", "scam", "cert-in", "rbi", "digital arrest", "upi", "banking", "privacy", "dpdp", "meity", "deepfake"];

async function fetchTheHindu() {
  const all = await rss("https://www.thehindu.com/sci-tech/technology/feeder/default.rss", { id_prefix: "HINDU", source: "The Hindu Tech", source_url: "https://www.thehindu.com/sci-tech/technology/", source_color: "#b71c1c", source_flag: "🇮🇳", category: "news", default_sev: "MEDIUM", limit: 30, countries: ["IN"] });
  return all.filter(a => CYBER_KW.some(k => (a.title + " " + a.summary).toLowerCase().includes(k)));
}

async function fetchEconomicTimes() {
  const all = await rss("https://economictimes.indiatimes.com/rssfeedstopstories.cms", { id_prefix: "ET", source: "Economic Times IT", source_url: "https://economictimes.indiatimes.com/tech", source_color: "#e65100", source_flag: "🇮🇳", category: "news", default_sev: "MEDIUM", limit: 30, countries: ["IN"] });
  return all.filter(a => CYBER_KW.some(k => (a.title + " " + a.summary).toLowerCase().includes(k)));
}

async function fetchArsTechnica() {
  const all = await rss("https://feeds.arstechnica.com/arstechnica/index", { id_prefix: "ARS", source: "Ars Technica", source_url: "https://arstechnica.com/security/", source_color: "#ff6600", source_flag: "📰", category: "news", default_sev: "MEDIUM", limit: 25, countries: ["US"] });
  const kw = ["security", "hack", "breach", "malware", "ransomware", "vulnerability", "cve", "exploit", "phishing", "cyber", "apt", "zero-day", "zero day"];
  return all.filter(a => kw.some(k => (a.title + " " + a.summary).toLowerCase().includes(k)));
}

// ── Social / community sources ────────────────────────────────────────────────
// Word-boundary regex (plain substring matching let "https" match "ttp", "social" match "soc", etc.)
const SOCIAL_RE = /\b(cve-\d{4}-\d+|cyber\w*|hack(ed|er|ers|ing)?|breach(ed|es)?|malware|ransomware|ransom|phishing|vulnerab\w*|vuln|exploit\w*|threat\w*|apt\d*|zero[- ]day|0[- ]?day|patch(ed|es|ing)?|infosec|soc|siem|edr|xdr|pentest\w*|red[- ]team\w*|blue[- ]team\w*|incident|botnet|c2|ioc|iocs|ttps?|mitre|att&ck|nist|owasp|data leak|leak(ed|s)?|backdoor\w*|rce|xss|sqli|sql injection|auth(entication)? bypass|credential\w*|mfa|zero trust|dfir|forensic\w*|cisa|cert-in|ncsc|dark ?web|spyware|stalkerware|trojan|rootkit|cryptojack\w*|ddos|deepfake\w*|scam\w*|fraud\w*|security|attack(er|ers|s)?|compromis\w*|intrusion|exfiltrat\w*|encrypt\w*|privacy|gdpr|dpdp|firewall|vpn|identity theft)\b/i;
const isSecurityText = t => SOCIAL_RE.test(t);
const SOCIAL_SPAM_RE = /apply (here|now)|we'?re hiring|hiring\b|job (opening|alert|post)|\bjobs?\b.*\b(remote|senior|engineer|analyst)\b|jobicy|careers?\b|\bsalary\b|giveaway|discount code|coupon|% off|buy now|free trial|webinar|register (now|today)|sign up (now|today)|subscribe to|our course|enroll|bootcamp|certification (course|training)/i;
const stripHtml = s => decodeEntities(String(s || "").replace(/<br\s*\/?>/gi, " ").replace(/<\/p>/gi, " ").replace(/<[^>]+>/g, "")).replace(/\s{2,}/g, " ").trim();

function socialItem({ id, text, url, author, ts, source, source_color, source_flag, countries }) {
  const title = text.length > 120 ? text.slice(0, 117) + "…" : text;
  const cves = [...new Set(text.match(/CVE-\d{4}-\d{4,7}/g) || [])].slice(0, 4);
  return { id, title, severity: "LOW", category: "social", date: fmtDate(new Date(ts).toISOString()), ts, source, source_url: url, source_color, source_flag, author, cve_ids: cves, affected_products: [], summary: text.length > 400 ? text.slice(0, 397) + "…" : text, threat_actor: null, countries: countries || ["US"], middle_east_relevance: getMERelevance([], text, ""), patch_available: false, exploit_in_wild: /exploit|ransomware|in the wild/i.test(text) };
}

// infosec.exchange — the infosec community's Mastodon home (public local timeline, no auth)
async function fetchInfosecExchange() {
  const r = await fetchWithTimeout("https://infosec.exchange/api/v1/timelines/public?local=true&limit=40");
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const posts = await r.json();
  return posts
    .filter(p => !p.in_reply_to_id && p.visibility === "public" && !p.sensitive)
    .map(p => ({ p, text: stripHtml(p.content) }))
    .filter(({ text }) => text.length >= 40 && isSecurityText(text))
    .slice(0, 15)
    .map(({ p, text }) => socialItem({ id: "IEX-" + p.id, text, url: p.url, author: "@" + p.account.acct, ts: new Date(p.created_at).getTime(), source: "infosec.exchange", source_color: "#6364ff", source_flag: "🐘", countries: ["US", "GB", "DE"] }));
}

// Bluesky — public AppView API (getAuthorFeed across verified security feeds, no auth required)
async function fetchBluesky() {
  const actors = [
    "bleepingcomputer.com",
    "malwrhunterteam.bsky.social",
    "troyhunt.com",
    "schneier.com",
    "infosec.skyfleet.blue",
  ];
  const settled = await Promise.allSettled(
    actors.map(actor =>
      fetchWithTimeout(`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(actor)}&limit=5&filter=posts_no_replies`, 6500)
        .then(r => (r.ok ? r.json() : { feed: [] }))
    )
  );
  const posts = settled.flatMap(s => (s.status === "fulfilled" ? (s.value.feed || []).map(f => f.post).filter(Boolean) : []));
  if (!posts.length) throw new Error("No Bluesky posts fetched");
  return posts
    .filter(p => p.record?.text && p.record.text.length >= 35 && !p.record.reply && isSecurityText(p.record.text))
    .sort((a, b) => new Date(b.indexedAt || b.record?.createdAt || 0) - new Date(a.indexedAt || a.record?.createdAt || 0))
    .slice(0, 15)
    .map(p => {
      const rkey = (p.uri || "").split("/").pop();
      return socialItem({
        id: "BSKY-" + rkey,
        text: p.record.text,
        url: `https://bsky.app/profile/${p.author.handle}/post/${rkey}`,
        author: "@" + p.author.handle,
        ts: new Date(p.indexedAt || p.record.createdAt).getTime(),
        source: "Bluesky",
        source_color: "#0085ff",
        source_flag: "🦋",
        countries: ["US", "GB"],
      });
    });
}

// Hacker News — Algolia public API, security stories only
async function fetchHackerNewsYC() {
  const r = await fetchWithTimeout("https://hn.algolia.com/api/v1/search_by_date?query=security&tags=story&hitsPerPage=40");
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return (data.hits || [])
    .filter(h => h.title && isSecurityText(h.title) && (h.points || 0) >= 3)
    .slice(0, 15)
    .map(h => ({ ...socialItem({ id: "HN-" + h.objectID, text: h.title, url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`, author: `${h.points} pts · ${h.num_comments || 0} comments`, ts: new Date(h.created_at).getTime(), source: "Hacker News", source_color: "#ff6600", source_flag: "🟠", countries: ["US"] }), summary: `${h.title} — discussion on Hacker News (${h.points} points, ${h.num_comments || 0} comments)`, source_url: `https://news.ycombinator.com/item?id=${h.objectID}` }));
}

// ── Generic RSS/Atom fetch + parse ────────────────────────────────────────────
async function rss(url, opts) {
  const r = await fetchWithTimeout(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return parseRSS(await r.text(), opts);
}

function parseRSS(xml, opts) {
  let blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  if (!blocks.length) blocks = [...xml.matchAll(/<item [^>]*>([\s\S]*?)<\/item>/g)];
  if (!blocks.length) blocks = [...xml.matchAll(/<entry[^>]*>([\s\S]*?)<\/entry>/g)];
  const now = Date.now();
  return blocks.slice(0, opts.limit).flatMap(([, block]) => {
    const get = tag => (block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`))
      || block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
      || [])[1]?.trim() || "";
    const descRaw = get("description") || get("summary") || get("content") || "";
    // decode entities FIRST so escaped markup (&lt;br&gt;) is stripped as real tags
    const desc = decodeEntities(decodeEntities(descRaw).replace(/<[^>]+>/g, " ")).replace(/\s{2,}/g, " ").trim(); // twice: feeds often double-encode
    let title = decodeEntities(decodeEntities(get("title"))).replace(/<[^>]+>/g, "").trim();
    if (!title && desc) title = desc.length > 120 ? desc.slice(0, 117) + "…" : desc; // Mastodon RSS has no <title>
    const link = get("link")
      || block.match(/<link[^>]+href="([^"]+)"/)?.[1]
      || get("guid") || get("id") || opts.source_url;
    const date = get("pubDate") || get("dc:date") || get("updated") || get("published") || "";
    if (!title) return [];
    let ts = date ? parseFeedDate(date) : now;
    if (!Number.isFinite(ts) || ts > now + 60 * 60 * 1000) ts = now; // guard bad/future dates
    const cves = [...new Set((title + " " + desc).match(/CVE-\d{4}-\d{4,7}/g) || [])].slice(0, 5);
    const lower = (title + " " + desc).toLowerCase();
    const sev = lower.includes("critical") ? "CRITICAL" : lower.includes("high") ? "HIGH" : opts.default_sev;
    const hashId = Math.abs([...title].reduce((h, c) => Math.imul(31, h) + c.charCodeAt(0) | 0, 0)).toString(16).slice(0, 8).toUpperCase();
    const pm = title.match(/(?:for|in|affecting)\s+(.+?)(?:\s*$|\s*[-–(])/i);
    // Social posts: derive author from Mastodon (/@user/) or Reddit (<author><name>) markup
    const author = opts.category === "social"
      ? (link.match(/https?:\/\/[^/]+\/(@[\w.-]+)/)?.[1] || get("name").replace(/^\/?u\//, "@") || null)
      : undefined;
    return [{
      id: `${opts.id_prefix}-${hashId}`, title, severity: sev, category: opts.category,
      date: fmtDate(new Date(ts).toISOString()), ts, ...(author ? { author } : {}),
      source: opts.source, source_url: link, source_color: opts.source_color, source_flag: opts.source_flag,
      cve_ids: cves, affected_products: pm ? [pm[1].trim()] : [],
      summary: desc.length > 300 ? desc.slice(0, 297) + "…" : (desc || title),
      threat_actor: null, countries: opts.countries || ["US"],
      middle_east_relevance: getMERelevance(pm ? [pm[1]] : [], title, desc),
      patch_available: !!opts.patch_avail,
      exploit_in_wild: !!opts.exploit_wild || lower.includes("exploit") || lower.includes("ransomware"),
    }];
  });
}

// JS Date can't parse European tz abbreviations (CEST/CET etc.) — map to offsets
const TZ_ABBR = { CEST: "+0200", CET: "+0100", EEST: "+0300", EET: "+0200", BST: "+0100", EDT: "-0400", EST: "-0500", CDT: "-0500", CST: "-0600", MDT: "-0600", MST: "-0700", PDT: "-0700", PST: "-0800", IST: "+0530", AEST: "+1000", AEDT: "+1100", JST: "+0900" };
function parseFeedDate(s) {
  let t = new Date(s).getTime();
  if (Number.isFinite(t)) return t;
  const fixed = s.replace(/\b([A-Z]{2,4})\b\s*$/, (m, abbr) => TZ_ABBR[abbr] || m);
  t = new Date(fixed).getTime();
  return Number.isFinite(t) ? t : NaN;
}

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (m, n) => { const c = +n; return c > 31 && c < 1114112 ? String.fromCodePoint(c) : " "; })
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => { const c = parseInt(h, 16); return c > 31 && c < 1114112 ? String.fromCodePoint(c) : " "; })
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#8217;/g, "'").replace(/&#8216;/g, "'").replace(/&#8220;|&#8221;/g, '"').replace(/&nbsp;/g, " ");
}

// ── Heatmap ───────────────────────────────────────────────────────────────────
function buildHeatmap(all) {
  const counts = {};
  const NAMES = { US: "United States", GB: "United Kingdom", CN: "China", RU: "Russia", IN: "India", DE: "Germany", AU: "Australia", CA: "Canada", FR: "France", IR: "Iran", KP: "North Korea", AE: "UAE", SA: "Saudi Arabia", QA: "Qatar", KW: "Kuwait", PK: "Pakistan", UA: "Ukraine", BR: "Brazil", JP: "Japan", KR: "South Korea", NL: "Netherlands", SG: "Singapore", TR: "Turkey", IL: "Israel", ZA: "South Africa", NG: "Nigeria", MX: "Mexico", IT: "Italy", ES: "Spain" };
  all.forEach(a => (a.countries || []).forEach(c => { counts[c] = (counts[c] || 0) + (a.severity === "CRITICAL" ? 4 : a.severity === "HIGH" ? 3 : a.severity === "MEDIUM" ? 2 : 1); }));
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([code, score]) => ({ code, score, name: NAMES[code] || code, level: score > 20 ? "CRITICAL" : score > 12 ? "HIGH" : score > 6 ? "MEDIUM" : "LOW" }));
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso) { return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }

function getMERelevance(products, title, desc) {
  const text = [...products, title, desc].join(" ").toLowerCase();
  const hi = ["fortinet", "palo alto", "cisco", "microsoft", "sap", "ivanti", "juniper", "f5", "checkpoint", "vmware", "citrix", "oracle", "exchange", "sharepoint", "windows server", "active directory", "vpn", "firewall", "logistics", "transport", "energy", "oil", "gas", "government", "banking", "finance", "telecom", "scada", "industrial", "ics", " ot ", "middle east", "gcc", "uae", "saudi", "dubai", "qatar", "kuwait", "bahrain", "oman", "india", "rbi", "cert-in", "nciipc", "upi", "meity"];
  return hi.some(k => text.includes(k)) ? "HIGH" : "MEDIUM";
}

// Dedup on CVE-set OR normalized title (kills cross-source duplicates of the same story)
function dedup(arr) {
  const seen = new Set();
  return arr.filter(a => {
    const cveKey   = a.cve_ids?.length ? "cve:" + [...a.cve_ids].sort().join(",") : null;
    const titleKey = "t:" + a.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 70);
    if ((cveKey && seen.has(cveKey)) || seen.has(titleKey)) return false;
    if (cveKey) seen.add(cveKey);
    seen.add(titleKey);
    return true;
  });
}
