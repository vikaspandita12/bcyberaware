/**
 * BCyberAware — intelligence layer (pure functions, no I/O)
 *
 *  1. Evidence flags   — "exploited in the wild" needs real evidence (CISA KEV or explicit
 *                        wording); public exploit code is tracked separately.
 *  2. Story merging    — the same story reported by several outlets becomes one card
 *                        with an "also reported by" list.
 *  3. Priority score   — 0-100, built only from signals present in the data, and always
 *                        returned with the reasons that produced it.
 *  4. Action guidance  — rule-based "who is affected / do now / hunt for" for items that
 *                        need action. (An optional AI summary is added by feed-core.)
 */

// ── 1. Evidence ───────────────────────────────────────────────────────────────
const EXPLOITED_RE = /actively exploited|active exploitation|exploited in the wild|in[- ]the[- ]wild|under (active )?(attack|exploitation)|being (actively )?exploited|already (being )?exploited|exploitation (has been |was )?(detected|observed|confirmed)|exploited (as|since) |exploited (as a )?zero[- ]day|zero[- ]day (attack|exploit)|mass exploitation|known exploited vulnerabilit|(hackers|attackers|threat actors|actors) (are )?exploit(ing)?\b|exploited (in attacks|by (hackers|attackers|threat actors))|exploited .{0,40}\b(bug|flaw|vulnerabilit)/i;
// Advisory boilerplate that mentions exploitation only hypothetically
const HYPOTHETICAL_RE = /could (allow|be exploited|lead)|may (allow|be exploited)|successful exploitation (could|may|would)|if exploited|not aware of (any )?(active )?exploitation|no evidence of exploitation/i;
const PUBLIC_EXPLOIT_RE = /proof[- ]of[- ]concept|\bpoc\b|exploit code|public exploit|exploit (is |was |has been )?(released|published|available|public)|is public\b|metasploit module/i;

const text = a => `${a.title || ""} ${a.summary || ""}`;

export function exploitationEvidence(a, kevCves) {
  const t = text(a);
  const kev = a.source === "CISA KEV" || (a.cve_ids || []).some(c => kevCves.has(c));
  let wild = kev;
  if (!wild && EXPLOITED_RE.test(t)) {
    // "…could be exploited" alone is not evidence; explicit wording in the title is
    wild = EXPLOITED_RE.test(a.title || "") || !HYPOTHETICAL_RE.test(t);
  }
  const pub = a.source === "Exploit-DB" || PUBLIC_EXPLOIT_RE.test(t);
  return { kev, wild, pub };
}

// CVSS is often only present inside the text ("CVSS score 7.0", "CVSSv3 Score: 7.5")
export function cvssOf(a) {
  if (typeof a.cvss === "number" && a.cvss > 0) return a.cvss;
  const m = text(a).match(/CVSS(?:\s*v?\d(?:\.\d)?)?\s*(?:base\s*)?(?:score)?\s*(?:of|:)?\s*(\d{1,2}(?:\.\d)?)\b/i);
  const v = m ? parseFloat(m[1]) : NaN;
  return Number.isFinite(v) && v > 0 && v <= 10 ? v : null;
}

// ── 2. Story merging ──────────────────────────────────────────────────────────
const STOP = new Set(("a an and are as at be been but by for from has have how in into is it its more most new not of on or over than that the their this to was were what when which who why will with without after before about amid against during says say said warns warn warning report reports reported could may can now via using use used uses gets get lets let after here just than them they you your our out off only also first another across "
  + "security cybersecurity cyber vulnerability vulnerabilities flaw flaws bug bugs issue issues attack attacks attacker attackers hacker hackers hacked hack threat threats actor actors exploit exploits exploited exploiting critical high severity patch patches patched patching fix fixes fixed update updates updated release releases released data users user customers customer company companies firm researchers researcher research "
  + "allow allows allowing lead leads expose exposes exposed risk risks nearly million billion thousand hundreds thousands still again already latest major big "
  + "execute execution code malicious remote access system systems server servers website websites site sites online tool tools app apps application applications software product products device devices network networks account accounts password passwords login logins credential credentials key keys secret secrets file files email emails service services platform cloud enterprise run running through including despite available confirm confirms confirmed turn turned own lets let make makes made take takes show shows give gives find finds found hit hits put puts say says build builds add adds one two three four five six seven eight nine ten").split(/\s+/));

const stem = w => {
  if (w.length > 4 && /(ches|shes|xes|sses|zes)$/.test(w)) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 3 && w.endsWith("s") && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
  return w;
};

const normalize = s => String(s || "")
  .toLowerCase()
  .replace(/https?:\/\/\S+/g, " ")
  .replace(/[’‘`]/g, "'").replace(/'s\b/g, "")
  .replace(/patch[- ]tuesday/g, "patchtuesday")
  .replace(/zero[- ]day|0[- ]day/g, "zeroday")
  .replace(/(\w)-(\w)/g, "$1$2");            // n-central → ncentral

function wordTokens(s) {
  const out = new Set();
  for (const raw of normalize(s).split(/[^a-z0-9]+/)) {
    if (raw.length < 3 || /^\d+$/.test(raw) || STOP.has(raw)) continue;
    const w = stem(raw);
    if (w.length >= 3 && !STOP.has(w)) out.add(w);
  }
  return out;
}

// Names: words capitalised mid-sentence in summaries (headlines are Title Case, so they
// cannot tell "Railway" the company from an ordinary word — sentence-case summaries can)
function properNouns(summary, out) {
  const s = String(summary || "").slice(0, 300);
  const re = /[a-z0-9,;:]\s+([A-Z][a-zA-Z0-9]+(?:-[A-Za-z0-9]+)?)/g;
  let m;
  while ((m = re.exec(s))) for (const w of wordTokens(m[1])) out.add(w);
  return out;
}

export function storyTokens(a) {
  return { title: wordTokens(a.title), body: wordTokens(String(a.summary || "").slice(0, 300)) };
}

const DAY = 24 * 60 * 60 * 1000;
const STORY_WINDOW_MS = 4 * DAY;
const SIM_STRONG = 0.2;   // same story on wording alone
const SIM_NAMED  = 0.13;  // same story when a distinctive name is also in both headlines

/**
 * Merge the same story reported by different sources. Input must be sorted newest first.
 * Returns one item per story (the first listed is the lead), each with
 * `also: [{source, source_flag, source_url, title}]` and `sources_count`.
 *
 * Similarity is TF-IDF cosine over headline (double weight) + summary. Tuned on live
 * headlines to prefer a missed merge over a wrong one.
 */
export function clusterStories(items) {
  const n = items.length;
  if (n < 2) return items.map(a => ({ ...a, sources_count: 1 + (a.also?.length || 0) }));
  const toks = items.map(storyTokens);
  const df = new Map(), names = new Set();
  items.forEach((a, i) => {
    for (const w of new Set([...toks[i].title, ...toks[i].body])) df.set(w, (df.get(w) || 0) + 1);
    properNouns(a.summary, names);
  });
  const idf = w => Math.log(1 + n / (df.get(w) || 1));
  const rareMax = Math.max(3, Math.round(n * 0.05));
  const vecs = toks.map(t => {
    const v = new Map();
    for (const w of t.body) v.set(w, idf(w));
    for (const w of t.title) v.set(w, 2 * idf(w));
    let norm = 0; for (const x of v.values()) norm += x * x;
    return { v, norm: Math.sqrt(norm) || 1 };
  });

  const similar = (i, j) => {
    const a = items[i], b = items[j];
    if (a.source === b.source) return false;
    if (Math.abs((a.ts || 0) - (b.ts || 0)) > STORY_WINDOW_MS) return false;
    const sharedTitle = [...toks[i].title].filter(w => toks[j].title.has(w));
    const cveA = a.cve_ids || [], cveB = b.cve_ids || [];
    if (sharedTitle.length && cveA.some(c => cveB.includes(c))) return true;
    let dot = 0, shared = 0;
    for (const [w, x] of vecs[i].v) { const y = vecs[j].v.get(w); if (y) { dot += x * y; shared++; } }
    const cos = dot / (vecs[i].norm * vecs[j].norm);
    if (cos >= SIM_STRONG && shared >= 2) return true;
    return cos >= SIM_NAMED && shared >= 3
      && sharedTitle.some(w => (df.get(w) || 0) <= rareMax && names.has(w));
  };

  // A story joins a cluster if it matches any member from a different source
  const clusters = [];
  for (let i = 0; i < n; i++) {
    const c = clusters.find(c => !c.sources.has(items[i].source) && c.members.some(j => similar(j, i)));
    if (c) { c.members.push(i); c.sources.add(items[i].source); }
    else clusters.push({ rep: i, members: [i], sources: new Set([items[i].source]) });
  }
  return clusters.map(c => {
    const rep = items[c.rep];
    if (c.members.length === 1) return { ...rep, sources_count: 1 + (rep.also?.length || 0) };
    const others = c.members.slice(1).map(i => items[i]);
    const also = [...(rep.also || [])];
    for (const o of others) for (const x of [{ source: o.source, source_flag: o.source_flag, source_url: o.source_url, title: o.title }, ...(o.also || [])]) {
      if (x.source !== rep.source && !also.some(y => y.source === x.source)) also.push(x);
    }
    return {
      ...rep,
      cve_ids: [...new Set([...(rep.cve_ids || []), ...others.flatMap(o => o.cve_ids || [])])].slice(0, 8),
      threat_actor: rep.threat_actor || others.find(o => o.threat_actor)?.threat_actor || null,
      exploit_in_wild: !!rep.exploit_in_wild || others.some(o => o.exploit_in_wild),
      exploit_public: !!rep.exploit_public || others.some(o => o.exploit_public),
      also,
      sources_count: 1 + also.length,
    };
  });
}

// ── 3. Priority score ─────────────────────────────────────────────────────────
const EDGE_RE = /\bvpn\b|firewall|gateway|\bfortios\b|fortigate|fortiproxy|forticlient ems|pan-os|globalprotect|sonicwall|sonicos|\bivanti\b|connect secure|citrix|netscaler|\bf5\b|big-ip|cisco (asa|ios xe|ise|firepower)|exchange server|sharepoint|\brdp\b|remote desktop|barracuda|check point|juniper|zyxel|\bedge device|internet-facing|n-central|screenconnect|moveit|confluence|vmware (esxi|vcenter)/i;
const HIGH_IMPACT_RE = /remote code execution|\brce\b|arbitrary code|code execution|authentication bypass|auth bypass|unauthenticated|pre-auth|without authentication|without login|server takeover|full (system )?compromise|command injection|privilege escalation to (root|system)|wormable/i;
const RANSOM_RE = /ransomware/i;

export const PRIORITY_BANDS = [
  { min: 70, label: "ACT NOW" },
  { min: 50, label: "THIS WEEK" },
  { min: 30, label: "PLAN" },
  { min: 0,  label: "MONITOR" },
];

export function scoreItem(a, ctx) {
  const t = text(a);
  const reasons = [];
  let score = 0;
  const add = (pts, why) => { score += pts; reasons.push(why); };

  // Exploitation — the strongest real-world signal
  if (a.source === "CISA KEV") add(45, "On CISA's Known Exploited Vulnerabilities list");
  else if (a.kev) add(40, "Covers a CVE on CISA's Known Exploited Vulnerabilities list");
  else if (a.exploit_in_wild) add(38, a.exploit_reported_by ? `Exploitation in the wild reported by ${a.exploit_reported_by}` : "Exploitation reported in the wild");
  else if (a.exploit_public) add(15, "Public exploit code available");

  // Likelihood (FIRST.org EPSS, a 30-day exploitation probability)
  if (a.epss != null) {
    if (a.epss >= 50) add(15, `EPSS ${a.epss}% (very likely to be exploited)`);
    else if (a.epss >= 10) add(10, `EPSS ${a.epss}%`);
    else if (a.epss >= 1) add(5, `EPSS ${a.epss}%`);
    if (a.epss >= 50 && a.exploit_public && !a.exploit_in_wild) add(10, "Public exploit plus very high EPSS");
  }

  // Impact
  const cvss = cvssOf(a);
  if (cvss != null) {
    if (cvss >= 9) add(15, `CVSS ${cvss} (critical)`);
    else if (cvss >= 7) add(10, `CVSS ${cvss} (high)`);
    else if (cvss >= 4) add(5, `CVSS ${cvss}`);
  } else if (HIGH_IMPACT_RE.test(t)) add(10, "Remote code execution / authentication bypass class");
  else if (a.category !== "news" && a.severity === "CRITICAL") add(8, "Rated critical by the source");
  else if (a.category !== "news") add(3, "Vendor / CERT advisory");

  // Exposure
  if (EDGE_RE.test(t)) add(8, "Internet-facing or perimeter product");

  // Corroboration across independent sources
  const mentions = Math.max(a.sources_count || 1, ctx.cveMentions(a));
  if (mentions >= 4) add(10, `Reported by ${mentions} sources`);
  else if (mentions >= 2) add(6, `Reported by ${mentions} sources`);

  // Recency
  const age = ctx.now - (a.ts || 0);
  if (age <= 2 * DAY) add(7, "New in the last 48 hours");
  else if (age <= 7 * DAY) add(4, "New this week");

  // Ransomware / tracked actor
  if (a.threat_actor) add(5, `Linked to ${a.threat_actor}`);
  else if (RANSOM_RE.test(t)) add(5, "Ransomware-related");

  score = Math.max(0, Math.min(100, Math.round(score)));
  const label = PRIORITY_BANDS.find(b => score >= b.min).label;
  return { score, label, reasons };
}

// ── 4. Action guidance (rule-based, grounded in the item's own data) ──────────
const VENDOR_RE = /\b(Microsoft|Windows|Outlook|Exchange|SharePoint|Active Directory|Azure|Entra|Cisco|BroadWorks|Fortinet|FortiOS|FortiGate|FortiClient|Palo Alto|PAN-OS|Ivanti|Citrix|NetScaler|VMware|SonicWall|Barracuda|Juniper|F5|BIG-IP|SAP|Oracle|Apple|iOS|macOS|Android|Chromium|Chrome|Mozilla|Firefox|Adobe|Zoom|Asus|Atlassian|Confluence|Jira|GitLab|GitHub|Git|Jenkins|Kubernetes|Docker|OpenSSH|OpenSSL|PHP|Node\.js|Linux|Red Hat|Ubuntu|Debian|WordPress|Apache|Nginx|N-able|N-central|Veeam|Zimbra|Siemens|Schneider|Intel|AMD|Samsung|Qualcomm|Xen Orchestra|Checkmk|AhsayCBS|Openwave|IBM|Aspera|GPUStack|FreeSwitch|Keycloak|SGLang|Notion|Fireworks AI)\b/g;

function affectedOf(a) {
  // CISA KEV supplies a clean vendor + product; RSS-derived product guesses are not reliable
  if (a.source === "CISA KEV" && a.affected_products?.[0]) {
    const seen = new Set(); // "Barracuda Networks Barracuda Email…" → drop the repeated vendor word
    return a.affected_products[0].split(/\s+/).filter(w => { const k = w.toLowerCase(); if (w.length > 3 && seen.has(k)) return false; seen.add(k); return true; }).join(" ");
  }
  const inTitle = [...new Set(String(a.title || "").match(VENDOR_RE) || [])];
  if (inTitle.length) return inTitle.slice(0, 4).join(", ");
  const inText = [...new Set(String(a.summary || "").match(VENDOR_RE) || [])];
  return inText.length ? inText.slice(0, 4).join(", ") : null;
}

// First match wins — ordered from most specific to most general
const PLAYBOOKS = [
  { name: "ransomware", re: /ransomware|encrypt(ed|s|ion) (files|systems|data)|extortion/i,
    do: "Confirm offline or immutable backups restore cleanly, and isolate any host showing encryption or ransom notes.",
    hunt: "Shadow-copy deletion (vssadmin, wbadmin), mass file renames, new scheduled tasks, and remote-management tools you did not install." },
  { name: "patch-cycle", re: /patch tuesday|monthly (security )?(update|patch)|security hardening release/i,
    do: "Start this month's patch cycle now: deploy fixes for the actively exploited CVEs first, then internet-facing systems and domain controllers.",
    hunt: "Systems still missing the cumulative update after your deployment window; endpoints that have not rebooted since patching." },
  { name: "edge", re: null, // perimeter product with high impact or active exploitation (set in buildAction)
    do: "Patch the appliance now. If you cannot, take its management interface off the internet and restrict access to trusted IPs.",
    hunt: "Appliance logs since disclosure: unexpected admin logins, new local accounts, configuration changes, unfamiliar files or processes on the device." },
  { name: "browser", re: /chrom(e|ium)|firefox|webkit|safari|browser|use-after-free in (v8|blink)/i,
    do: "Force-update browsers across the fleet and make users restart them; confirm versions through endpoint management.",
    hunt: "Endpoints still on the old browser version, and EDR alerts for browser processes spawning shells or script interpreters." },
  { name: "implant", re: /backdoor|web ?shell|implant|\brat\b|remote access trojan|stealer|malware|trojan/i,
    do: "Patch, then treat exposed instances as possibly compromised: look for the implant before you declare them clean.",
    hunt: "New services, scheduled tasks or cron entries, unfamiliar binaries or scripts, and regular outbound connections to hosts you do not recognise." },
  { name: "ssrf-xxe", re: /server-side request forgery|\bssrf\b|xml external entity|\bxxe\b/i,
    do: "Apply the fix; until then restrict the server's outbound access and block it from cloud metadata addresses.",
    hunt: "Requests from the server to internal addresses or 169.254.169.254, and unexpected reads of local files." },
  { name: "auth-bypass", re: /authentication bypass|auth bypass|authorization bypass|improper auth|incorrect authorization|bypass (linux )?logins?|accepts a password|without (authentication|login)|unauthenticated|account takeover/i,
    do: "Apply the vendor fix, then rotate credentials and sessions for the affected service.",
    hunt: "Authentication logs for successful logins with no matching MFA event, from new IPs or at unusual hours." },
  { name: "rce", re: /remote code execution|\brce\b|arbitrary code|code execution|command injection|code injection|deserializ|use-after-free|memory corruption/i,
    do: "Apply the vendor update on exposed systems first; restrict network access to the service until it is patched.",
    hunt: "Unexpected child processes of the affected service (shells, script interpreters), new web shells or files in its directories, outbound connections from the host." },
  { name: "credential-leak", re: /ntlm|hash(es)? (leak|disclos|expos)|spoofing|credential (theft|leak|exposure)|api keys?|secrets? (leak|exposed|stolen)|token theft/i,
    do: "Apply the fix and rotate any credentials, keys or tokens that could have been exposed.",
    hunt: "Outbound SMB or WebDAV to the internet, use of old keys or tokens after rotation, logins from unfamiliar locations." },
  { name: "privesc", re: /privilege escalation|elevation of privilege|local privilege|make-me-root|gain (root|system) /i,
    do: "Patch through your urgent cycle; prioritise multi-user servers and hosts where untrusted code can run.",
    hunt: "EDR alerts for processes unexpectedly running as SYSTEM or root, and new members of admin groups." },
  { name: "phishing", re: /phishing|oauth consent|social engineering|impersonat|fake (court|login|invoice)|malicious (email|attachment)/i,
    do: "Warn users with a concrete example, and block the reported sender domains and URLs at the mail gateway.",
    hunt: "Mail logs for the reported lures, new OAuth app consents, and inbox rules that forward or delete mail." },
  { name: "breach", re: /breach|data (theft|leak|exposure)|stole(n)? data|leaked|compromised accounts/i,
    do: "Check whether your organisation uses the affected service; if so, rotate the credentials and API keys you shared with it.",
    hunt: "Activity from that vendor's integration accounts, and your data or domains appearing on leak sites." },
  { name: "dos", re: /denial[- ]of[- ]service|\bdos\b|\bddos\b/i,
    do: "Schedule the update; rate-limit or shield the exposed service in the meantime.",
    hunt: "Service crashes or restarts that line up with unusual inbound request patterns." },
];
const GENERIC = {
  name: "generic",
  do: "Check whether you run the affected product and version, then apply the vendor update or mitigation.",
  hunt: "Your asset inventory for the affected product, and its logs for unusual activity since the disclosure date.",
};

export function buildAction(a) {
  const t = text(a);
  const edge = EDGE_RE.test(t);
  let pb = PLAYBOOKS.slice(0, 2).find(p => p.re.test(t));
  if (!pb && edge && (HIGH_IMPACT_RE.test(t) || a.exploit_in_wild)) pb = PLAYBOOKS.find(p => p.name === "edge");
  if (!pb) pb = PLAYBOOKS.find(p => p.re && p.re.test(t)) || GENERIC;

  const action = { affected: affectedOf(a), do_now: pb.do, hunt: pb.hunt, playbook: pb.name };
  // CISA sets a binding remediation date for US federal agencies — a useful urgency benchmark
  if (a.kev_due) action.deadline = a.kev_due;
  return action;
}

export const needsAction = a => a.priority && (a.priority.score >= 50 || a.kev || a.exploit_in_wild);

// ── Orchestration ─────────────────────────────────────────────────────────────
/** Step 1 (before trimming lists): evidence flags on every item, then merge duplicate news stories. */
export function prepareStories({ advisories, exploits, news, kevCves }) {
  const all = [...advisories, ...exploits, ...news];
  kevCves = kevCves || new Set(all.filter(a => a.source === "CISA KEV").flatMap(a => a.cve_ids || []));
  for (const a of all) {
    const ev = exploitationEvidence(a, kevCves);
    a.kev = ev.kev;
    a.exploit_in_wild = ev.wild;
    delete a.exploit_reported_by;
    a.exploit_public = ev.pub;
    const cv = cvssOf(a);
    if (cv != null && !a.cvss) a.cvss = cv;
  }
  const stories = clusterStories(news);

  // A news story that reports exploitation of specific CVEs (1-3 of them — not a monthly
  // round-up) is evidence for the advisories covering those same CVEs.
  const reported = new Map();
  for (const n of stories) {
    const cves = n.cve_ids || [];
    if (n.exploit_in_wild && cves.length >= 1 && cves.length <= 3) for (const c of cves) if (!reported.has(c)) reported.set(c, n.source);
  }
  for (const a of [...advisories, ...exploits]) {
    if (a.exploit_in_wild) continue;
    const hit = (a.cve_ids || []).find(c => reported.has(c));
    if (hit) { a.exploit_in_wild = true; a.exploit_reported_by = reported.get(hit); }
  }
  return { advisories, exploits, news: stories };
}

/** Step 2 (after EPSS enrichment): priority score + action guidance. Mutates items in place. */
export function scoreAndAdvise({ advisories, exploits, news, now }) {
  const all = [...advisories, ...exploits, ...news];
  // How many distinct sources mention each CVE (cross-category corroboration)
  const bySrc = new Map();
  for (const a of all) for (const c of a.cve_ids || []) {
    if (!bySrc.has(c)) bySrc.set(c, new Set());
    bySrc.get(c).add(a.source);
    for (const o of a.also || []) bySrc.get(c).add(o.source);
  }
  const ctx = { now, cveMentions: a => Math.max(0, ...(a.cve_ids || []).map(c => bySrc.get(c)?.size || 0)) };
  for (const a of all) {
    a.priority = scoreItem(a, ctx);
    if (needsAction(a)) a.action = buildAction(a); else delete a.action;
  }
}
