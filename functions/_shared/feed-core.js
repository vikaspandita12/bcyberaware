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
  { key: "certin",       name: "CERT-In (India)",        flag: "🇮🇳", cat: "advisory", fn: () => rss("https://www.cert-in.org.in/RSS/CertIn_Security_Advisories.xml", { id_prefix: "CERTIN", source: "CERT-In (India)", source_url: "https://www.cert-in.org.in", source_color: "#ff6b00", source_flag: "🇮🇳", category: "advisory", default_sev: "HIGH", patch_avail: true, limit: 15, countries: ["IN"] }) },
  { key: "ncsc_uk",      name: "NCSC UK",                flag: "🇬🇧", cat: "advisory", fn: () => rss("https://www.ncsc.gov.uk/api/1/services/v1/news-rss-feed.xml", { id_prefix: "NCSC-UK", source: "NCSC UK", source_url: "https://www.ncsc.gov.uk", source_color: "#003078", source_flag: "🇬🇧", category: "advisory", default_sev: "HIGH", patch_avail: true, limit: 12, countries: ["GB"] }) },
  { key: "cert_eu",      name: "CERT-EU",                flag: "🇪🇺", cat: "advisory", fn: () => rss("https://cert.europa.eu/publications/security-advisories-rss", { id_prefix: "CERTEU", source: "CERT-EU", source_url: "https://cert.europa.eu", source_color: "#003399", source_flag: "🇪🇺", category: "advisory", default_sev: "HIGH", patch_avail: true, limit: 12, countries: ["DE", "FR", "NL", "IT", "ES"] }) },
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
];

// ── Main handler ──────────────────────────────────────────────────────────────
export async function handleFeedRequest(request) {
  const url    = new URL(request.url);
  const action = url.searchParams.get("action");
  const bust   = url.searchParams.get("bust") === "1";

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

    const byCat = { advisory: [], exploit: [], news: [] };
    runs.forEach(({ src, items }) => byCat[src.cat].push(...items));

    const sortAndDedup = arr => {
      arr.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      return dedup(arr);
    };

    const advisories = sortAndDedup(byCat.advisory).slice(0, 60);
    const exploits   = sortAndDedup(byCat.exploit).slice(0, 30);
    const news       = sortAndDedup(byCat.news).slice(0, 90);

    const payload = {
      advisories, exploits, news,
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
    const products = [...new Set((cve.configurations || []).flatMap(c => (c.nodes || []).flatMap(n => (n.cpeMatch || []).map(cpe => { const p = (cpe.criteria || "").split(":"); const v = (p[3] || "").replace(/_/g, " "); const pr = (p[4] || "").replace(/_/g, " "); return v && v !== "*" && pr && pr !== "*" ? `${v} ${pr}` : null }).filter(Boolean))))].slice(0, 4);
    return [{ id: "NVD-" + cve.id, title: desc.length > 100 ? desc.slice(0, 97) + "…" : desc, severity: sev, category: "advisory", date: fmtDate(cve.published), ts: new Date(cve.published).getTime(), source: "NVD / CVE.org", source_url: `https://nvd.nist.gov/vuln/detail/${cve.id}`, source_color: "#8b0000", source_flag: "🌐", cve_ids: [cve.id], affected_products: products.length ? products : ["Multiple Products"], summary: desc, threat_actor: null, countries: ["US", "GB", "DE", "CN", "RU"], middle_east_relevance: getMERelevance(products, desc, ""), patch_available: (cve.references || []).length > 0, exploit_in_wild: false }];
  });
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
    const title = decodeEntities(get("title")).replace(/<[^>]+>/g, "").trim();
    const descRaw = get("description") || get("summary") || get("content") || "";
    // decode entities FIRST so escaped markup (&lt;br&gt;) is stripped as real tags
    const desc = decodeEntities(descRaw).replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();
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
    return [{
      id: `${opts.id_prefix}-${hashId}`, title, severity: sev, category: opts.category,
      date: fmtDate(new Date(ts).toISOString()), ts,
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
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&#8217;/g, "'").replace(/&#8216;/g, "'").replace(/&#8220;|&#8221;/g, '"').replace(/&nbsp;/g, " ");
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
