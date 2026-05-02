/**
 * BCyberAware – Dark Web Early Warning (Vercel Edition)
 * Author  : Vikas Pandita | BCyberAware
 * Sources : ransomware.live · HaveIBeenPwned · Cybercrime Tracker
 * Cache   : 2 hours in-memory + HTTP Cache-Control headers
 */

const CACHE    = {};
const CACHE_MS = 2 * 60 * 60 * 1000;

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "public, max-age=7200, s-maxage=7200, stale-while-revalidate=3600");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")     return res.status(405).json({ error: "Method not allowed" });

  const bust = req.query.bust === "1";

  try {
    const now = Date.now();
    if (!bust && CACHE.dw && (now - CACHE.dw.ts) < CACHE_MS)
      return res.status(200).json({ ...CACHE.dw.data, from_cache: true });

    const [r_victims, r_groups, r_breaches, r_c2] = await Promise.allSettled([
      fetchRansomwareVictims(),
      fetchRansomwareGroups(),
      fetchHIBPBreaches(),
      fetchCybercrimeTracker(),
    ]);

    const get = r => r.status === "fulfilled" ? (r.value || []) : [];

    const payload = {
      ransomware_victims: get(r_victims).slice(0, 30),
      ransomware_groups:  get(r_groups).slice(0, 25),
      data_breaches:      get(r_breaches).slice(0, 20),
      c2_servers:         get(r_c2).slice(0, 20),
      fetched_at:         now,
      fetched_at_human:   new Date().toUTCString(),
      from_cache:         false,
    };

    CACHE.dw = { ts: now, data: payload };
    return res.status(200).json(payload);

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

// ── 1. ransomware.live – Recent Victims ───────────────────────────────────────
async function fetchRansomwareVictims() {
  try {
    const r = await fetch("https://api.ransomware.live/recentvictims", {
      headers: { "User-Agent": "BCyberAware/2.0", "Accept": "application/json" },
    });
    if (!r.ok) return [];
    const data = await r.json();
    return (Array.isArray(data) ? data : []).map(v => ({
      victim:      v.victim    || v.name    || "Unknown",
      group:       v.group     || v.gang    || "Unknown",
      date:        v.published || v.date    || new Date().toISOString(),
      country:     v.country                || "",
      sector:      v.activity  || v.sector  || "",
      website:     v.website                || "",
      description: (v.description || "").replace(/<[^>]+>/g, "").slice(0, 400),
    }));
  } catch { return []; }
}

// ── 2. ransomware.live – Active Groups ────────────────────────────────────────
async function fetchRansomwareGroups() {
  try {
    const r = await fetch("https://api.ransomware.live/groups", {
      headers: { "User-Agent": "BCyberAware/2.0", "Accept": "application/json" },
    });
    if (!r.ok) return [];
    const data = await r.json();
    return (Array.isArray(data) ? data : [])
      .sort((a, b) => {
        const aA = (a.status || "").toLowerCase().includes("activ") ? 1 : 0;
        const bA = (b.status || "").toLowerCase().includes("activ") ? 1 : 0;
        return bA - aA;
      })
      .map(g => ({
        name:         g.name                           || "Unknown",
        status:       g.status                         || "unknown",
        first_seen:   g.firstseen  || g.first_seen     || "",
        last_seen:    g.lastseen   || g.last_seen       || "",
        victim_count: g.meta?.victim_count || g.victims || 0,
        description:  (g.description || "").replace(/<[^>]+>/g, "").slice(0, 200),
        locations:    g.meta?.locations || g.meta?.countries || [],
      }));
  } catch { return []; }
}

// ── 3. HaveIBeenPwned – Public Breach List (no auth required) ─────────────────
async function fetchHIBPBreaches() {
  try {
    const r = await fetch("https://haveibeenpwned.com/api/v3/breaches", {
      headers: {
        "User-Agent": "BCyberAware/2.0 (security-awareness-dashboard)",
        "Accept":     "application/json",
      },
    });
    if (!r.ok) return [];
    const data = await r.json();
    return (Array.isArray(data) ? data : [])
      .sort((a, b) => new Date(b.AddedDate || 0) - new Date(a.AddedDate || 0))
      .slice(0, 20)
      .map(b => ({
        name:         b.Name         || "",
        title:        b.Title        || b.Name || "",
        domain:       b.Domain       || "",
        breach_date:  b.BreachDate   || "",
        added_date:   b.AddedDate    || "",
        pwn_count:    b.PwnCount     || 0,
        data_classes: (b.DataClasses || []).slice(0, 8),
        description:  (b.Description || "").replace(/<[^>]+>/g, "").slice(0, 250),
        is_verified:  b.IsVerified   || false,
        is_sensitive: b.IsSensitive  || false,
      }));
  } catch { return []; }
}

// ── 4. Cybercrime Tracker – C2 Server RSS ─────────────────────────────────────
async function fetchCybercrimeTracker() {
  try {
    const r = await fetch("https://cybercrime-tracker.net/rss.xml", {
      headers: { "User-Agent": "BCyberAware/2.0" },
    });
    if (!r.ok) return [];
    const xml = await r.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 20);
    return items.flatMap(([, block]) => {
      const get = tag => (
        block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`))
        || block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
        || [])[1]?.trim() || "";
      const title = get("title");
      const desc  = get("description").replace(/<[^>]+>/g, "").trim();
      const link  = get("link") || get("guid") || "";
      const date  = get("pubDate") || "";
      if (!title) return [];
      return [{ title, description: desc.slice(0, 200), url: link, date }];
    });
  } catch { return []; }
}
