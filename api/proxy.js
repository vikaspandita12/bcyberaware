/**
 * BCyberAware – Live Threat Feed (Vercel Edition)
 * Author  : Vikas Pandita | BCyberAware
 * Host    : Vercel (free — 1,000,000 function calls/month)
 * Sources : 16 live sources
 * Cache   : 1 hour in-memory
 */

const CACHE    = {};
const CACHE_MS = 60 * 60 * 1000;

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")     return res.status(405).json({ error:"Method not allowed" });

  const action = req.query.action;
  const bust   = req.query.bust === "1";

  if (action !== "feed") return res.status(400).json({ error:"Unknown action" });

  try {
    const now = Date.now();
    if (!bust && CACHE.feed && (now - CACHE.feed.ts) < CACHE_MS)
      return res.status(200).json({ ...CACHE.feed.data, from_cache:true });

    const results = await Promise.allSettled([
      /*  0 */ fetchCISAKEV(),
      /*  1 */ fetchCISAAlerts(),
      /*  2 */ fetchNVDCritical(),
      /*  3 */ fetchCERTIn(),
      /*  4 */ fetchNCSCUK(),
      /*  5 */ fetchExploitDB(),
      /*  6 */ fetchPacketStorm(),
      /*  7 */ fetchTheHackerNews(),
      /*  8 */ fetchBleepingComputer(),
      /*  9 */ fetchSANSISC(),
      /* 10 */ fetchSecurityWeek(),
      /* 11 */ fetchKrebsOnSecurity(),
      /* 12 */ fetchAlienVaultOTX(),
      /* 13 */ fetchTelegramDarkFeed(),
      /* 14 */ fetchTheHindu(),
      /* 15 */ fetchEconomicTimes(),
    ]);

    const [
      r_cisaKev, r_cisaAlerts, r_nvd, r_certIn, r_ncscUk,
      r_exploitDb, r_packetStorm,
      r_thn, r_bc, r_sans, r_secWeek, r_krebs,
      r_otx, r_telegram,
      r_theHindu, r_econTimes,
    ] = results;

    const get = r => r.status === "fulfilled" ? (r.value || []) : [];

    const advisories = [
      ...get(r_cisaKev), ...get(r_cisaAlerts),
      ...get(r_nvd),     ...get(r_certIn), ...get(r_ncscUk),
    ];
    const exploits = [...get(r_exploitDb), ...get(r_packetStorm)];
    const news = [
      ...get(r_thn),      ...get(r_bc),
      ...get(r_sans),     ...get(r_secWeek),
      ...get(r_krebs),    ...get(r_otx),
      ...get(r_telegram), ...get(r_theHindu),
      ...get(r_econTimes),
    ];

    const sortAndDedup = arr => {
      arr.sort((a,b) => new Date(b._rawDate) - new Date(a._rawDate));
      return dedup(arr).map(a => { delete a._rawDate; return a; });
    };

    const payload = {
      advisories: sortAndDedup(advisories).slice(0, 40),
      exploits:   sortAndDedup(exploits).slice(0, 20),
      news:       sortAndDedup(news).slice(0, 40),
      heatmap:    buildHeatmap([...advisories, ...exploits, ...news]),
      fetched_at:       now,
      fetched_at_human: new Date().toUTCString(),
      from_cache:       false,
    };

    CACHE.feed = { ts:now, data:payload };
    return res.status(200).json(payload);

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
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
      id:"CISA-KEV-"+v.cveID, title:v.vulnerabilityName,
      severity:"CRITICAL", category:"advisory",
      date:fmtDate(v.dateAdded), _rawDate:v.dateAdded,
      source:"CISA KEV",
      source_url:"https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
      source_color:"#e05000", source_flag:"🇺🇸",
      cve_ids:[v.cveID],
      affected_products:[v.vendorProject+" "+v.product],
      summary:v.shortDescription+" Required action: "+v.requiredAction,
      threat_actor:(v.knownRansomwareCampaignUse&&v.knownRansomwareCampaignUse!=="Unknown")?"Ransomware: "+v.knownRansomwareCampaignUse:null,
      countries:["US","GB","DE","AU","CA"],
      middle_east_relevance:getMERelevance([v.vendorProject,v.product],v.vulnerabilityName,v.shortDescription),
      patch_available:true, exploit_in_wild:true,
    }));
}

// ── 2. CISA Alerts ────────────────────────────────────────────────────────────
async function fetchCISAAlerts() {
  try {
    const r = await fetch("https://www.cisa.gov/uscert/ncas/alerts.xml",{headers:{"User-Agent":"BCyberAware/2.0"}});
    return parseRSS(await r.text(),{id_prefix:"CISA-ALERT",source:"CISA Alerts",source_url:"https://www.cisa.gov/news-events/cybersecurity-advisories",source_color:"#e05000",source_flag:"🇺🇸",category:"advisory",default_sev:"HIGH",exploit_wild:false,patch_avail:true,limit:10,countries:["US"]});
  } catch { return []; }
}

// ── 3. NVD ────────────────────────────────────────────────────────────────────
async function fetchNVDCritical() {
  try {
    const end   = new Date().toISOString().replace(/\.\d{3}Z$/,".000");
    const start = new Date(Date.now()-30*24*60*60*1000).toISOString().replace(/\.\d{3}Z$/,".000");
    const r     = await fetch(`https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=${start}&pubEndDate=${end}&cvssV3Severity=CRITICAL&resultsPerPage=15`,{headers:{"User-Agent":"BCyberAware/2.0"}});
    const data  = await r.json();
    return (data.vulnerabilities||[]).flatMap(item=>{
      const cve=item.cve;
      const desc=(cve.descriptions||[]).find(d=>d.lang==="en")?.value||"";
      if(!desc||desc.includes("** RESERVED **")) return[];
      const sev=cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseSeverity||cve.metrics?.cvssMetricV30?.[0]?.cvssData?.baseSeverity||"CRITICAL";
      const products=[...new Set((cve.configurations||[]).flatMap(c=>(c.nodes||[]).flatMap(n=>(n.cpeMatch||[]).map(cpe=>{const p=(cpe.criteria||"").split(":");const v=(p[3]||"").replace(/_/g," ");const pr=(p[4]||"").replace(/_/g," ");return v&&v!=="*"&&pr&&pr!=="*"?`${v} ${pr}`:null}).filter(Boolean))))].slice(0,4);
      return[{id:"NVD-"+cve.id,title:desc.length>100?desc.slice(0,97)+"…":desc,severity:sev,category:"advisory",date:fmtDate(cve.published),_rawDate:cve.published,source:"NVD / CVE.org",source_url:`https://nvd.nist.gov/vuln/detail/${cve.id}`,source_color:"#8b0000",source_flag:"🌐",cve_ids:[cve.id],affected_products:products.length?products:["Multiple Products"],summary:desc,threat_actor:null,countries:["US","GB","DE","CN","RU"],middle_east_relevance:getMERelevance(products,desc,""),patch_available:(cve.references||[]).length>0,exploit_in_wild:false}];
    });
  } catch { return []; }
}

// ── 4. CERT-In India ──────────────────────────────────────────────────────────
async function fetchCERTIn() {
  try{const r=await fetch("https://www.cert-in.org.in/RSS/CertIn_Security_Advisories.xml",{headers:{"User-Agent":"BCyberAware/2.0"}});return parseRSS(await r.text(),{id_prefix:"CERTIN",source:"CERT-In (India)",source_url:"https://www.cert-in.org.in",source_color:"#ff6b00",source_flag:"🇮🇳",category:"advisory",default_sev:"HIGH",exploit_wild:false,patch_avail:true,limit:12,countries:["IN"]});}catch{return[];}
}

// ── 5. NCSC UK ────────────────────────────────────────────────────────────────
async function fetchNCSCUK() {
  try{const r=await fetch("https://www.ncsc.gov.uk/api/1/services/v1/report-rss-feed.xml",{headers:{"User-Agent":"BCyberAware/2.0"}});return parseRSS(await r.text(),{id_prefix:"NCSC-UK",source:"NCSC UK",source_url:"https://www.ncsc.gov.uk",source_color:"#003078",source_flag:"🇬🇧",category:"advisory",default_sev:"HIGH",exploit_wild:false,patch_avail:true,limit:10,countries:["GB"]});}catch{return[];}
}

// ── 6. Exploit-DB ─────────────────────────────────────────────────────────────
async function fetchExploitDB() {
  try{const r=await fetch("https://www.exploit-db.com/rss.xml",{headers:{"User-Agent":"BCyberAware/2.0"}});return parseRSS(await r.text(),{id_prefix:"EDBID",source:"Exploit-DB",source_url:"https://www.exploit-db.com",source_color:"#cc0000",source_flag:"⚡",category:"exploit",default_sev:"HIGH",exploit_wild:true,patch_avail:false,limit:15,countries:["US","RU","CN"]});}catch{return[];}
}

// ── 7. Packet Storm ───────────────────────────────────────────────────────────
async function fetchPacketStorm() {
  try{const r=await fetch("https://rss.packetstormsecurity.com/files/",{headers:{"User-Agent":"BCyberAware/2.0"}});return parseRSS(await r.text(),{id_prefix:"PKTSTORM",source:"Packet Storm",source_url:"https://packetstormsecurity.com",source_color:"#880000",source_flag:"⚡",category:"exploit",default_sev:"HIGH",exploit_wild:true,patch_avail:false,limit:10,countries:["US","DE","RU"]});}catch{return[];}
}

// ── 8. The Hacker News ────────────────────────────────────────────────────────
async function fetchTheHackerNews() {
  try{const r=await fetch("https://feeds.feedburner.com/TheHackersNews",{headers:{"User-Agent":"BCyberAware/2.0"}});return parseRSS(await r.text(),{id_prefix:"THN",source:"The Hacker News",source_url:"https://thehackernews.com",source_color:"#e91e63",source_flag:"📰",category:"news",default_sev:"HIGH",exploit_wild:false,patch_avail:false,limit:12,countries:["US","CN","RU","IR"]});}catch{return[];}
}

// ── 9. Bleeping Computer ──────────────────────────────────────────────────────
async function fetchBleepingComputer() {
  try{const r=await fetch("https://www.bleepingcomputer.com/feed/",{headers:{"User-Agent":"BCyberAware/2.0"}});return parseRSS(await r.text(),{id_prefix:"BC",source:"Bleeping Computer",source_url:"https://www.bleepingcomputer.com",source_color:"#2196f3",source_flag:"📰",category:"news",default_sev:"MEDIUM",exploit_wild:false,patch_avail:false,limit:12,countries:["US","RU","CN"]});}catch{return[];}
}

// ── 10. SANS ISC ──────────────────────────────────────────────────────────────
async function fetchSANSISC() {
  try{const r=await fetch("https://isc.sans.edu/rssfeed.xml",{headers:{"User-Agent":"BCyberAware/2.0"}});return parseRSS(await r.text(),{id_prefix:"SANS",source:"SANS ISC",source_url:"https://isc.sans.edu",source_color:"#ff9800",source_flag:"🔍",category:"news",default_sev:"MEDIUM",exploit_wild:false,patch_avail:false,limit:10,countries:["US"]});}catch{return[];}
}

// ── 11. SecurityWeek ──────────────────────────────────────────────────────────
async function fetchSecurityWeek() {
  try{const r=await fetch("https://feeds.feedburner.com/securityweek",{headers:{"User-Agent":"BCyberAware/2.0"}});return parseRSS(await r.text(),{id_prefix:"SECWK",source:"SecurityWeek",source_url:"https://www.securityweek.com",source_color:"#1565c0",source_flag:"📰",category:"news",default_sev:"HIGH",exploit_wild:false,patch_avail:false,limit:10,countries:["US","CN","RU","IR"]});}catch{return[];}
}

// ── 12. Krebs on Security ─────────────────────────────────────────────────────
async function fetchKrebsOnSecurity() {
  try{const r=await fetch("https://krebsonsecurity.com/feed/",{headers:{"User-Agent":"BCyberAware/2.0"}});return parseRSS(await r.text(),{id_prefix:"KREBS",source:"Krebs on Security",source_url:"https://krebsonsecurity.com",source_color:"#4a148c",source_flag:"📰",category:"news",default_sev:"HIGH",exploit_wild:false,patch_avail:false,limit:8,countries:["US","RU","CN"]});}catch{return[];}
}

// ── 13. AlienVault OTX ───────────────────────────────────────────────────────
async function fetchAlienVaultOTX() {
  try{const r=await fetch("https://otx.alienvault.com/blog/rss",{headers:{"User-Agent":"BCyberAware/2.0"}});return parseRSS(await r.text(),{id_prefix:"OTX",source:"AlienVault OTX",source_url:"https://otx.alienvault.com",source_color:"#00897b",source_flag:"🛸",category:"news",default_sev:"HIGH",exploit_wild:false,patch_avail:false,limit:8,countries:["US","CN","RU","IR","KP"]});}catch{return[];}
}

// ── 14. Telegram ─────────────────────────────────────────────────────────────
async function fetchTelegramDarkFeed() {
  try{
    const r=await fetch("https://t.me/s/secharvester",{headers:{"User-Agent":"BCyberAware/2.0"}});
    const html=await r.text();
    const msgs=[...html.matchAll(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/g)].slice(0,5);
    const dates=[...html.matchAll(/datetime="([^"]+)"/g)].slice(0,5);
    const links=[...html.matchAll(/href="(https:\/\/t\.me\/[^"]+)"/g)].slice(0,5);
    return msgs.flatMap((m,i)=>{
      const text=m[1].replace(/<[^>]+>/g,"").trim();
      if(!text||text.length<20)return[];
      const ts=dates[i]?new Date(dates[i][1]).getTime():Date.now();
      return[{id:`TG-${i}-${ts}`,title:text.slice(0,100),severity:"HIGH",category:"news",date:fmtDate(new Date(ts).toISOString()),_rawDate:new Date(ts).toISOString(),source:"Telegram: DarkFeed",source_url:links[i]?links[i][1]:"https://t.me/secharvester",source_color:"#0088cc",source_flag:"📡",cve_ids:[],affected_products:[],summary:text.slice(0,300),threat_actor:null,countries:["RU","CN","IR","KP","US"],middle_east_relevance:"MEDIUM",patch_available:false,exploit_in_wild:false}];
    });
  }catch{return[];}
}

// ── 15. The Hindu ────────────────────────────────────────────────────────────
async function fetchTheHindu() {
  try{
    const r=await fetch("https://www.thehindu.com/sci-tech/technology/feeder/default.rss",{headers:{"User-Agent":"BCyberAware/2.0"}});
    const all=parseRSS(await r.text(),{id_prefix:"HINDU",source:"The Hindu Tech",source_url:"https://www.thehindu.com/sci-tech/technology/",source_color:"#b71c1c",source_flag:"🇮🇳",category:"news",default_sev:"MEDIUM",exploit_wild:false,patch_avail:false,limit:20,countries:["IN"]});
    const kw=["cyber","hack","breach","malware","ransomware","phishing","vulnerability","data leak","attack","security","fraud","scam","cert-in","rbi","digital arrest","upi","banking","privacy","deepfake"];
    return all.filter(a=>kw.some(k=>(a.title+" "+a.summary).toLowerCase().includes(k)));
  }catch{return[];}
}

// ── 16. Economic Times ───────────────────────────────────────────────────────
async function fetchEconomicTimes() {
  try{
    const r=await fetch("https://economictimes.indiatimes.com/rssfeedstopstories.cms",{headers:{"User-Agent":"BCyberAware/2.0"}});
    const all=parseRSS(await r.text(),{id_prefix:"ET",source:"Economic Times IT",source_url:"https://economictimes.indiatimes.com/tech",source_color:"#e65100",source_flag:"🇮🇳",category:"news",default_sev:"MEDIUM",exploit_wild:false,patch_avail:false,limit:20,countries:["IN"]});
    const kw=["cyber","hack","breach","malware","ransomware","phishing","vulnerability","data leak","attack","security","fraud","scam","cert-in","rbi","digital arrest","upi","banking","privacy","dpdp","meity","deepfake"];
    return all.filter(a=>kw.some(k=>(a.title+" "+a.summary).toLowerCase().includes(k)));
  }catch{return[];}
}

// ── RSS Parser ────────────────────────────────────────────────────────────────
function parseRSS(xml,opts){
  try{
    const items=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0,opts.limit);
    return items.flatMap(([,block])=>{
      const get=tag=>(block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`))
        ||block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))
        ||[])[1]?.trim()||"";
      const title=get("title").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">");
      const desc=get("description").replace(/<[^>]+>/g,"").replace(/&amp;/g,"&").trim();
      const link=get("link")||get("guid")||opts.source_url;
      const date=get("pubDate")||get("dc:date")||"";
      if(!title)return[];
      const cves=[...new Set((title+" "+desc).match(/CVE-\d{4}-\d{4,7}/g)||[])].slice(0,5);
      const lower=(title+" "+desc).toLowerCase();
      const sev=lower.includes("critical")?"CRITICAL":lower.includes("high")?"HIGH":opts.default_sev;
      const ts=date?new Date(date).getTime():Date.now();
      const hashId=Math.abs([...title].reduce((h,c)=>Math.imul(31,h)+c.charCodeAt(0)|0,0)).toString(16).slice(0,8).toUpperCase();
      const pm=title.match(/(?:for|in|affecting)\s+(.+?)(?:\s*$|\s*[-–(])/i);
      return[{id:`${opts.id_prefix}-${hashId}`,title,severity:sev,category:opts.category,date:fmtDate(new Date(ts).toISOString()),_rawDate:new Date(ts).toISOString(),source:opts.source,source_url:link,source_color:opts.source_color,source_flag:opts.source_flag,cve_ids:cves,affected_products:pm?[pm[1].trim()]:[],summary:desc.length>300?desc.slice(0,297)+"…":(desc||title),threat_actor:null,countries:opts.countries||["US"],middle_east_relevance:getMERelevance(pm?[pm[1]]:[],title,desc),patch_available:opts.patch_avail,exploit_in_wild:opts.exploit_wild||lower.includes("exploit")||lower.includes("ransomware")}];
    });
  }catch{return[];}
}

// ── Heatmap ───────────────────────────────────────────────────────────────────
function buildHeatmap(all){
  const counts={};
  const NAMES={US:"United States",GB:"United Kingdom",CN:"China",RU:"Russia",IN:"India",DE:"Germany",AU:"Australia",CA:"Canada",FR:"France",IR:"Iran",KP:"North Korea",AE:"UAE",SA:"Saudi Arabia",QA:"Qatar",KW:"Kuwait",PK:"Pakistan",UA:"Ukraine",BR:"Brazil",JP:"Japan",KR:"South Korea",NL:"Netherlands",SG:"Singapore",TR:"Turkey",IL:"Israel",ZA:"South Africa",NG:"Nigeria",MX:"Mexico"};
  all.forEach(a=>(a.countries||[]).forEach(c=>{counts[c]=(counts[c]||0)+(a.severity==="CRITICAL"?4:a.severity==="HIGH"?3:a.severity==="MEDIUM"?2:1);}));
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([code,score])=>({code,score,name:NAMES[code]||code,level:score>20?"CRITICAL":score>12?"HIGH":score>6?"MEDIUM":"LOW"}));
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso){return new Date(iso).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});}
function getMERelevance(products,title,desc){
  const text=[...products,title,desc].join(" ").toLowerCase();
  const hi=["fortinet","palo alto","cisco","microsoft","sap","ivanti","juniper","f5","checkpoint","vmware","citrix","oracle","exchange","sharepoint","windows server","active directory","vpn","firewall","logistics","transport","energy","oil","gas","government","banking","finance","telecom","scada","industrial","ics"," ot ","middle east","gcc","uae","saudi","dubai","qatar","kuwait","bahrain","oman","india","rbi","cert-in","nciipc","upi","meity"];
  return hi.some(k=>text.includes(k))?"HIGH":"MEDIUM";
}
function dedup(arr){const seen=new Set();return arr.filter(a=>{const k=a.cve_ids?.length?a.cve_ids.join(","):a.id;return seen.has(k)?false:(seen.add(k),true)});}
