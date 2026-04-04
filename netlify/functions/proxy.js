/**
 * BCyberAware – Live Threat Feed (9 Sources, Free, No API Key)
 * Author : Vikas Pandita | BCyberAware
 *
 * Sources:
 *   ADVISORIES : CISA KEV · CISA Alerts · NVD · CERT-In India · NCSC UK
 *   EXPLOITS   : Exploit-DB
 *   NEWS       : The Hacker News · Bleeping Computer · SANS ISC
 */

const CACHE    = {};
const CACHE_MS = 6 * 60 * 60 * 1000; // 6 hours

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

      // Fetch all sources in parallel
      const [cisaKev, cisaAlerts, nvd, certIn, ncscUk, exploitDb, thn, bc, sans] =
        await Promise.allSettled([
          fetchCISAKEV(),
          fetchCISAAlerts(),
          fetchNVDCritical(),
          fetchCERTIn(),
          fetchNCSCUK(),
          fetchExploitDB(),
          fetchTheHackerNews(),
          fetchBleepingComputer(),
          fetchSANSISC(),
        ]);

      const get = r => r.status === "fulfilled" ? r.value : [];

      const advisories = [
        ...get(cisaKev), ...get(cisaAlerts), ...get(nvd),
        ...get(certIn),  ...get(ncscUk),
      ];
      const exploits = get(exploitDb);
      const news     = [...get(thn), ...get(bc), ...get(sans)];

      // Sort each by date, deduplicate
      const sortAndDedup = arr => {
        arr.sort((a,b) => new Date(b._rawDate) - new Date(a._rawDate));
        return dedup(arr).map(a => { delete a._rawDate; return a; });
      };

      const payload = {
        advisories: sortAndDedup(advisories).slice(0, 40),
        exploits:   sortAndDedup(exploits).slice(0, 20),
        news:       sortAndDedup(news).slice(0, 30),
        fetched_at_human: new Date().toUTCString(),
        sources: [
          { name:"CISA KEV",           status:"live", category:"advisory", flag:"🇺🇸", url:"https://www.cisa.gov/known-exploited-vulnerabilities-catalog" },
          { name:"CISA Alerts",        status:"live", category:"advisory", flag:"🇺🇸", url:"https://www.cisa.gov/news-events/cybersecurity-advisories" },
          { name:"NVD / CVE.org",      status:"live", category:"advisory", flag:"🌐", url:"https://nvd.nist.gov" },
          { name:"CERT-In India",      status:"live", category:"advisory", flag:"🇮🇳", url:"https://www.cert-in.org.in" },
          { name:"NCSC UK",            status:"live", category:"advisory", flag:"🇬🇧", url:"https://www.ncsc.gov.uk/section/keep-up-to-date/reports" },
          { name:"Exploit-DB",         status:"live", category:"exploit",  flag:"⚡", url:"https://www.exploit-db.com" },
          { name:"The Hacker News",    status:"live", category:"news",     flag:"📰", url:"https://thehackernews.com" },
          { name:"Bleeping Computer",  status:"live", category:"news",     flag:"📰", url:"https://www.bleepingcomputer.com" },
          { name:"SANS ISC",           status:"live", category:"news",     flag:"🔍", url:"https://isc.sans.edu" },
          { name:"UAE CERT",           status:"no_api", category:"advisory", flag:"🇦🇪", url:"https://www.tra.gov.ae", note:"No public API" },
          { name:"Saudi CERT",         status:"no_api", category:"advisory", flag:"🇸🇦", url:"https://www.ncsc.gov.sa", note:"No public API" },
          { name:"Twitter/X Security", status:"no_api", category:"news",     flag:"🐦", url:"https://twitter.com", note:"API now paid ($100/mo) — covered via THN & Bleeping Computer" },
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
    id_prefix:    "CISA-ALERT",
    source:       "CISA Alerts",
    source_url:   "https://www.cisa.gov/news-events/cybersecurity-advisories",
    source_color: "#e05000",
    source_flag:  "🇺🇸",
    category:     "advisory",
    default_sev:  "HIGH",
    exploit_wild: false,
    patch_avail:  true,
    limit:        10,
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
      id:                    "NVD-" + cve.id,
      title:                 desc.length>100 ? desc.slice(0,97)+"…" : desc,
      severity:              sev,
      category:              "advisory",
      date:                  fmtDate(cve.published),
      _rawDate:              cve.published,
      source:                "NVD / CVE.org",
      source_url:            `https://nvd.nist.gov/vuln/detail/${cve.id}`,
      source_color:          "#8b0000",
      source_flag:           "🌐",
      cve_ids:               [cve.id],
      affected_products:     products.length ? products : ["Multiple Products"],
      summary:               desc,
      threat_actor:          null,
      middle_east_relevance: getMERelevance(products, desc, ""),
      patch_available:       (cve.references||[]).length > 0,
      exploit_in_wild:       false,
    }];
  });
}

// ── 4. CERT-In India RSS ──────────────────────────────────────────────────────
async function fetchCERTIn() {
  const r   = await fetch("https://www.cert-in.org.in/RSS/CertIn_Security_Advisories.xml",
                          { headers:{ "User-Agent":"BCyberAware/2.0" } });
  const xml = await r.text();
  return parseRSS(xml, {
    id_prefix:    "CERTIN",
    source:       "CERT-In (India)",
    source_url:   "https://www.cert-in.org.in",
    source_color: "#ff6b00",
    source_flag:  "🇮🇳",
    category:     "advisory",
    default_sev:  "HIGH",
    exploit_wild: false,
    patch_avail:  true,
    limit:        12,
  });
}

// ── 5. NCSC UK RSS ────────────────────────────────────────────────────────────
async function fetchNCSCUK() {
  const r   = await fetch("https://www.ncsc.gov.uk/api/1/services/v1/report-rss-feed.xml",
                          { headers:{ "User-Agent":"BCyberAware/2.0" } });
  const xml = await r.text();
  return parseRSS(xml, {
    id_prefix:    "NCSC-UK",
    source:       "NCSC UK",
    source_url:   "https://www.ncsc.gov.uk",
    source_color: "#003078",
    source_flag:  "🇬🇧",
    category:     "advisory",
    default_sev:  "HIGH",
    exploit_wild: false,
    patch_avail:  true,
    limit:        10,
  });
}

// ── 6. Exploit-DB RSS ─────────────────────────────────────────────────────────
async function fetchExploitDB() {
  const r   = await fetch("https://www.exploit-db.com/rss.xml",
                          { headers:{ "User-Agent":"BCyberAware/2.0" } });
  const xml = await r.text();
  return parseRSS(xml, {
    id_prefix:    "EDBID",
    source:       "Exploit-DB",
    source_url:   "https://www.exploit-db.com",
    source_color: "#cc0000",
    source_flag:  "⚡",
    category:     "exploit",
    default_sev:  "HIGH",
    exploit_wild: true,
    patch_avail:  false,
    limit:        15,
  });
}

// ── 7. The Hacker News RSS ────────────────────────────────────────────────────
async function fetchTheHackerNews() {
  const r   = await fetch("https://feeds.feedburner.com/TheHackersNews",
                          { headers:{ "User-Agent":"BCyberAware/2.0" } });
  const xml = await r.text();
  return parseRSS(xml, {
    id_prefix:    "THN",
    source:       "The Hacker News",
    source_url:   "https://thehackernews.com",
    source_color: "#e91e63",
    source_flag:  "📰",
    category:     "news",
    default_sev:  "HIGH",
    exploit_wild: false,
    patch_avail:  false,
    limit:        12,
  });
}

// ── 8. Bleeping Computer RSS ──────────────────────────────────────────────────
async function fetchBleepingComputer() {
  const r   = await fetch("https://www.bleepingcomputer.com/feed/",
                          { headers:{ "User-Agent":"BCyberAware/2.0" } });
  const xml = await r.text();
  return parseRSS(xml, {
    id_prefix:    "BC",
    source:       "Bleeping Computer",
    source_url:   "https://www.bleepingcomputer.com",
    source_color: "#2196f3",
    source_flag:  "📰",
    category:     "news",
    default_sev:  "MEDIUM",
    exploit_wild: false,
    patch_avail:  false,
    limit:        12,
  });
}

// ── 9. SANS ISC RSS ───────────────────────────────────────────────────────────
async function fetchSANSISC() {
  const r   = await fetch("https://isc.sans.edu/rssfeed.xml",
                          { headers:{ "User-Agent":"BCyberAware/2.0" } });
  const xml = await r.text();
  return parseRSS(xml, {
    id_prefix:    "SANS",
    source:       "SANS ISC",
    source_url:   "https://isc.sans.edu",
    source_color: "#ff9800",
    source_flag:  "🔍",
    category:     "news",
    default_sev:  "MEDIUM",
    exploit_wild: false,
    patch_avail:  false,
    limit:        10,
  });
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

    const cves    = [...new Set((title+" "+desc).match(/CVE-\d{4}-\d{4,7}/g)||[])].slice(0,5);
    const lower   = (title+" "+desc).toLowerCase();
    const sev     = lower.includes("critical") ? "CRITICAL"
                  : lower.includes("high")     ? "HIGH"
                  : opts.default_sev;
    const ts      = date ? new Date(date).getTime() : Date.now();
    const hashId  = Math.abs([...title].reduce((h,c) => Math.imul(31,h)+c.charCodeAt(0)|0,0))
                        .toString(16).slice(0,8).toUpperCase();

    // Extract product from title
    const pm       = title.match(/(?:for|in|affecting)\s+(.+?)(?:\s*$|\s*[-–(])/i);
    const products = pm ? [pm[1].trim()] : [];

    return [{
      id:                    `${opts.id_prefix}-${hashId}`,
      title,
      severity:              sev,
      category:              opts.category,
      date:                  fmtDate(new Date(ts).toISOString()),
      _rawDate:              new Date(ts).toISOString(),
      source:                opts.source,
      source_url:            link,
      source_color:          opts.source_color,
      source_flag:           opts.source_flag,
      cve_ids:               cves,
      affected_products:     products,
      summary:               desc.length>300 ? desc.slice(0,297)+"…" : (desc||title),
      threat_actor:          null,
      middle_east_relevance: getMERelevance(products, title, desc),
      patch_available:       opts.patch_avail,
      exploit_in_wild:       opts.exploit_wild ||
                             lower.includes("exploit") ||
                             lower.includes("actively") ||
                             lower.includes("ransomware"),
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
                 "telecom","scada","industrial control","ics"," ot ","middle east",
                 "gcc","uae","saudi","dubai","qatar","kuwait","bahrain","oman"];
  return hi.some(k => text.includes(k)) ? "HIGH" : "MEDIUM";
}

function dedup(arr) {
  const seen = new Set();
  return arr.filter(a => {
    const k = a.cve_ids?.length ? a.cve_ids.join(",") : a.id;
    return seen.has(k) ? false : (seen.add(k), true);
  });
}
