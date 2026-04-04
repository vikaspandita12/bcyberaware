/**
 * BCyberAware – Secure Serverless Proxy
 * Author : Vikas Pandita | BCyberAware
 * Host   : Netlify Functions (free tier)
 *
 * Handles:
 *   GET  ?action=feed  → Real advisories from CISA KEV + NVD + CERT-In India
 *   POST (no params)   → Secure Anthropic Claude proxy
 *
 * Your API key is stored in Netlify env variables — never in code.
 */

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const CACHE = {};        // In-memory cache (resets on cold start, good enough)
const CACHE_MS = 6 * 60 * 60 * 1000; // 6 hours

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type":                 "application/json",
  };

  if (event.httpMethod === "OPTIONS")
    return { statusCode: 200, headers, body: "" };

  // ── GET ?action=feed ──────────────────────────────────────────────────────
  if (event.httpMethod === "GET" && event.queryStringParameters?.action === "feed") {
    try {
      const now = Date.now();
      if (CACHE.feed && (now - CACHE.feed.ts) < CACHE_MS) {
        return { statusCode:200, headers, body: JSON.stringify({ ...CACHE.feed.data, from_cache:true }) };
      }
      const [cisa, nvd, certin] = await Promise.allSettled([
        fetchCISAKEV(), fetchNVDCritical(), fetchCERTIn()
      ]);
      let advisories = [
        ...(cisa.status  === "fulfilled" ? cisa.value  : []),
        ...(nvd.status   === "fulfilled" ? nvd.value   : []),
        ...(certin.status=== "fulfilled" ? certin.value: []),
      ];
      advisories.sort((a,b) => new Date(b._rawDate) - new Date(a._rawDate));
      advisories = dedup(advisories).slice(0, 50);
      advisories.forEach(a => delete a._rawDate);

      const payload = {
        advisories,
        fetched_at_human: new Date().toUTCString(),
        sources: [
          { name:"CISA KEV",      status:"live",   url:"https://www.cisa.gov/known-exploited-vulnerabilities-catalog" },
          { name:"NVD / CVE.org", status:"live",   url:"https://nvd.nist.gov" },
          { name:"CERT-In India", status:"live",   url:"https://www.cert-in.org.in" },
          { name:"UAE CERT",      status:"no_api", note:"No public machine-readable API" },
          { name:"Saudi CERT",    status:"no_api", note:"No public machine-readable API" },
        ],
      };
      CACHE.feed = { ts: now, data: payload };
      return { statusCode:200, headers, body: JSON.stringify(payload) };
    } catch(e) {
      return { statusCode:500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  // ── POST → Claude proxy ───────────────────────────────────────────────────
  if (event.httpMethod === "POST") {
    if (!ANTHROPIC_KEY)
      return { statusCode:500, headers, body: JSON.stringify({ error:"API key not configured" }) };
    try {
      const body = JSON.parse(event.body || "{}");
      if (!body.messages) return { statusCode:400, headers, body: JSON.stringify({ error:"Invalid body" }) };
      body.model      = "claude-sonnet-4-20250514";
      body.max_tokens = Math.min(body.max_tokens || 1000, 1500);

      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type":      "application/json",
          "x-api-key":         ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      return { statusCode: r.status, headers, body: JSON.stringify(data) };
    } catch(e) {
      return { statusCode:502, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  return { statusCode:405, headers, body: JSON.stringify({ error:"Method not allowed" }) };
};

// ── CISA KEV ──────────────────────────────────────────────────────────────────
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
      date:                  fmtDate(v.dateAdded),
      _rawDate:              v.dateAdded,
      source:                "CISA KEV",
      source_url:            "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
      source_color:          "#e05000",
      cve_ids:               [v.cveID],
      affected_products:     [v.vendorProject + " " + v.product],
      summary:               v.shortDescription + " Required action: " + v.requiredAction,
      threat_actor:          (v.knownRansomwareCampaignUse && v.knownRansomwareCampaignUse !== "Unknown") ? "Ransomware: " + v.knownRansomwareCampaignUse : null,
      middle_east_relevance: getMERelevance([v.vendorProject, v.product], v.vulnerabilityName, v.shortDescription),
      patch_available:       true,
      exploit_in_wild:       true,
    }));
}

// ── NVD Critical CVEs ─────────────────────────────────────────────────────────
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

    const sev = cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseSeverity
             || cve.metrics?.cvssMetricV30?.[0]?.cvssData?.baseSeverity
             || "CRITICAL";

    const products = [...new Set(
      (cve.configurations || []).flatMap(c =>
        (c.nodes || []).flatMap(n =>
          (n.cpeMatch || []).map(cpe => {
            const p = (cpe.criteria || "").split(":");
            const v = (p[3]||"").replace(/_/g," ");
            const pr= (p[4]||"").replace(/_/g," ");
            return v && v!=="*" && pr && pr!=="*" ? `${v} ${pr}` : null;
          }).filter(Boolean)
        )
      )
    )].slice(0,4);

    return [{
      id:                    "NVD-" + cve.id,
      title:                 desc.length > 100 ? desc.slice(0,97)+"…" : desc,
      severity:              sev,
      date:                  fmtDate(cve.published),
      _rawDate:              cve.published,
      source:                "NVD / CVE.org",
      source_url:            `https://nvd.nist.gov/vuln/detail/${cve.id}`,
      source_color:          "#8b0000",
      cve_ids:               [cve.id],
      affected_products:     products.length ? products : ["Multiple Products"],
      summary:               desc,
      threat_actor:          null,
      middle_east_relevance: getMERelevance(products, desc, ""),
      patch_available:       (cve.references || []).length > 0,
      exploit_in_wild:       false,
    }];
  });
}

// ── CERT-In India RSS ─────────────────────────────────────────────────────────
async function fetchCERTIn() {
  const r   = await fetch("https://www.cert-in.org.in/RSS/CertIn_Security_Advisories.xml",
                          { headers:{ "User-Agent":"BCyberAware/2.0" } });
  const xml = await r.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0,12);
  return items.flatMap(([, block]) => {
    const get  = tag => (block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`))||block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))||[])[1]?.trim() || "";
    const title = get("title");
    const desc  = get("description").replace(/<[^>]+>/g,"").trim();
    const link  = get("link");
    const date  = get("pubDate");
    if (!title) return [];
    const cves  = [...new Set((title+" "+desc).match(/CVE-\d{4}-\d{4,7}/g)||[])].slice(0,5);
    const lower = (title+" "+desc).toLowerCase();
    const sev   = lower.includes("critical")?"CRITICAL":lower.includes("high")?"HIGH":"HIGH";
    const pm    = title.match(/(?:for|in|affecting)\s+(.+?)(?:\s*$|\s*[-–(])/i);
    const products = pm ? [pm[1].trim()] : ["Multiple Products"];
    const ts = date ? new Date(date).getTime() : Date.now();
    return [{
      id:                    "CERTIN-" + Math.abs([...title].reduce((h,c)=>Math.imul(31,h)+c.charCodeAt(0)|0,0)).toString(16).slice(0,8).toUpperCase(),
      title,
      severity:              sev,
      date:                  fmtDate(new Date(ts).toISOString()),
      _rawDate:              new Date(ts).toISOString(),
      source:                "CERT-In (India)",
      source_url:            link || "https://www.cert-in.org.in",
      source_color:          "#ff6b00",
      cve_ids:               cves,
      affected_products:     products,
      summary:               desc.length > 300 ? desc.slice(0,297)+"…" : desc || title,
      threat_actor:          null,
      middle_east_relevance: getMERelevance(products, title, desc),
      patch_available:       true,
      exploit_in_wild:       false,
    }];
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" });
}

function getMERelevance(products, title, desc) {
  const text = [...products, title, desc].join(" ").toLowerCase();
  const hi = ["fortinet","palo alto","cisco","microsoft","sap","ivanti","juniper","f5","checkpoint",
              "vmware","citrix","oracle","exchange","sharepoint","windows server","active directory",
              "vpn","firewall","logistics","transport","energy","oil","gas","government","banking",
              "finance","telecom","scada","industrial control","ics"," ot "];
  return hi.some(k => text.includes(k)) ? "HIGH" : "MEDIUM";
}

function dedup(arr) {
  const seen = new Set();
  return arr.filter(a => {
    const k = a.cve_ids?.length ? a.cve_ids.join(",") : a.id;
    return seen.has(k) ? false : (seen.add(k), true);
  });
}
