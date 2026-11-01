/**
 * BCyberAware – Dark Web Early Warning (Cloudflare Workers)
 * Sources : ransomware.live (RSS + Groups JSON) · HaveIBeenPwned · abuse.ch Feodo Tracker · Cybercrime Tracker
 */

import { jsonResponse } from "./http.js";

const CACHE    = {};
const CACHE_MS = 2 * 60 * 60 * 1000;
const UA = { "User-Agent": "Mozilla/5.0 (compatible; BCyberAware/3.0; +https://advisory.bcyberaware.co.in)" };

async function fetchWithTimeout(url, ms = 10000, extraHeaders = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort("timeout"), ms);
  try {
    return await fetch(url, { headers: { ...UA, ...extraHeaders }, signal: ctrl.signal, redirect: "follow" });
  } finally {
    clearTimeout(t);
  }
}

export async function handleDarkwebRequest(request) {
  const url = new URL(request.url);
  const bust = url.searchParams.get("bust") === "1";

  try {
    const now = Date.now();
    if (!bust && CACHE.dw && (now - CACHE.dw.ts) < CACHE_MS)
      return jsonResponse({ ...CACHE.dw.data, from_cache: true });

    const [r_victims, r_groups, r_breaches, r_c2] = await Promise.allSettled([
      fetchRansomwareVictims(),
      fetchRansomwareGroups(),
      fetchHIBPBreaches(),
      fetchC2Servers(),
    ]);

    const get = r => r.status === "fulfilled" ? (r.value || []) : [];

    const payload = {
      ransomware_victims: get(r_victims).slice(0, 35),
      ransomware_groups:  get(r_groups).slice(0, 30),
      data_breaches:      get(r_breaches).slice(0, 20),
      c2_servers:         get(r_c2).slice(0, 25),
      fetched_at:         now,
      fetched_at_human:   new Date().toUTCString(),
      from_cache:         false,
    };

    CACHE.dw = { ts: now, data: payload };
    return jsonResponse(payload);

  } catch (e) {
    if (CACHE.dw) return jsonResponse({ ...CACHE.dw.data, from_cache: true, degraded: true });
    return jsonResponse({ error: e.message }, 500);
  }
}

// ── 1. ransomware.live – Recent Victims (RSS feed) ────────────────────────────
async function fetchRansomwareVictims() {
  try {
    const r = await fetchWithTimeout("https://www.ransomware.live/rss.xml", 10000);
    if (!r.ok) return [];
    const xml = await r.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 35);
    return items.flatMap(([, block]) => {
      const get = tag => (
        block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`))
        || block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
        || [])[1]?.trim() || "";
      const rawTitle = get("title").replace(/🏴‍☠️\s*/g, "").trim();
      if (!rawTitle) return [];
      // Format: "<Group> has just published a new victim : <Victim>"
      const m = rawTitle.match(/^(.+?)\s+has just published a new victim\s*:\s*(.+)$/i);
      const group  = m ? m[1].trim() : "Unknown";
      const victim = m ? m[2].trim() : rawTitle;
      const descRaw = get("description").replace(/<[^>]+>/g, "").trim();
      const description = (descRaw && descRaw !== "N/A") ? descRaw.slice(0, 400) : "";
      const cat = get("category");
      const country = (cat && cat !== "N/A") ? cat : "";
      const link = get("link") || get("guid") || "https://www.ransomware.live";
      const pubDate = get("pubDate") || new Date().toISOString();
      return [{
        victim,
        group,
        date: pubDate,
        country,
        sector: "",
        website: link,
        description,
      }];
    });
  } catch { return []; }
}

// ── 2. ransomware.live – Active Groups (data.ransomware.live/groups.json) ─────
async function fetchRansomwareGroups() {
  try {
    const r = await fetchWithTimeout("https://data.ransomware.live/groups.json", 11000, { "Accept": "application/json" });
    if (!r.ok) return [];
    const data = await r.json();
    if (!Array.isArray(data)) return [];
    const mapped = data.map(g => {
      const locs = Array.isArray(g.locations) ? g.locations : [];
      const activeLocs = locs.filter(l => l.available === true);
      const latestLoc = locs.reduce((best, l) => {
        const d = l.updated || l.lastscrape || "";
        return d > best ? d : best;
      }, g.date || "");
      return {
        name:         g.name || "Unknown",
        status:       activeLocs.length > 0 ? "active" : "inactive",
        first_seen:   g.date || "",
        last_seen:    latestLoc ? String(latestLoc).slice(0, 10) : "",
        victim_count: Number(g._victim_count || g.meta?.victim_count || g.victims || 0),
        description:  String(g.description || "").replace(/<[^>]+>/g, "").trim().slice(0, 220),
        locations:    locs.map(l => l.fqdn).filter(Boolean).slice(0, 3),
      };
    });
    return mapped.sort((a, b) => {
      const aAct = a.status === "active" ? 1 : 0;
      const bAct = b.status === "active" ? 1 : 0;
      if (bAct !== aAct) return bAct - aAct;
      return (b.victim_count || 0) - (a.victim_count || 0);
    });
  } catch { return []; }
}

// ── 3. HaveIBeenPwned – Public Breach List (no auth required) ─────────────────
async function fetchHIBPBreaches() {
  try {
    const r = await fetchWithTimeout("https://haveibeenpwned.com/api/v3/breaches", 9000, {
      "Accept": "application/json",
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

// ── 4. Botnet & Malware C2 Servers (abuse.ch Feodo + C2IntelFeeds + Cybercrime Tracker)
async function fetchC2Servers() {
  const out = [];
  const [feodoRes, c2IntelRes, ccRes] = await Promise.allSettled([
    fetchWithTimeout("https://feodotracker.abuse.ch/downloads/ipblocklist_recommended.json", 8000, { "Accept": "application/json" }),
    fetchWithTimeout("https://raw.githubusercontent.com/drb-ra/C2IntelFeeds/master/feeds/IPC2s-30day.csv", 8000),
    fetchWithTimeout("https://cybercrime-tracker.net/rss.xml", 8000),
  ]);

  if (feodoRes.status === "fulfilled" && feodoRes.value.ok) {
    try {
      const list = await feodoRes.value.json();
      if (Array.isArray(list)) {
        list.slice(0, 12).forEach(item => {
          out.push({
            ip: item.ip_address,
            port: item.port,
            malware: item.malware || "Botnet C2",
            country: item.country || "",
            asn: item.as_number ? `AS${item.as_number} ${item.as_name || ""}`.trim() : "",
            title: `${item.malware || "Botnet C2"} · ${item.ip_address}:${item.port} (${item.status || "online"})`,
            description: `Active ${item.malware || "botnet"} command-and-control server hosted on AS${item.as_number || "?"} (${item.as_name || "Unknown ASN"}, ${item.country || "??"}). First seen: ${item.first_seen || "N/A"} · Last online: ${item.last_online || "today"}.`,
            url: `https://feodotracker.abuse.ch/browse/host/${item.ip_address}/`,
            date: item.last_online || item.first_seen || new Date().toISOString(),
          });
        });
      }
    } catch {}
  }

  if (c2IntelRes.status === "fulfilled" && c2IntelRes.value.ok) {
    try {
      const csv = await c2IntelRes.value.text();
      const lines = csv.split(/\r?\n/).filter(l => l && !l.startsWith("#")).slice(0, 12);
      lines.forEach(line => {
        const [ip, label] = line.split(",");
        if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip.trim())) {
          const cleanIp = ip.trim();
          const tag = (label || "Cobalt Strike C2").trim();
          out.push({
            ip: cleanIp,
            malware: tag,
            title: `${tag} · ${cleanIp}`,
            description: `STIX Indicator [ipv4-addr:value = '${cleanIp}'] — observed active C2 infrastructure in 30-day C2IntelFeeds telemetry.`,
            url: `https://www.shodan.io/host/${cleanIp}`,
            date: new Date().toISOString(),
          });
        }
      });
    } catch {}
  }

  if (ccRes.status === "fulfilled" && ccRes.value.ok) {
    try {
      const xml = await ccRes.value.text();
      const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 12);
      items.forEach(([, block]) => {
        const get = tag => (
          block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`))
          || block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
          || [])[1]?.trim() || "";
        const title = get("title");
        const desc  = get("description").replace(/<[^>]+>/g, "").trim();
        const link  = get("link") || get("guid") || "";
        const date  = get("pubDate") || "";
        if (title) out.push({ title, description: desc.slice(0, 200), url: link, date });
      });
    } catch {}
  }

  return out;
}
