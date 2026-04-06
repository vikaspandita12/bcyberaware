/**
 * BCyberAware – Live Threat Feed
 * Author  : Vikas Pandita | BCyberAware
 * Sources : CISA KEV · CISA Alerts · NVD · CERT-In · NCSC UK ·
 *           Exploit-DB · THN · Bleeping Computer · SANS ISC ·
 *           AlienVault OTX · Packet Storm · SecurityWeek ·
 *           Krebs on Security · Telegram: DarkFeed (public)
 * Cache   : 1 hour (was 6 hours)
 */

const CACHE    = {};
const CACHE_MS = 1 * 60 * 60 * 1000; // ← 1 HOUR

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type":                 "application/json",
  };

  if (event.httpMethod === "OPTIONS")
    return { statusCode:200, headers, body:"" };

  if (event.httpMethod === "GET" &&
      event.queryStringParameters?.action === "feed") {
    try {
      const now = Date.now();
      if (CACHE.feed && (now - CACHE.feed.ts) < CACHE_MS)
        return { statusCode:200, headers,
          body: JSON.stringify({ ...CACHE.feed.data, from_cache:true }) };

      // Fetch all 12 sources in parallel
      const results = await Promise.allSettled([
        fetchCISAKEV(),
        fetchCISAAlerts(),
        fetchNVDCritical(),
        fetchCERTIn(),
        fetchNCSCUK(),
        fetchExploitDB(),
        fetchTheHackerNews(),
        fetchBleepingComputer(),
        fetchSANSISC(),
        fetchAlienVaultOTX(),
        fetchPacketStorm(),
        fetchSecurityWeek(),
        fetchKrebsOnSecurity(),
        fetchTelegramDarkFeed(),
      ]);

      const get = r => r.status === "fulfilled" ? r.value : [];

      const [
        cisaKev, cisaAlerts, nvd, certIn, ncscUk,
        exploitDb, thn, bc, sans,
        otx, packetStorm, secWeek, krebs, telegram
      ] = results;

      const advisories = [
        ...get(cisaKev), ...get(cisaAlerts), ...get(nvd),
        ...get(certIn),  ...get(ncscUk),
      ];
      const exploits = [
        ...get(exploitDb), ...get(packetStorm),
      ];
      const news = [
        ...get(thn), ...get(bc), ...get(sans),
        ...get(secWeek), ...get(krebs),
        ...get(otx), ...get(telegram),
      ];

      const sortAndDedup = arr => {
        arr.sort((a,b) => new Date(b._rawDate) - new Date(a._rawDate));
        return dedup(arr).map(a => { delete a._rawDate; return a; });
      };

      // Build country heatmap data from all advisories
      const heatmap = buildHeatmap([...advisories, ...exploits, ...news]);

      const payload = {
        advisories: sortAndDedup(advisories).slice(0, 40),
        exploits:   sortAndDedup(exploits).slice(0, 20),
        news:       sortAndDedup(news).slice(0, 40),
        heatmap,
        fetched_at:       Date.now(),
        fetched_at_human: new Date().toUTCString(),
        cache_minutes:    60,
        sources: [
          { name:"CISA KEV",          status:"live",   category:"advisory", flag:"🇺🇸" },
          { name:"CISA Alerts",       status:"live",   category:"advisory", flag:"🇺🇸" },
          { name:"NVD / CVE.org",     status:"live",   category:"advisory", flag:"🌐" },
          { name:"CERT-In India",     status:"live",   category:"advisory", flag:"🇮🇳" },
          { name:"NCSC UK",           status:"live",   category:"advisory", flag:"🇬🇧" },
          { name:"Exploit-DB",        status:"live",   category:"exploit",  flag:"⚡" },
          { name:"Packet Storm",      status:"live",   category:"exploit",  flag:"⚡" },
          { name:"The Hacker News",   status:"live",   category:"news",     flag:"📰" },
          { name:"Bleeping Computer", status:"live",   category:"news",     flag:"📰" },
          { name:"SANS ISC",          status:"live",   category:"news",     flag:"🔍" },
          { name:"SecurityWeek",      status:"live",   category:"news",     flag:"📰" },
          { name:"Krebs on Security", status:"live",   category:"news",     flag:"📰" },
          { name:"AlienVault OTX",    status:"live",   category:"news",     flag:"🛸" },
          { name:"Telegram: DarkFeed",status:"live",   category:"news",     flag:"📡" },
          { name:"UAE CERT",          status:"no_api", category:"advisory", flag:"🇦🇪" },
          { name:"Saudi CERT",        status:"no_api", category:"advisory", flag:"🇸🇦" },
        ],
      };

      CACHE.feed = { ts:now, data:payload };
      return { statusCode:200, headers, body: JSON.stringify(payload) };
    } catch(e) {
      return { statusCode:500, headers, body: JSON.stringify({ error:e.message }) };
    }
  }

  return { statusCode:405, headers, body: JSON.stringify({ error:"Method not allowed" }) };
};

// ── 1. CISA KEV ───────────────────────────────────────────────────────────────
async function fetchCISAKEV() {
  const r    = await fetch("https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json");
  const data = await r.json();
  const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
  return data.vulnerabilities
    .filter(v => new Date(v.dateAdded) >= cutoff)
    .sort((a,b) => new Date(b.dateAdded) - new Date(a.dateAdded))
    .slice(0, 20)
    .map(v => ({
      id:                    "CISA-KEV-" + v.cveID,
      title:                 v.vulnerabilityName,
      severity:              "CRITICAL",
      category:              "advisory",
      date:                  fmtDate(v.dateAdded),
      _rawDate:              v.dateAdded,
      source:                "CISA KEV",
      source_url:            "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
      source_color:          "#e05000",
      source_flag:           "🇺🇸",
      cve_ids:               [v.cveID],
      affected_products:     [v.vendorProject + " " + v.product],
      summary:               v.shortDescription + " Required action: " + v.requiredAction,
      threat_actor:          (v.knownRansomwareCampaignUse && v.knownRansomwareCampaignUse !== "Unknown")
                              ? "Ransomware: " + v.knownRansomwareCampaignUse : null,
      countries:             ["US","GB","DE","AU","CA"],
      middle_east_relevance: getMERelevance([v.vendorProject, v.product], v.vulnerabilityName, v.shortDescription),
      patch_available:       true,
      exploit_in_wild:       true,
    }));
}

// ── 2. CISA Alerts RSS ────────────────────────────────────────────────────────
async function fetchCISAAlerts() {
  const r   = await fetch("https://www.cisa.gov/uscert/ncas/alerts.xml",
                          { headers:{ "User-Agent":"BCyberAware/2.0" } });
  const xml = await r.text();
  return parseRSS(xml, {
    id_prefix:"CISA-ALERT", source:"CISA Alerts",
    source_url:"https://www.cisa.gov/news-events/cybersecurity-advisories",
    source_color:"#e05000", source_flag:"🇺🇸", category:"advisory",
    default_sev:"HIGH", exploit_wild:false, patch_avail:true, limit:10,
    countries:["US"],
  });
}

// ── 3. NVD Critical CVEs ──────────────────────────────────────────────────────
async function fetchNVDCritical() {
  const end   = new Date().toISOString().replace(/\.\d{3}Z$/, ".000");
  const start = new Date(Date.now() - 30*24*60*60*1000).toISOString().replace(/\.\d{3}Z$/, ".000");
  const url   = `https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=${start}&pubEndDate=${end}&cvssV3Severity=CRITICAL&resultsPerPage=15`;
  const r     = await fetch(url, { headers:{ "User-Agent":"BCyberAware/2.0" } });
  const data  = await r.json();
  return (data.vulnerabilities || []).flatMap(item => {
    const cve  = item.cve;
    const desc = (cve.descriptions || []).find(d => d.lang === "en")?.value || "";
    if (!desc || desc.includes("** RESERVED **")) return [];
    const sev  = cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseSeverity
              || cve.metrics?.cvssMetricV30?.[0]?.cvssData?.baseSeverity
              || "CRITICAL";
    const products = [...new Set(
      (cve.configurations||[]).flatMap(c =>
        (c.nodes||[]).flatMap(n =>
          (n.cpeMatch||[]).map(cpe => {
            const p = (cpe.criteria||"").split(":");
            const v = (p[3]||"").replace(/_/g," ");
            const pr= (p[4]||"").replace(/_/g," ");
            return v&&v!=="*"&&pr&&pr!=="*" ? `${v} ${pr}` : null;
          }).filter(Boolean)
        )
      )
    )].slice(0,4);
    return [{
      id:"NVD-"+cve.id, title:desc.length>100?desc.slice(0,97)+"…":desc,
      severity:sev, category:"advisory", date:fmtDate(cve.published),
      _rawDate:cve.published, source:"NVD / CVE.org",
      source_url:`https://nvd.nist.gov/vuln/detail/${cve.id}`,
      source_color:"#8b0000", source_flag:"🌐", cve_ids:[cve.id],
      affected_products:products.length?products:["Multiple Products"],
      summary:desc, threat_actor:null, countries:["US","GB","DE","CN","RU"],
      middle_east_relevance:getMERelevance(products, desc, ""),
      patch_available:(cve.references||[]).length>0, exploit_in_wild:false,
    }];
  });
}

// ── 4. CERT-In India ──────────────────────────────────────────────────────────
async function fetchCERTIn() {
  const r   = await fetch("https://www.cert-in.org.in/RSS/CertIn_Security_Advisories.xml",
                          { headers:{ "User-Agent":"BCyberAware/2.0" } });
  const xml = await r.text();
  return parseRSS(xml, {
    id_prefix:"CERTIN", source:"CERT-In (India)",
    source_url:"https://www.cert-in.org.in", source_color:"#ff6b00",
    source_flag:"🇮🇳", category:"advisory", default_sev:"HIGH",
    exploit_wild:false, patch_avail:true, limit:12, countries:["IN"],
  });
}

// ── 5. NCSC UK ────────────────────────────────────────────────────────────────
async function fetchNCSCUK() {
  const r   = await fetch("https://www.ncsc.gov.uk/api/1/services/v1/report-rss-feed.xml",
                          { headers:{ "User-Agent":"BCyberAware/2.0" } });
  const xml = await r.text();
  return parseRSS(xml, {
    id_prefix:"NCSC-UK", source:"NCSC UK",
    source_url:"https://www.ncsc.gov.uk", source_color:"#003078",
    source_flag:"🇬🇧", category:"advisory", default_sev:"HIGH",
    exploit_wild:false, patch_avail:true, limit:10, countries:["GB"],
  });
}

// ── 6. Exploit-DB ─────────────────────────────────────────────────────────────
async function fetchExploitDB() {
  const r   = await fetch("https://www.exploit-db.com/rss.xml",
                          { headers:{ "User-Agent":"BCyberAware/2.0" } });
  const xml = await r.text();
  return parseRSS(xml, {
    id_prefix:"EDBID", source:"Exploit-DB",
    source_url:"https://www.exploit-db.com", source_color:"#cc0000",
    source_flag:"⚡", category:"exploit", default_sev:"HIGH",
    exploit_wild:true, patch_avail:false, limit:15, countries:["US","RU","CN"],
  });
}

// ── 7. Packet Storm ───────────────────────────────────────────────────────────
async function fetchPacketStorm() {
  const r   = await fetch("https://rss.packetstormsecurity.com/files/",
                          { headers:{ "User-Agent":"BCyberAware/2.0" } });
  const xml = await r.text();
  return parseRSS(xml, {
    id_prefix:"PKTSTORM", source:"Packet Storm",
    source_url:"https://packetstormsecurity.com", source_color:"#880000",
    source_flag:"⚡", category:"exploit", default_sev:"HIGH",
    exploit_wild:true, patch_avail:false, limit:10, countries:["US","DE","RU"],
  });
}

// ── 8. The Hacker News ────────────────────────────────────────────────────────
async function fetchTheHackerNews() {
  const r   = await fetch("https://feeds.feedburner.com/TheHackersNews",
                          { headers:{ "User-Agent":"BCyberAware/2.0" } });
  const xml = await r.text();
  return parseRSS(xml, {
    id_prefix:"THN", source:"The Hacker News",
    source_url:"https://thehackernews.com", source_color:"#e91e63",
    source_flag:"📰", category:"news", default_sev:"HIGH",
    exploit_wild:false, patch_avail:false, limit:12, countries:["US","CN","RU","IR"],
  });
}

// ── 9. Bleeping Computer ──────────────────────────────────────────────────────
async function fetchBleepingComputer() {
  const r   = await fetch("https://www.bleepingcomputer.com/feed/",
                          { headers:{ "User-Agent":"BCyberAware/2.0" } });
  const xml = await r.text();
  return parseRSS(xml, {
    id_prefix:"BC", source:"Bleeping Computer",
    source_url:"https://www.bleepingcomputer.com", source_color:"#2196f3",
    source_flag:"📰", category:"news", default_sev:"MEDIUM",
    exploit_wild:false, patch_avail:false, limit:12, countries:["US","RU","CN"],
  });
}

// ── 10. SANS ISC ──────────────────────────────────────────────────────────────
async function fetchSANSISC() {
  const r   = await fetch("https://isc.sans.edu/rssfeed.xml",
                          { headers:{ "User-Agent":"BCyberAware/2.0" } });
  const xml = await r.text();
  return parseRSS(xml, {
    id_prefix:"SANS", source:"SANS ISC",
    source_url:"https://isc.sans.edu", source_color:"#ff9800",
    source_flag:"🔍", category:"news", default_sev:"MEDIUM",
    exploit_wild:false, patch_avail:false, limit:10, countries:["US"],
  });
}

// ── 11. SecurityWeek ─────────────────────────────────────────────────────────
async function fetchSecurityWeek() {
  const r   = await fetch("https://feeds.feedburner.com/securityweek",
                          { headers:{ "User-Agent":"BCyberAware/2.0" } });
  const xml = await r.text();
  return parseRSS(xml, {
    id_prefix:"SECWK", source:"SecurityWeek",
    source_url:"https://www.securityweek.com", source_color:"#1565c0",
    source_flag:"📰", category:"news", default_sev:"HIGH",
    exploit_wild:false, patch_avail:false, limit:10, countries:["US","CN","RU","IR"],
  });
}

// ── 12. Krebs on Security ─────────────────────────────────────────────────────
async function fetchKrebsOnSecurity() {
  const r   = await fetch("https://krebsonsecurity.com/feed/",
                          { headers:{ "User-Agent":"BCyberAware/2.0" } });
  const xml = await r.text();
  return parseRSS(xml, {
    id_prefix:"KREBS", source:"Krebs on Security",
    source_url:"https://krebsonsecurity.com", source_color:"#4a148c",
    source_flag:"📰", category:"news", default_sev:"HIGH",
    exploit_wild:false, patch_avail:false, limit:8, countries:["US","RU","CN"],
  });
}

// ── 13. AlienVault OTX ───────────────────────────────────────────────────────
async function fetchAlienVaultOTX() {
  const r   = await fetch("https://otx.alienvault.com/api/v1/pulses/subscribed_direct?limit=10&page=1",
                          { headers:{ "User-Agent":"BCyberAware/2.0", "Content-Type":"application/json" } });
  if (!r.ok) {
    // Fallback to OTX blog RSS
    const rss = await fetch("https://otx.alienvault.com/blog/rss",
                            { headers:{ "User-Agent":"BCyberAware/2.0" } });
    const xml = await rss.text();
    return parseRSS(xml, {
      id_prefix:"OTX", source:"AlienVault OTX",
      source_url:"https://otx.alienvault.com", source_color:"#00897b",
      source_flag:"🛸", category:"news", default_sev:"HIGH",
      exploit_wild:false, patch_avail:false, limit:8, countries:["US","CN","RU","IR","KP"],
    });
  }
  const data = await r.json();
  return (data.results||[]).slice(0,8).map(p => ({
    id:                    "OTX-" + p.id,
    title:                 p.name || "AlienVault OTX Pulse",
    severity:              "HIGH",
    category:              "news",
    date:                  fmtDate(p.created),
    _rawDate:              p.created,
    source:                "AlienVault OTX",
    source_url:            `https://otx.alienvault.com/pulse/${p.id}`,
    source_color:          "#00897b",
    source_flag:           "🛸",
    cve_ids:               (p.references||[]).filter(r=>r.includes("CVE")).slice(0,3),
    affected_products:     (p.tags||[]).slice(0,3),
    summary:               p.description || p.name,
    threat_actor:          p.adversary || null,
    countries:             (p.targeted_countries||["US"]).slice(0,5),
    middle_east_relevance: (p.targeted_countries||[]).some(c=>
                            ["AE","SA","QA","KW","BH","OM","IQ","IR"].includes(c))?"HIGH":"MEDIUM",
    patch_available:       false,
    exploit_in_wild:       false,
  }));
}

// ── 14. Telegram DarkFeed (public channel via web) ────────────────────────────
async function fetchTelegramDarkFeed() {
  // Read public Telegram channel without auth via t.me/s/
  const channels = ["secharvester","cybersecuritynews_tg"];
  const results  = [];
  for (const ch of channels) {
    try {
      const r   = await fetch(`https://t.me/s/${ch}`,
                              { headers:{ "User-Agent":"BCyberAware/2.0" } });
      const html = await r.text();
      // Extract messages
      const msgs = [...html.matchAll(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/g)].slice(0,5);
      const dates= [...html.matchAll(/datetime="([^"]+)"/g)].slice(0,5);
      const links= [...html.matchAll(/href="(https:\/\/t\.me\/[^"]+)"/g)].slice(0,5);
      msgs.forEach((m, i) => {
        const text = m[1].replace(/<[^>]+>/g,"").trim();
        if (!text || text.length < 20) return;
        const cves = [...new Set((text).match(/CVE-\d{4}-\d{4,7}/g)||[])].slice(0,3);
        const ts   = dates[i] ? new Date(dates[i][1]).getTime() : Date.now();
        results.push({
          id:                    `TG-${ch.toUpperCase()}-${i}-${ts}`,
          title:                 text.slice(0,100) + (text.length>100?"…":""),
          severity:              text.toLowerCase().includes("critical")?"CRITICAL":"HIGH",
          category:              "news",
          date:                  fmtDate(new Date(ts).toISOString()),
          _rawDate:              new Date(ts).toISOString(),
          source:                `Telegram: @${ch}`,
          source_url:            links[i]?links[i][1]:`https://t.me/${ch}`,
          source_color:          "#0088cc",
          source_flag:           "📡",
          cve_ids:               cves,
          affected_products:     [],
          summary:               text.slice(0,300),
          threat_actor:          null,
          countries:             ["RU","CN","IR","KP","US"],
          middle_east_relevance: "MEDIUM",
          patch_available:       false,
          exploit_in_wild:       text.toLowerCase().includes("exploit")||text.toLowerCase().includes("0day"),
        });
      });
    } catch {}
  }
  return results;
}

// ── Heatmap Builder ───────────────────────────────────────────────────────────
function buildHeatmap(all) {
  const counts = {};
  const COUNTRY_NAMES = {
    US:"United States", GB:"United Kingdom", CN:"China", RU:"Russia",
    IN:"India", DE:"Germany", AU:"Australia", CA:"Canada", FR:"France",
    IR:"Iran", KP:"North Korea", AE:"UAE", SA:"Saudi Arabia",
    QA:"Qatar", KW:"Kuwait", PK:"Pakistan", UA:"Ukraine", BR:"Brazil",
    JP:"Japan", KR:"South Korea", NL:"Netherlands", SG:"Singapore",
    TR:"Turkey", IL:"Israel", ZA:"South Africa", NG:"Nigeria",
    MX:"Mexico", IT:"Italy", ES:"Spain", SE:"Sweden",
  };
  all.forEach(a => {
    (a.countries||[]).forEach(c => {
      counts[c] = (counts[c]||0) + (
        a.severity==="CRITICAL"?4 : a.severity==="HIGH"?3 :
        a.severity==="MEDIUM"?2 : 1
      );
    });
  });
  return Object.entries(counts)
    .sort((a,b) => b[1]-a[1])
    .slice(0,20)
    .map(([code, score]) => ({
      code, score,
      name: COUNTRY_NAMES[code] || code,
      level: score>20?"CRITICAL" : score>12?"HIGH" : score>6?"MEDIUM" : "LOW",
    }));
}

// ── Generic RSS Parser ────────────────────────────────────────────────────────
function parseRSS(xml, opts) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, opts.limit);
  return items.flatMap(([, block]) => {
    const get = tag =>
      (block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`))
      ||block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
      ||[])[1]?.trim() || "";
    const title = get("title").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">");
    const desc  = get("description").replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").trim();
    const link  = get("link") || get("guid") || opts.source_url;
    const date  = get("pubDate") || get("dc:date") || "";
    if (!title) return [];
    const cves  = [...new Set((title+" "+desc).match(/CVE-\d{4}-\d{4,7}/g)||[])].slice(0,5);
    const lower = (title+" "+desc).toLowerCase();
    const sev   = lower.includes("critical")?"CRITICAL":lower.includes("high")?"HIGH":opts.default_sev;
    const ts    = date ? new Date(date).getTime() : Date.now();
    const hashId= Math.abs([...title].reduce((h,c)=>Math.imul(31,h)+c.charCodeAt(0)|0,0))
                      .toString(16).slice(0,8).toUpperCase();
    const pm    = title.match(/(?:for|in|affecting)\s+(.+?)(?:\s*$|\s*[-–(])/i);
    return [{
      id:`${opts.id_prefix}-${hashId}`, title, severity:sev,
      category:opts.category, date:fmtDate(new Date(ts).toISOString()),
      _rawDate:new Date(ts).toISOString(), source:opts.source,
      source_url:link, source_color:opts.source_color,
      source_flag:opts.source_flag, cve_ids:cves,
      affected_products:pm?[pm[1].trim()]:[],
      summary:desc.length>300?desc.slice(0,297)+"…":(desc||title),
      threat_actor:null, countries:opts.countries||["US"],
      middle_east_relevance:getMERelevance(pm?[pm[1]]:[],title,desc),
      patch_available:opts.patch_avail,
      exploit_in_wild:opts.exploit_wild||lower.includes("exploit")||lower.includes("ransomware"),
    }];
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString("en-GB",
    { day:"2-digit", month:"short", year:"numeric" });
}
function getMERelevance(products, title, desc) {
  const text = [...products, title, desc].join(" ").toLowerCase();
  const hi   = ["fortinet","palo alto","cisco","microsoft","sap","ivanti","juniper",
                 "f5","checkpoint","vmware","citrix","oracle","exchange","sharepoint",
                 "windows server","active directory","vpn","firewall","logistics",
                 "transport","energy","oil","gas","government","banking","finance",
                 "telecom","scada","industrial","ics"," ot ","middle east",
                 "gcc","uae","saudi","dubai","qatar","kuwait","bahrain","oman","india"];
  return hi.some(k=>text.includes(k))?"HIGH":"MEDIUM";
}
function dedup(arr) {
  const seen = new Set();
  return arr.filter(a => {
    const k = a.cve_ids?.length ? a.cve_ids.join(",") : a.id;
    return seen.has(k) ? false : (seen.add(k), true);
  });
}
