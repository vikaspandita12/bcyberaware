const {
  useState,
  useEffect,
  useCallback
} = React;
const PROXY = "/api/proxy";
const ACCENT = "#00c8ff";
const ACCENT2 = "#7b2ff7";
const YOUTUBE_VIDEO_ID = "xNS89clz9FI";
const YOUTUBE_CHANNEL = "https://www.youtube.com/@BCyberAwarebyvikaspandita";
const SEV_S = {
  CRITICAL: {
    bg: "rgba(200,0,0,0.15)",
    border: "#c00000",
    text: "#ff4444"
  },
  HIGH: {
    bg: "rgba(220,100,0,0.13)",
    border: "#dd6600",
    text: "#ff9944"
  },
  MEDIUM: {
    bg: "rgba(200,170,0,0.11)",
    border: "#c8a000",
    text: "#ffd700"
  },
  LOW: {
    bg: "rgba(0,140,70,0.11)",
    border: "#008c46",
    text: "#00e676"
  }
};
const SEV_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
async function loadFeed(force = false) {
  const url = force ? `${PROXY}?action=feed&bust=1` : `${PROXY}?action=feed`;
  const r = await fetch(url, {
    cache: "no-store"
  });
  if (!r.ok) throw new Error(`Feed error ${r.status}`);
  return r.json();
}
async function showAlert(title, body, url) {
  const opts = {
    body,
    icon: "/logo.svg",
    badge: "/logo.svg",
    tag: (title + body).slice(0, 60),
    data: {
      url
    }
  };
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.active && reg.showNotification) {
        await reg.showNotification(title, opts);
        return;
      }
    }
  } catch {}
  try {
    new Notification(title, {
      body,
      icon: "/logo.svg"
    });
  } catch {}
}
function timeAgo(ts) {
  if (!ts) return "";
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.round(s / 60) + "m ago";
  if (s < 86400) return Math.round(s / 3600) + "h ago";
  return Math.round(s / 86400) + "d ago";
}
function BreakingTicker({
  items
}) {
  if (!items || items.length === 0) return null;
  const doubled = [...items, ...items];
  return React.createElement("div", {
    className: "ticker-wrap",
    style: {
      background: "linear-gradient(90deg,rgba(80,0,0,.55),rgba(40,0,10,.4))",
      borderBottom: "1px solid rgba(255,23,68,.25)",
      display: "flex",
      alignItems: "stretch",
      overflow: "hidden",
      height: 38
    }
  }, React.createElement("div", {
    className: "ticker-badge",
    style: {
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "0 16px",
      background: "rgba(200,0,0,.3)",
      borderRight: "1px solid rgba(255,23,68,.35)",
      zIndex: 2
    }
  }, React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: "#ff1744",
      boxShadow: "0 0 8px #ff1744",
      animation: "pulse 1.1s infinite",
      display: "inline-block"
    }
  }), React.createElement("span", {
    className: "ticker-badge-text",
    style: {
      fontSize: 11,
      fontWeight: 900,
      color: "#ff6e6e",
      fontFamily: "var(--mono)",
      letterSpacing: 2.5,
      whiteSpace: "nowrap"
    }
  }, "BREAKING")), React.createElement("div", {
    style: {
      flex: 1,
      overflow: "hidden",
      position: "relative"
    }
  }, React.createElement("div", {
    className: "ticker-track",
    style: {
      display: "flex",
      alignItems: "center",
      height: "100%",
      width: "max-content",
      animation: `tickerScroll ${Math.max(40, items.length * 11)}s linear infinite`
    }
  }, doubled.map((b, i) => React.createElement("a", {
    key: i,
    href: b.source_url,
    target: "_blank",
    rel: "noopener noreferrer",
    className: "ticker-item",
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 9,
      padding: "0 28px",
      whiteSpace: "nowrap",
      fontSize: 13
    }
  }, React.createElement("span", {
    className: "ticker-meta",
    style: {
      color: "#ff7961",
      fontFamily: "var(--mono)",
      fontSize: 11,
      letterSpacing: .5
    }
  }, b.source_flag, " ", b.source, " \xB7 ", timeAgo(b.ts)), React.createElement("span", {
    className: "ticker-title",
    style: {
      fontWeight: 600,
      color: "#ffe3e3"
    }
  }, b.title), React.createElement("span", {
    className: "ticker-sep",
    style: {
      color: "rgba(255,100,100,.3)"
    }
  }, "\u25C6"))))));
}
function SevBadge({
  sev
}) {
  const s = SEV_S[sev] || SEV_S.LOW;
  return React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 800,
      letterSpacing: 1.5,
      padding: "4px 12px",
      background: s.bg,
      border: `1px solid ${s.border}`,
      color: s.text,
      borderRadius: 3,
      whiteSpace: "nowrap",
      fontFamily: "var(--mono)"
    }
  }, sev);
}
function StatCard({
  label,
  value,
  color,
  sub
}) {
  return React.createElement("div", {
    className: "stat-card",
    style: {
      flex: 1,
      minWidth: 100,
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 6,
      padding: "16px 14px",
      textAlign: "center"
    }
  }, React.createElement("div", {
    className: "stat-value",
    style: {
      fontSize: 34,
      fontWeight: 900,
      color: color || ACCENT,
      fontFamily: "var(--mono)",
      lineHeight: 1
    }
  }, value), React.createElement("div", {
    className: "stat-label",
    style: {
      fontSize: 11,
      letterSpacing: 1.5,
      color: "rgba(200,220,240,0.4)",
      textTransform: "uppercase",
      marginTop: 7,
      fontWeight: 600
    }
  }, label), sub && React.createElement("div", {
    className: "stat-sub",
    style: {
      fontSize: 11,
      color: "rgba(200,220,240,0.25)",
      marginTop: 3
    }
  }, sub));
}
const MITRE_MATRIX = [{
  tactic: "Initial Access",
  code: "TA0001",
  techniques: [{
    id: "T1190",
    name: "Exploit Public-Facing App",
    color: "#ff5252",
    re: /\brce\b|remote code|command injection|deseriali|arbitrary code|execute code|buffer overflow|sql injection|\bsqli\b|unauthenticated|path traversal|ssrf/i
  }, {
    id: "T1566",
    name: "Phishing / Spearphishing",
    color: "#ff7043",
    re: /phish|spearphish|lure|social engineering|credential harvest|malicious attachment|bec\b/i
  }, {
    id: "T1195",
    name: "Supply Chain Compromise",
    color: "#ec407a",
    re: /supply[- ]chain|npm|pypi|extension|marketplace|plugin|package|dependency|composer|maven/i
  }, {
    id: "T1133",
    name: "External Remote Services",
    color: "#ff8a65",
    re: /\bvpn\b|ssl[- ]vpn|rdp|citrix|fortigate|globalprotect|ivanti|connect secure|sonicwall|anyconnect/i
  }]
}, {
  tactic: "Execution",
  code: "TA0002",
  techniques: [{
    id: "T1059",
    name: "Command & Scripting",
    color: "#ffab40",
    re: /powershell|bash|shell script|javascript|python|cmd\.exe|vbscript|macro|applescript/i
  }, {
    id: "T1203",
    name: "Exploitation for Client Exec",
    color: "#ffa726",
    re: /browser|chromium|chrome|webkit|safari|firefox|pdf|office|word|excel|zero[- ]click/i
  }, {
    id: "T1204",
    name: "User Execution (Malicious File)",
    color: "#ffb74d",
    re: /trojan|loader|dropper|fake update|malicious installer|iso file|lnk file/i
  }]
}, {
  tactic: "Persistence",
  code: "TA0003",
  techniques: [{
    id: "T1505",
    name: "Server Software (Web Shell)",
    color: "#ffd54f",
    re: /webshell|web shell|backdoor|implant|rootkit|persistence|cron|scheduled task/i
  }, {
    id: "T1098",
    name: "Account Manipulation",
    color: "#ffca28",
    re: /admin account|rogue account|oauth|api key|ssh key|iam role|service principal/i
  }, {
    id: "T1547",
    name: "Boot / Logon Autostart",
    color: "#ffe082",
    re: /registry|startup|uefi|firmware|bootkit|kernel module|driver/i
  }]
}, {
  tactic: "Privilege Escalation",
  code: "TA0004",
  techniques: [{
    id: "T1068",
    name: "Exploitation for PrivEsc",
    color: "#ffa726",
    re: /privilege escalation|local privilege|\blpe\b|root access|admin access|elevation of privilege|kernel flaw/i
  }, {
    id: "T1078",
    name: "Valid Accounts / Auth Bypass",
    color: "#fb8c00",
    re: /bypass auth|authentication bypass|hardcoded credential|default password|stolen credential/i
  }, {
    id: "T1611",
    name: "Escape to Host (Container/VM)",
    color: "#f57c00",
    re: /container escape|vm escape|hypervisor|esxi|vmware|docker|kubernetes|sandbox escape/i
  }]
}, {
  tactic: "Defense Evasion",
  code: "TA0005",
  techniques: [{
    id: "T1562",
    name: "Impair Defenses / Kill EDR",
    color: "#ab47bc",
    re: /\bedr\b|antivirus|byovd|vulnerable driver|disable security|firewall bypass|tamper/i
  }, {
    id: "T1027",
    name: "Obfuscated / Packed Payload",
    color: "#ba68c8",
    re: /obfuscat|packed|encrypted payload|fileless|in-memory|steganograph|living off the land|lolbin/i
  }, {
    id: "T1553",
    name: "Subvert Trust Controls",
    color: "#ce93d8",
    re: /certificate|code sign|signed binary|rogue ca|tls|ssl/i
  }]
}, {
  tactic: "Credential Access",
  code: "TA0006",
  techniques: [{
    id: "T1555",
    name: "Credentials from Password Stores",
    color: "#ab47bc",
    re: /credential|password|infostealer|stealer|lumma|redline|vidar|keychain|browser data/i
  }, {
    id: "T1003",
    name: "OS Credential Dumping",
    color: "#9c27b0",
    re: /lsass|mimikatz|ntds|kerberos|ntlm|active directory|hash dump|sam database/i
  }, {
    id: "T1539",
    name: "Steal Web Session Cookie / Token",
    color: "#8e24aa",
    re: /session hijack|cookie|token theft|aitm|mfa bypass|oauth token|jwt/i
  }]
}, {
  tactic: "Lateral Movement",
  code: "TA0008",
  techniques: [{
    id: "T1021",
    name: "Remote Services (SMB/SSH/RDP)",
    color: "#42a5f5",
    re: /lateral movement|\bsmb\b|wmi|winrm|ssh|rdp|psexec|internal network/i
  }, {
    id: "T1210",
    name: "Exploitation of Remote Services",
    color: "#29b6f6",
    re: /wormable|east-west|domain controller|sharepoint|exchange server/i
  }]
}, {
  tactic: "Command & Control",
  code: "TA0011",
  techniques: [{
    id: "T1071",
    name: "App Layer Protocol (C2)",
    color: "#26c6da",
    re: /\bc2\b|command and control|command-and-control|cobalt strike|sliver|brute ratel|beacon|botnet/i
  }, {
    id: "T1105",
    name: "Ingress Tool Transfer",
    color: "#00acc1",
    re: /download payload|second[- ]stage|c2 server|telegram bot|discord webhook/i
  }]
}, {
  tactic: "Exfiltration",
  code: "TA0010",
  techniques: [{
    id: "T1041",
    name: "Exfiltration Over C2 / Web",
    color: "#26c6da",
    re: /exfiltrat|data leak|stolen|breach|exposed database|s3 bucket|cloud bucket|pii|records leaked/i
  }, {
    id: "T1567",
    name: "Exfiltration to Cloud Storage",
    color: "#00bcd4",
    re: /mega\.nz|rclone|cloud storage|dropbox|onedrive|google drive|s3|blob storage/i
  }]
}, {
  tactic: "Impact",
  code: "TA0040",
  techniques: [{
    id: "T1486",
    name: "Data Encrypted for Impact",
    color: "#ff1744",
    re: /ransomware|encrypt|extortion|double extortion|lockbit|qilin|akira|cl0p|blackbasta/i
  }, {
    id: "T1485",
    name: "Data Destruction / Wiper",
    color: "#f50057",
    re: /wiper|destructive|destroy|sabotage|erase|corrupt/i
  }, {
    id: "T1498",
    name: "Network Denial of Service",
    color: "#ffca28",
    re: /\bddos\b|denial of service|\bdos\b|amplification|carpet bomb/i
  }]
}];
const ALL_MITRE_TECHNIQUES = MITRE_MATRIX.flatMap(col => col.techniques.map(t => ({
  ...t,
  tactic: col.tactic,
  tacticCode: col.code
})));
function mapMitreTactics(adv) {
  const txt = `${adv.title || ""} ${adv.summary || ""} ${(adv.affected_products || []).join(" ")}`.toLowerCase();
  const out = [];
  for (const t of ALL_MITRE_TECHNIQUES) {
    if (t.re.test(txt)) out.push(t);
    if (out.length >= 3) break;
  }
  return out;
}
const HIGH_AUTH_SOURCES = new Set(["CISA KEV", "CISA Alerts", "NVD / CVE.org", "GitHub Advisory (GHSA)", "CERT-In (India)", "NCSC UK", "CERT-EU", "JPCERT/CC", "CIS Advisories", "Cisco PSIRT", "Palo Alto PSIRT", "FortiGuard PSIRT", "Microsoft Security"]);
const LAB_SOURCES = new Set(["Unit 42", "Cisco Talos", "Check Point Research", "CrowdStrike", "Mandiant", "Sophos X-Ops", "Rapid7", "Google Project Zero", "ZDI 0-Day Pipeline", "Exploit-DB", "SANS ISC"]);
function computeOpenCTIMeta(adv) {
  const confidence = HIGH_AUTH_SOURCES.has(adv.source) ? 95 : LAB_SOURCES.has(adv.source) ? 88 : adv.category === "social" ? 55 : 78;
  const tlp = adv.category === "social" ? {
    label: "TLP:GREEN",
    color: "#00e676",
    bg: "rgba(0,230,118,0.1)"
  } : adv.exploit_in_wild && adv.severity === "CRITICAL" ? {
    label: "TLP:AMBER",
    color: "#ffb300",
    bg: "rgba(255,179,0,0.12)"
  } : {
    label: "TLP:CLEAR",
    color: "#e0e0e0",
    bg: "rgba(255,255,255,0.06)"
  };
  return {
    confidence,
    tlp
  };
}
function stixUuid(seed) {
  let h1 = 0xdeadbeef ^ seed.length,
    h2 = 0x41c6ce57 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ h1 >>> 16, 2246822507) ^ Math.imul(h2 ^ h2 >>> 13, 3266489909);
  h2 = Math.imul(h2 ^ h2 >>> 16, 2246822507) ^ Math.imul(h1 ^ h1 >>> 13, 3266489909);
  const hex = n => (n >>> 0).toString(16).padStart(8, "0");
  const full = hex(h1) + hex(h2) + hex(h1 ^ 0x9e3779b9) + hex(h2 ^ 0x85ebca6b);
  return `${full.slice(0, 8)}-${full.slice(8, 12)}-4${full.slice(13, 16)}-a${full.slice(17, 20)}-${full.slice(20, 32)}`;
}
function buildStixBundle(items) {
  const nowIso = new Date().toISOString();
  const tlpClearId = "marking-definition--613f2e26-407d-48c7-9eca-b8e91df99dc9";
  const authorId = `identity--${stixUuid("BCyberAware-Vikas-Pandita")}`;
  const objects = new Map();
  objects.set(tlpClearId, {
    type: "marking-definition",
    spec_version: "2.1",
    id: tlpClearId,
    created: "2017-01-20T00:00:00.000Z",
    definition_type: "tlp",
    name: "TLP:CLEAR",
    definition: {
      tlp: "clear"
    }
  });
  objects.set(authorId, {
    type: "identity",
    spec_version: "2.1",
    id: authorId,
    created: nowIso,
    modified: nowIso,
    name: "BCyberAware Threat Intelligence (Vikas Pandita)",
    identity_class: "organization",
    contact_information: "https://advisory.bcyberaware.co.in"
  });
  items.forEach(adv => {
    const createdIso = adv.ts ? new Date(adv.ts).toISOString() : nowIso;
    const {
      confidence
    } = computeOpenCTIMeta(adv);
    const refIds = [];
    const vulnIds = (adv.cve_ids || []).map(cve => {
      const vid = `vulnerability--${stixUuid(cve)}`;
      if (!objects.has(vid)) {
        objects.set(vid, {
          type: "vulnerability",
          spec_version: "2.1",
          id: vid,
          created: createdIso,
          modified: nowIso,
          name: cve,
          description: adv.summary || adv.title,
          confidence,
          external_references: [{
            source_name: "cve",
            external_id: cve,
            url: `https://nvd.nist.gov/vuln/detail/${cve}`
          }],
          x_opencti_cvss_base_score: adv.cvss || null,
          x_opencti_epss_score: adv.epss != null ? adv.epss / 100 : null,
          x_opencti_cisa_kev: !!adv.exploit_in_wild,
          object_marking_refs: [tlpClearId]
        });
      }
      refIds.push(vid);
      return vid;
    });
    const mitreList = mapMitreTactics(adv);
    const apIds = mitreList.map(m => {
      const apId = `attack-pattern--${stixUuid(m.id)}`;
      if (!objects.has(apId)) {
        objects.set(apId, {
          type: "attack-pattern",
          spec_version: "2.1",
          id: apId,
          created: createdIso,
          modified: nowIso,
          name: `${m.id} - ${m.name}`,
          kill_chain_phases: [{
            kill_chain_name: "mitre-attack",
            phase_name: m.tactic.toLowerCase().replace(/\s+/g, "-")
          }],
          external_references: [{
            source_name: "mitre-attack",
            external_id: m.id,
            url: `https://attack.mitre.org/techniques/${m.id}/`
          }],
          object_marking_refs: [tlpClearId]
        });
      }
      refIds.push(apId);
      return apId;
    });
    let actorId = null;
    if (adv.threat_actor) {
      actorId = `intrusion-set--${stixUuid(adv.threat_actor)}`;
      if (!objects.has(actorId)) {
        objects.set(actorId, {
          type: "intrusion-set",
          spec_version: "2.1",
          id: actorId,
          created: createdIso,
          modified: nowIso,
          name: adv.threat_actor,
          confidence,
          object_marking_refs: [tlpClearId]
        });
      }
      refIds.push(actorId);
    }
    if (actorId) {
      vulnIds.forEach(vid => {
        const rid = `relationship--${stixUuid(actorId + "-targets-" + vid)}`;
        objects.set(rid, {
          type: "relationship",
          spec_version: "2.1",
          id: rid,
          created: createdIso,
          modified: nowIso,
          relationship_type: "targets",
          source_ref: actorId,
          target_ref: vid,
          confidence
        });
        refIds.push(rid);
      });
      apIds.forEach(apId => {
        const rid = `relationship--${stixUuid(actorId + "-uses-" + apId)}`;
        objects.set(rid, {
          type: "relationship",
          spec_version: "2.1",
          id: rid,
          created: createdIso,
          modified: nowIso,
          relationship_type: "uses",
          source_ref: actorId,
          target_ref: apId,
          confidence
        });
        refIds.push(rid);
      });
    }
    apIds.forEach(apId => {
      vulnIds.forEach(vid => {
        const rid = `relationship--${stixUuid(apId + "-targets-" + vid)}`;
        objects.set(rid, {
          type: "relationship",
          spec_version: "2.1",
          id: rid,
          created: createdIso,
          modified: nowIso,
          relationship_type: "targets",
          source_ref: apId,
          target_ref: vid,
          confidence
        });
        refIds.push(rid);
      });
    });
    const repId = `report--${stixUuid(adv.id || adv.title)}`;
    objects.set(repId, {
      type: "report",
      spec_version: "2.1",
      id: repId,
      created: createdIso,
      modified: nowIso,
      name: adv.title,
      description: adv.summary || adv.title,
      published: createdIso,
      report_types: [adv.category || "threat-report"],
      created_by_ref: authorId,
      confidence,
      labels: [adv.severity || "HIGH", adv.source, ...(adv.middle_east_relevance === "HIGH" ? ["gcc-priority"] : [])].filter(Boolean),
      external_references: adv.source_url ? [{
        source_name: adv.source || "source",
        url: adv.source_url
      }] : [],
      object_refs: refIds.length ? refIds : [authorId],
      object_marking_refs: [tlpClearId]
    });
  });
  return {
    type: "bundle",
    id: `bundle--${stixUuid("bundle-" + nowIso)}`,
    spec_version: "2.1",
    objects: [...objects.values()]
  };
}
function computeDefcon(advisories, exploits) {
  const all = [...advisories, ...exploits];
  const wild24 = all.filter(a => a.exploit_in_wild && a.ts && Date.now() - a.ts < 48 * 3600 * 1000).length;
  const critCount = advisories.filter(a => a.severity === "CRITICAL").length;
  const hiEpss = all.filter(a => (a.epss || 0) >= 50).length;
  if (wild24 >= 8 || critCount >= 35 || hiEpss >= 8) return {
    level: 2,
    label: "DEFCON 2 · SEVERE",
    color: "#ff1744",
    bg: "rgba(255,23,68,0.14)",
    desc: "High volume of active 0-day / KEV exploitation in last 48h"
  };
  if (wild24 >= 3 || critCount >= 15 || hiEpss >= 3) return {
    level: 3,
    label: "DEFCON 3 · ELEVATED",
    color: "#ff9100",
    bg: "rgba(255,145,0,0.13)",
    desc: "Active exploitation & critical advisories require priority patching"
  };
  return {
    level: 4,
    label: "DEFCON 4 · GUARDED",
    color: "#00e676",
    bg: "rgba(0,230,118,0.12)",
    desc: "Baseline global threat activity — standard patch cadence"
  };
}
function AdvisoryCard({
  adv,
  onAskAI,
  onToggleWatch,
  isWatched,
  onOpenKnowledge
}) {
  const s = SEV_S[adv.severity] || SEV_S.LOW;
  const isNews = adv.category === "news";
  const isExploit = adv.category === "exploit";
  const borderCol = isNews ? "#1976d2" : isExploit ? "#c00000" : s.border;
  const isFresh = adv.ts && Date.now() - adv.ts < 24 * 60 * 60 * 1000;
  const mitre = mapMitreTactics(adv);
  const {
    confidence,
    tlp
  } = computeOpenCTIMeta(adv);
  const epssColor = (adv.epss || 0) >= 50 ? "#ff1744" : (adv.epss || 0) >= 15 ? "#ff9100" : "#00e5ff";
  return React.createElement("div", {
    className: "card advisory-card",
    style: {
      background: "rgba(5,8,15,0.92)",
      border: `1px solid ${borderCol}33`,
      borderLeft: `4px solid ${borderCol}`,
      borderRadius: 6,
      padding: "18px 20px",
      marginBottom: 12,
      boxShadow: adv.exploit_in_wild ? `0 0 14px ${borderCol}12` : "none"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      gap: 7,
      flexWrap: "wrap",
      alignItems: "center",
      marginBottom: 10
    }
  }, !isNews && React.createElement(SevBadge, {
    sev: adv.severity
  }), adv.cvss && React.createElement("span", {
    className: "cvss-tag",
    style: {
      fontSize: 11,
      padding: "4px 9px",
      background: "rgba(255,255,255,0.05)",
      border: "1px solid rgba(255,255,255,0.15)",
      color: "#eef4ff",
      fontFamily: "var(--mono)",
      borderRadius: 3,
      fontWeight: 700
    }
  }, "CVSS ", adv.cvss), adv.epss != null && React.createElement("span", {
    title: `FIRST.org EPSS: ${adv.epss}% probability of exploitation in the next 30 days (${adv.epss_percentile || 0}th percentile)`,
    style: {
      fontSize: 11,
      padding: "4px 10px",
      background: `${epssColor}18`,
      border: `1px solid ${epssColor}66`,
      color: epssColor,
      letterSpacing: .8,
      fontFamily: "var(--mono)",
      borderRadius: 3,
      fontWeight: 800
    }
  }, "\uD83C\uDFAF EPSS ", adv.epss, "%", adv.epss_percentile >= 90 ? ` (P${adv.epss_percentile})` : ""), isNews && React.createElement("span", {
    style: {
      fontSize: 12,
      padding: "4px 12px",
      background: "rgba(25,118,210,0.15)",
      border: "1px solid #1976d255",
      color: "#64b5f6",
      letterSpacing: 1,
      fontFamily: "var(--mono)",
      borderRadius: 3
    }
  }, "\uD83D\uDCF0 NEWS"), isExploit && React.createElement("span", {
    style: {
      fontSize: 12,
      padding: "4px 12px",
      background: "rgba(200,0,0,0.15)",
      border: "1px solid #c0000055",
      color: "#ff4444",
      letterSpacing: 1,
      fontFamily: "var(--mono)",
      borderRadius: 3
    }
  }, "\u26A1 PUBLIC EXPLOIT"), adv.exploit_in_wild && !isExploit && React.createElement("span", {
    style: {
      fontSize: 12,
      padding: "4px 12px",
      background: "rgba(200,0,0,0.15)",
      border: "1px solid #c0000055",
      color: "#ff4444",
      letterSpacing: 1,
      fontFamily: "var(--mono)",
      borderRadius: 3
    }
  }, "\u26A1 EXPLOIT IN WILD"), adv.middle_east_relevance === "HIGH" && React.createElement("span", {
    style: {
      fontSize: 12,
      padding: "4px 12px",
      background: "rgba(0,166,81,0.1)",
      border: "1px solid #00a65155",
      color: "#00e676",
      letterSpacing: 1,
      fontFamily: "var(--mono)",
      borderRadius: 3
    }
  }, "\uD83C\uDF0D GCC RISK"), isFresh && React.createElement("span", {
    style: {
      fontSize: 11,
      padding: "4px 10px",
      background: "rgba(0,200,255,0.1)",
      border: "1px solid rgba(0,200,255,.4)",
      color: "#00c8ff",
      letterSpacing: 1,
      fontFamily: "var(--mono)",
      borderRadius: 3,
      fontWeight: 800
    }
  }, "\u25CF FRESH"), React.createElement("span", {
    title: "Source confidence (OpenCTI-style)",
    style: {
      fontSize: 10,
      padding: "3px 8px",
      background: "rgba(0,200,255,0.07)",
      border: "1px solid rgba(0,200,255,0.22)",
      color: ACCENT,
      fontFamily: "var(--mono)",
      borderRadius: 3,
      fontWeight: 700
    }
  }, confidence, "%"), React.createElement("span", {
    title: "Traffic Light Protocol",
    style: {
      fontSize: 10,
      padding: "3px 8px",
      background: tlp.bg,
      border: `1px solid ${tlp.color}55`,
      color: tlp.color,
      fontFamily: "var(--mono)",
      borderRadius: 3,
      fontWeight: 700
    }
  }, tlp.label), React.createElement("span", {
    className: "card-meta",
    style: {
      fontSize: 12,
      color: "rgba(200,220,240,0.4)"
    }
  }, adv.source_flag, " ", adv.source, " \xB7 ", adv.ts ? timeAgo(adv.ts) : adv.date), onToggleWatch && React.createElement("button", {
    onClick: () => onToggleWatch(adv),
    title: isWatched ? "Remove from Watchlist" : "Save to Watchlist",
    style: {
      marginLeft: "auto",
      background: isWatched ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.03)",
      border: `1px solid ${isWatched ? "#ffd700" : "rgba(255,255,255,0.12)"}`,
      color: isWatched ? "#ffd700" : "rgba(200,220,240,0.45)",
      padding: "3px 10px",
      borderRadius: 4,
      cursor: "pointer",
      fontSize: 12,
      fontFamily: "var(--mono)",
      fontWeight: 700
    }
  }, isWatched ? "★ SAVED" : "☆ SAVE")), React.createElement("div", {
    className: "card-title",
    style: {
      fontSize: 17,
      fontWeight: 700,
      color: "#eef4ff",
      marginBottom: 10,
      lineHeight: 1.45
    }
  }, adv.title), React.createElement("div", {
    className: "card-summary",
    style: {
      fontSize: 14,
      color: "rgba(200,220,240,0.6)",
      lineHeight: 1.75,
      marginBottom: 12
    }
  }, adv.summary), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      marginBottom: 14
    }
  }, adv.cve_ids?.map(c => React.createElement("a", {
    key: c,
    href: `https://nvd.nist.gov/vuln/detail/${c}`,
    target: "_blank",
    rel: "noopener noreferrer",
    style: {
      fontSize: 12,
      color: ACCENT,
      fontFamily: "var(--mono)",
      background: "rgba(0,200,255,0.07)",
      padding: "4px 11px",
      border: `1px solid rgba(0,200,255,0.22)`,
      borderRadius: 3
    }
  }, c, " \u2197")), adv.affected_products?.slice(0, 3).map(p => React.createElement("span", {
    key: p,
    className: "product-tag",
    style: {
      fontSize: 11,
      color: "rgba(200,220,240,0.7)",
      fontFamily: "var(--mono)",
      background: "rgba(255,255,255,0.04)",
      padding: "4px 10px",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 3
    }
  }, "\uD83D\uDCE6 ", p)), mitre.map(m => React.createElement("button", {
    key: m.id,
    type: "button",
    onClick: () => onOpenKnowledge ? onOpenKnowledge({
      type: "technique",
      id: m.id
    }) : window.open(`https://attack.mitre.org/techniques/${m.id}/`, "_blank"),
    title: `Open Knowledge · MITRE ATT&CK ${m.tactic}: ${m.name}`,
    style: {
      fontSize: 11,
      color: m.color,
      fontFamily: "var(--mono)",
      background: `${m.color}14`,
      padding: "4px 10px",
      border: `1px solid ${m.color}44`,
      borderRadius: 3,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, "\u2694\uFE0F ", m.id, " \xB7 ", m.name)), adv.threat_actor && React.createElement("button", {
    type: "button",
    onClick: () => onOpenKnowledge && onOpenKnowledge({
      type: "entity",
      id: adv.threat_actor
    }),
    style: {
      fontSize: 12,
      color: "#c084fc",
      fontFamily: "var(--mono)",
      background: "rgba(123,47,247,0.09)",
      padding: "4px 11px",
      border: "1px solid rgba(123,47,247,0.25)",
      borderRadius: 3,
      cursor: "pointer"
    }
  }, "\uD83C\uDFAF ", adv.threat_actor), adv.patch_available && !isNews && React.createElement("span", {
    style: {
      fontSize: 12,
      color: "#00e676",
      fontFamily: "var(--mono)",
      background: "rgba(0,200,100,0.07)",
      padding: "4px 11px",
      border: "1px solid rgba(0,200,100,0.22)",
      borderRadius: 3
    }
  }, "\u2714 PATCH AVAILABLE")), React.createElement("div", {
    className: "card-footer",
    style: {
      borderTop: "1px solid rgba(255,255,255,0.06)",
      paddingTop: 12,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 10
    }
  }, React.createElement("span", {
    className: "verify-label",
    style: {
      fontSize: 12,
      color: "rgba(200,220,240,0.3)",
      fontFamily: "var(--mono)",
      letterSpacing: 1
    }
  }, "\uD83D\uDD17 VERIFY & TRIAGE"), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, onAskAI && React.createElement("button", {
    onClick: () => onAskAI(adv),
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      fontSize: 12,
      color: "#d8b4fe",
      fontFamily: "var(--mono)",
      background: "rgba(123,47,247,0.12)",
      border: "1px solid rgba(123,47,247,0.4)",
      padding: "7px 14px",
      borderRadius: 4,
      cursor: "pointer",
      fontWeight: 700
    }
  }, "\uD83D\uDEE1\uFE0F AI Triage"), React.createElement("a", {
    href: adv.source_url || "#",
    target: "_blank",
    rel: "noopener noreferrer",
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 7,
      fontSize: 13,
      color: ACCENT,
      fontFamily: "var(--mono)",
      background: "rgba(0,200,255,0.07)",
      border: `1px solid rgba(0,200,255,0.28)`,
      padding: "7px 16px",
      borderRadius: 4,
      whiteSpace: "nowrap",
      fontWeight: 600
    }
  }, adv.source_flag, " View on ", adv.source, " \u2197"))));
}
function SocialCard({
  post
}) {
  const col = post.source_color || "#6364ff";
  const isFresh = post.ts && Date.now() - post.ts < 24 * 60 * 60 * 1000;
  return React.createElement("a", {
    href: post.source_url,
    target: "_blank",
    rel: "noopener noreferrer",
    className: "card social-card",
    style: {
      display: "block",
      background: "rgba(5,8,15,0.92)",
      border: `1px solid ${col}33`,
      borderLeft: `4px solid ${col}`,
      borderRadius: 6,
      padding: "14px 18px",
      marginBottom: 10
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      alignItems: "center",
      marginBottom: 8
    }
  }, React.createElement("span", {
    style: {
      fontSize: 11,
      padding: "3px 10px",
      background: `${col}1f`,
      border: `1px solid ${col}66`,
      color: col,
      letterSpacing: 1,
      fontFamily: "var(--mono)",
      borderRadius: 3,
      fontWeight: 700
    }
  }, post.source_flag, " ", post.source.toUpperCase()), post.author && React.createElement("span", {
    className: "social-author",
    style: {
      fontSize: 12,
      color: "rgba(200,220,240,.55)",
      fontFamily: "var(--mono)"
    }
  }, post.author), post.exploit_in_wild && React.createElement("span", {
    style: {
      fontSize: 11,
      padding: "3px 8px",
      background: "rgba(200,0,0,.15)",
      border: "1px solid #c0000055",
      color: "#ff4444",
      borderRadius: 3,
      fontFamily: "var(--mono)"
    }
  }, "\u26A1"), isFresh && React.createElement("span", {
    style: {
      fontSize: 10,
      padding: "3px 8px",
      background: "rgba(0,200,255,0.1)",
      border: "1px solid rgba(0,200,255,.4)",
      color: "#00c8ff",
      letterSpacing: 1,
      fontFamily: "var(--mono)",
      borderRadius: 3,
      fontWeight: 800
    }
  }, "\u25CF FRESH"), React.createElement("span", {
    className: "card-meta",
    style: {
      fontSize: 11,
      color: "rgba(200,220,240,.35)",
      marginLeft: "auto",
      fontFamily: "var(--mono)"
    }
  }, timeAgo(post.ts))), React.createElement("div", {
    className: "social-summary",
    style: {
      fontSize: 14,
      color: "rgba(220,232,245,.85)",
      lineHeight: 1.65
    }
  }, post.summary), post.cve_ids?.length > 0 && React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap",
      marginTop: 10
    }
  }, post.cve_ids.map(c => React.createElement("span", {
    key: c,
    style: {
      fontSize: 11,
      color: ACCENT,
      fontFamily: "var(--mono)",
      background: "rgba(0,200,255,.07)",
      padding: "3px 9px",
      border: "1px solid rgba(0,200,255,.22)",
      borderRadius: 3
    }
  }, c))));
}
function ThreatVelocityPanel({
  advisories,
  exploits,
  news,
  activeSearch,
  onSelectKeyword
}) {
  const all = [...advisories, ...exploits, ...news];
  if (!all.length) return null;
  const now = Date.now();
  const days = [6, 5, 4, 3, 2, 1, 0].map(offset => {
    const start = now - (offset + 1) * 86400000;
    const end = now - offset * 86400000;
    const d = new Date(end);
    const label = offset === 0 ? "Today" : d.toLocaleDateString("en-GB", {
      weekday: "short"
    });
    const slice = all.filter(a => a.ts && a.ts >= start && a.ts < end);
    const crit = slice.filter(a => a.severity === "CRITICAL" || a.exploit_in_wild).length;
    return {
      label,
      total: slice.length,
      crit
    };
  });
  const maxDay = Math.max(1, ...days.map(d => d.total));
  const VENDORS = [["Microsoft", /microsoft|windows|exchange|sharepoint|azure|defender|office 365/i], ["Linux / Kernel", /\blinux\b|kernel|ubuntu|debian|redhat/i], ["Cisco", /\bcisco\b|ios xe|asa|anyconnect/i], ["Fortinet", /fortinet|fortigate|fortios|fortiguard/i], ["Ivanti", /\bivanti\b|connect secure/i], ["Palo Alto", /palo alto|pan-os|globalprotect/i], ["WordPress", /wordpress|wp-content|plugin/i], ["Google / Android", /\bandroid\b|\bchrome\b|chromium|google cloud/i], ["Apple / iOS", /\bapple\b|\bios\b|macos|webkit/i], ["VMware / ESXi", /vmware|esxi|vcenter/i], ["GitLab / GitHub", /gitlab|github/i], ["AI / LLM", /\bllm\b|openai|anthropic|claude|chatgpt|genai|ai agent|mcp/i]];
  const vendorCounts = VENDORS.map(([name, re]) => ({
    name,
    keyword: name.split(" ")[0],
    count: all.filter(a => re.test(`${a.title} ${a.summary} ${(a.affected_products || []).join(" ")}`)).length
  })).filter(v => v.count > 0).sort((a, b) => b.count - a.count).slice(0, 7);
  const topEpss = [...advisories, ...exploits].filter(a => a.epss != null && a.cve_ids?.length).sort((a, b) => (b.epss || 0) - (a.epss || 0)).slice(0, 4);
  return React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))",
      gap: 12,
      marginBottom: 18
    }
  }, React.createElement("div", {
    style: {
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(0,200,255,0.12)",
      borderRadius: 8,
      padding: "14px 16px"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10
    }
  }, React.createElement("span", {
    style: {
      fontSize: 11,
      letterSpacing: 2,
      color: "rgba(0,200,255,0.7)",
      fontFamily: "var(--mono)",
      fontWeight: 700
    }
  }, "\uD83D\uDCC8 7-DAY THREAT VELOCITY"), React.createElement("span", {
    style: {
      fontSize: 10,
      color: "rgba(200,220,240,0.35)",
      fontFamily: "var(--mono)"
    }
  }, "\uD83D\uDD34 Critical/Wild \xB7 \uD83D\uDD35 Total")), React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      gap: 8,
      height: 64,
      paddingTop: 6
    }
  }, days.map((d, i) => {
    const h = Math.max(6, Math.round(d.total / maxDay * 52));
    const ch = d.total ? Math.round(d.crit / d.total * h) : 0;
    return React.createElement("div", {
      key: i,
      title: `${d.label}: ${d.total} items (${d.crit} critical/wild)`,
      style: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4
      }
    }, React.createElement("div", {
      style: {
        fontSize: 9,
        color: "rgba(200,220,240,0.45)",
        fontFamily: "var(--mono)"
      }
    }, d.total), React.createElement("div", {
      style: {
        width: "100%",
        maxWidth: 28,
        height: h,
        background: "rgba(0,200,255,0.22)",
        border: "1px solid rgba(0,200,255,0.4)",
        borderRadius: 3,
        position: "relative",
        overflow: "hidden"
      }
    }, ch > 0 && React.createElement("div", {
      style: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: ch,
        background: "rgba(255,23,68,0.75)"
      }
    })), React.createElement("div", {
      style: {
        fontSize: 9,
        color: i === 6 ? ACCENT : "rgba(200,220,240,0.35)",
        fontFamily: "var(--mono)",
        fontWeight: i === 6 ? 700 : 400
      }
    }, d.label));
  }))), React.createElement("div", {
    className: "ecosystems-panel",
    style: {
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(123,47,247,0.18)",
      borderRadius: 8,
      padding: "14px 16px"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10
    }
  }, React.createElement("span", {
    style: {
      fontSize: 11,
      letterSpacing: 2,
      color: "rgba(192,132,252,0.8)",
      fontFamily: "var(--mono)",
      fontWeight: 700
    }
  }, "\uD83C\uDFAF TOP TARGETED ECOSYSTEMS"), React.createElement("span", {
    className: "card-meta",
    style: {
      fontSize: 10,
      color: "rgba(200,220,240,0.35)",
      fontFamily: "var(--mono)"
    }
  }, "Click to filter")), React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6
    }
  }, vendorCounts.map(v => {
    const active = activeSearch && activeSearch.toLowerCase() === v.keyword.toLowerCase();
    return React.createElement("button", {
      key: v.name,
      className: `vendor-btn ${active ? "active" : ""}`,
      onClick: () => onSelectKeyword(active ? "" : v.keyword),
      style: {
        padding: "5px 10px",
        fontSize: 11.5,
        fontFamily: "var(--mono)",
        borderRadius: 4,
        cursor: "pointer",
        background: active ? "rgba(0,200,255,0.18)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${active ? ACCENT : "rgba(255,255,255,0.1)"}`,
        color: active ? ACCENT : "#ddeeff",
        fontWeight: active ? 700 : 500
      }
    }, v.name, " ", React.createElement("span", {
      style: {
        color: ACCENT2,
        fontWeight: 800
      }
    }, "(", v.count, ")"));
  })), topEpss.length > 0 && React.createElement("div", {
    style: {
      marginTop: 10,
      paddingTop: 8,
      borderTop: "1px solid rgba(255,255,255,0.06)",
      display: "flex",
      gap: 6,
      flexWrap: "wrap",
      alignItems: "center"
    }
  }, React.createElement("span", {
    style: {
      fontSize: 10,
      color: "rgba(255,145,0,0.8)",
      fontFamily: "var(--mono)",
      letterSpacing: 1
    }
  }, "\uD83D\uDD25 HIGHEST EPSS:"), topEpss.map(item => React.createElement("button", {
    key: item.id,
    onClick: () => onSelectKeyword(item.cve_ids[0]),
    style: {
      fontSize: 10.5,
      fontFamily: "var(--mono)",
      padding: "2px 7px",
      borderRadius: 3,
      background: "rgba(255,23,68,0.12)",
      border: "1px solid rgba(255,23,68,0.35)",
      color: "#ff6e6e",
      cursor: "pointer",
      fontWeight: 700
    }
  }, item.cve_ids[0], " (", item.epss, "%)")))));
}
function AIBriefCard({
  brief
}) {
  if (!brief) return null;
  if (brief.loading) return React.createElement("div", {
    className: "ai-brief-card",
    style: {
      background: "linear-gradient(135deg,rgba(123,47,247,.10),rgba(0,200,255,.06))",
      border: "1px solid rgba(123,47,247,.3)",
      borderRadius: 10,
      padding: "18px 22px",
      marginBottom: 20
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: 3,
      color: "rgba(192,132,252,.8)",
      fontFamily: "var(--mono)",
      marginBottom: 10
    }
  }, "\uD83E\uDD16 AI SITUATION SUMMARY"), [92, 100, 78].map((w, i) => React.createElement("div", {
    key: i,
    style: {
      height: 12,
      width: `${w}%`,
      borderRadius: 6,
      background: "rgba(255,255,255,.06)",
      marginBottom: 9,
      position: "relative",
      overflow: "hidden"
    }
  }, React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      width: "50%",
      background: "linear-gradient(90deg,transparent,rgba(192,132,252,.25),transparent)",
      animation: "shimmer 1.4s infinite"
    }
  }))));
  if (!brief.brief) return null;
  return React.createElement("div", {
    className: "ai-brief-card",
    style: {
      background: "linear-gradient(135deg,rgba(123,47,247,.12),rgba(0,200,255,.06))",
      border: "1px solid rgba(123,47,247,.35)",
      borderRadius: 10,
      padding: "18px 22px",
      marginBottom: 20,
      boxShadow: "0 0 30px rgba(123,47,247,.08)",
      animation: "fadeIn .4s ease"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 10
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: 3,
      color: "rgba(192,132,252,.85)",
      fontFamily: "var(--mono)"
    }
  }, "\uD83E\uDD16 AI SITUATION SUMMARY"), React.createElement("div", {
    className: "brief-meta",
    style: {
      fontSize: 10,
      color: "rgba(200,220,240,.35)",
      fontFamily: "var(--mono)"
    }
  }, "Generated from ", brief.items, " items \xB7 ", brief.sources, " sources \xB7 Workers AI", brief.stale ? " · cached" : "")), React.createElement("div", {
    className: "brief-text",
    style: {
      fontSize: 15,
      color: "rgba(230,238,250,.9)",
      lineHeight: 1.8,
      fontWeight: 400
    }
  }, brief.brief));
}
const AI_KW = ["artificial intelligence", "machine learning", " llm ", "large language", "chatgpt", "openai", "copilot", "gemini", "claude ", "anthropic", "genai", "generative ai", "prompt injection", "jailbreak", "model theft", "training data poisoning", "deepfake", "foundation model", "ai-powered", "ai vulnerability", "agentic ai", "gpt-", "ai agent", "chatbot security", "voice cloning", "ai fraud", "ai phishing", "ai scam", "ai attack", "owasp llm", "llm security", "stable diffusion", "midjourney", "dall-e", "synthetic media", "vector database", "rag attack", "mitre atlas", "ai red team", "model inversion", "data poisoning", "hallucination", "llm guard", "ai safety", "ai governance", "samsung chatgpt", "indirect prompt"];
const OWASP_LLM = [{
  id: "LLM01",
  name: "Prompt Injection",
  risk: "CRITICAL",
  desc: "Attackers craft inputs that override system instructions, causing LLMs to perform unintended actions or leak sensitive data from the system prompt or context window."
}, {
  id: "LLM02",
  name: "Insecure Output Handling",
  risk: "HIGH",
  desc: "LLM outputs passed to downstream systems (shells, browsers, SQL engines) without sanitisation lead to RCE, XSS, or SQL injection vulnerabilities."
}, {
  id: "LLM03",
  name: "Training Data Poisoning",
  risk: "HIGH",
  desc: "Malicious actors corrupt training datasets to introduce backdoors, biases, or vulnerabilities into the deployed model's behaviour at inference time."
}, {
  id: "LLM04",
  name: "Model Denial of Service",
  risk: "HIGH",
  desc: "Resource-intensive prompts exhaust compute budgets, causing denial of service for legitimate users and inflating API costs at scale."
}, {
  id: "LLM05",
  name: "Supply Chain Vulnerabilities",
  risk: "HIGH",
  desc: "Compromised pre-trained models, third-party datasets, or plugins introduce malicious code throughout the AI development and deployment supply chain."
}, {
  id: "LLM06",
  name: "Sensitive Information Disclosure",
  risk: "CRITICAL",
  desc: "LLMs may reveal confidential data from training corpora, system prompts, or prior conversation context to adversaries through targeted queries."
}, {
  id: "LLM07",
  name: "Insecure Plugin Design",
  risk: "HIGH",
  desc: "LLM plugins with excessive permissions or insufficient input validation can be weaponised for data exfiltration or unauthorised system actions."
}, {
  id: "LLM08",
  name: "Excessive Agency",
  risk: "HIGH",
  desc: "Autonomous AI agents granted excessive permissions can take destructive or unauthorised real-world actions without adequate human oversight controls."
}, {
  id: "LLM09",
  name: "Overreliance",
  risk: "MEDIUM",
  desc: "Blind trust in AI outputs without human oversight leads to undetected errors, misinformation propagation, and exploitable security gaps in decision pipelines."
}, {
  id: "LLM10",
  name: "Model Theft",
  risk: "HIGH",
  desc: "Adversaries extract proprietary model weights or replicate model behaviour through systematic API querying, stealing valuable IP and enabling targeted attacks."
}];
const AI_SECURITY_FRAMEWORKS = [{
  name: "OWASP LLM Top 10",
  flag: "🔟",
  url: "https://owasp.org/www-project-top-10-for-large-language-model-applications/",
  desc: "Most critical risks in LLM applications — map controls to every GenAI deployment."
}, {
  name: "MITRE ATLAS",
  flag: "🎯",
  url: "https://atlas.mitre.org/",
  desc: "Adversary tactics and techniques against AI systems — use for threat modelling."
}, {
  name: "NIST AI RMF",
  flag: "🇺🇸",
  url: "https://www.nist.gov/itl/ai-risk-management-framework",
  desc: "US framework to govern, map, measure, and manage AI risk."
}, {
  name: "NIST AI 600-1 (GenAI)",
  flag: "📋",
  url: "https://csrc.nist.gov/pubs/ai/600/1/e2023/final",
  desc: "Generative AI profile for the NIST AI Risk Management Framework."
}, {
  name: "ISO/IEC 42001",
  flag: "🌐",
  url: "https://www.iso.org/standard/81230.html",
  desc: "AI management system standard for enterprise governance and audit."
}, {
  name: "Google SAIF",
  flag: "☁️",
  url: "https://cloud.google.com/security/ai",
  desc: "Secure AI Framework — design patterns for safe AI on cloud."
}, {
  name: "Microsoft AI Red Team",
  flag: "🛡️",
  url: "https://learn.microsoft.com/en-us/security/ai-red-team/",
  desc: "Guidance for red teaming and security testing of AI systems."
}, {
  name: "EU AI Act",
  flag: "🇪🇺",
  url: "https://artificialintelligenceact.eu/",
  desc: "EU regulatory framework for high-risk and general-purpose AI."
}];
const AI_SECURITY_TOOLS = [{
  name: "LLM Guard",
  flag: "🛡️",
  url: "https://github.com/protectai/llm-guard",
  desc: "Open-source toolkit — prompt injection, PII, toxicity, and output scanning."
}, {
  name: "garak",
  flag: "🔍",
  url: "https://github.com/leondz/garak",
  desc: "LLM vulnerability scanner — jailbreaks, leakage, hallucination probes."
}, {
  name: "PyRIT",
  flag: "⚔️",
  url: "https://github.com/Azure/PyRIT",
  desc: "Microsoft's AI red teaming framework for automated adversarial testing."
}, {
  name: "NeMo Guardrails",
  flag: "🚧",
  url: "https://github.com/NVIDIA/NeMo-Guardrails",
  desc: "Programmable guardrails for LLM agents and tool-using apps."
}, {
  name: "Microsoft Presidio",
  flag: "🔒",
  url: "https://github.com/microsoft/presidio",
  desc: "Detect and anonymise PII before data reaches an LLM or logs."
}, {
  name: "AI Incident Database",
  flag: "📊",
  url: "https://incidentdatabase.ai/",
  desc: "Real-world AI failures — Samsung leaks, jailbreaks, misuse cases for briefings."
}, {
  name: "Awesome AI Security",
  flag: "⭐",
  url: "https://github.com/restuhaqza/awesome-ai-security",
  desc: "Master curated index — papers, tools, benchmarks, and community links."
}];
function CISOBriefView({
  advisories,
  exploits,
  news
}) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const fmt = d => d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
  const weekRange = `${fmt(monday)} – ${fmt(friday)}`;
  const allItems = [...advisories, ...exploits];
  const criticals = allItems.filter(a => a.severity === "CRITICAL");
  const wildExploits = allItems.filter(a => a.exploit_in_wild);
  const meItems = allItems.filter(a => a.middle_east_relevance === "HIGH").slice(0, 3);
  const threatActors = [...new Set(allItems.filter(a => a.threat_actor).map(a => a.threat_actor))];
  const patchNow = [...new Map(allItems.filter(a => a.exploit_in_wild || a.severity === "CRITICAL").map(a => [a.id, a])).values()].slice(0, 5);
  const monitor = advisories.filter(a => a.severity === "HIGH" && !a.exploit_in_wild).slice(0, 4);
  const watchList = news.slice(0, 4);
  const sectors = {};
  allItems.forEach(a => {
    const txt = [...(a.affected_products || []), a.title, a.summary].join(" ").toLowerCase();
    if (/microsoft|windows|exchange|sharepoint|active directory|azure|office 365/.test(txt)) sectors["Enterprise IT (Microsoft)"] = (sectors["Enterprise IT (Microsoft)"] || 0) + 1;
    if (/fortinet|palo alto|cisco|vpn|firewall|juniper|checkpoint|ivanti|f5/.test(txt)) sectors["Network Security"] = (sectors["Network Security"] || 0) + 1;
    if (/sap|oracle|erp|banking|payment|swift/.test(txt)) sectors["ERP / Finance"] = (sectors["ERP / Finance"] || 0) + 1;
    if (/scada|ics|industrial|energy|oil|gas|critical infrastructure/.test(txt)) sectors["Critical Infrastructure"] = (sectors["Critical Infrastructure"] || 0) + 1;
    if (/android|apple|ios|mobile|iphone/.test(txt)) sectors["Mobile / Endpoints"] = (sectors["Mobile / Endpoints"] || 0) + 1;
    if (/linux|apache|nginx|kubernetes|docker|cloud|aws|gcp|container/.test(txt)) sectors["Cloud / Linux"] = (sectors["Cloud / Linux"] || 0) + 1;
  });
  const topSectors = Object.entries(sectors).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const riskLevel = criticals.length > 5 ? "ELEVATED" : criticals.length > 2 ? "HIGH" : "MODERATE";
  const riskColor = riskLevel === "ELEVATED" ? "#ff4444" : riskLevel === "HIGH" ? "#ff9944" : "#ffd700";
  const ActionRow = ({
    item,
    label,
    labelColor,
    labelBg
  }) => React.createElement("div", {
    style: {
      background: "rgba(5,8,15,.92)",
      border: "1px solid rgba(255,255,255,.07)",
      borderLeft: `4px solid ${SEV_S[item.severity]?.border || "#444"}`,
      borderRadius: 5,
      padding: "14px 16px",
      marginBottom: 10
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      gap: 7,
      flexWrap: "wrap",
      alignItems: "center",
      marginBottom: 8
    }
  }, React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 800,
      padding: "3px 10px",
      background: labelBg,
      border: `1px solid ${labelColor}`,
      color: labelColor,
      borderRadius: 3,
      fontFamily: "var(--mono)",
      letterSpacing: 1
    }
  }, label), React.createElement(SevBadge, {
    sev: item.severity
  }), item.exploit_in_wild && React.createElement("span", {
    style: {
      fontSize: 11,
      padding: "3px 8px",
      background: "rgba(200,0,0,.15)",
      border: "1px solid #c00000",
      color: "#ff4444",
      borderRadius: 3,
      fontFamily: "var(--mono)"
    }
  }, "\u26A1 WILD"), React.createElement("span", {
    style: {
      fontSize: 11,
      color: "rgba(200,220,240,.35)"
    }
  }, item.source_flag, " ", item.source)), React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: "#eef4ff",
      marginBottom: 6,
      lineHeight: 1.4
    }
  }, item.title), item.cve_ids?.length > 0 && React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap",
      marginBottom: 6
    }
  }, item.cve_ids.slice(0, 3).map(c => React.createElement("a", {
    key: c,
    href: `https://nvd.nist.gov/vuln/detail/${c}`,
    target: "_blank",
    rel: "noopener noreferrer",
    style: {
      fontSize: 11,
      color: ACCENT,
      fontFamily: "var(--mono)",
      background: "rgba(0,200,255,.07)",
      padding: "3px 9px",
      border: "1px solid rgba(0,200,255,.22)",
      borderRadius: 3
    }
  }, c, " \u2197"))), React.createElement("div", {
    style: {
      fontSize: 13,
      color: "rgba(200,220,240,.55)",
      lineHeight: 1.6
    }
  }, (item.summary || "").slice(0, 180), (item.summary || "").length > 180 ? "…" : ""));
  return React.createElement("div", {
    style: {
      maxWidth: 820,
      margin: "0 auto",
      animation: "fadeIn .3s ease"
    }
  }, React.createElement("div", {
    style: {
      background: "rgba(0,200,255,.04)",
      border: "1px solid rgba(0,200,255,.15)",
      borderRadius: 8,
      padding: "22px 24px",
      marginBottom: 16,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      flexWrap: "wrap",
      gap: 12
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: 3,
      color: "rgba(0,200,255,.6)",
      marginBottom: 6,
      fontFamily: "var(--mono)"
    }
  }, "\uD83D\uDCCB CISO WEEKLY THREAT BRIEF"), React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 900,
      color: "#ddeeff",
      marginBottom: 4
    }
  }, "Executive Threat Summary"), React.createElement("div", {
    style: {
      fontSize: 13,
      color: "rgba(200,220,240,.4)"
    }
  }, "Week of ", weekRange, " \xB7 Vikas Pandita, Global Head of Security Architecture")), React.createElement("div", {
    style: {
      textAlign: "right"
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: 2,
      color: "rgba(200,220,240,.35)",
      fontFamily: "var(--mono)",
      marginBottom: 4
    }
  }, "OVERALL RISK LEVEL"), React.createElement("div", {
    style: {
      fontSize: 26,
      fontWeight: 900,
      color: riskColor,
      fontFamily: "var(--mono)"
    }
  }, riskLevel), React.createElement("div", {
    style: {
      fontSize: 11,
      color: "rgba(200,220,240,.3)"
    }
  }, criticals.length, " critical \xB7 ", wildExploits.length, " exploited in wild"))), React.createElement("div", {
    style: {
      background: "rgba(123,47,247,.06)",
      border: "1px solid rgba(123,47,247,.2)",
      borderRadius: 8,
      padding: "20px 22px",
      marginBottom: 16
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: 3,
      color: "rgba(123,47,247,.8)",
      marginBottom: 10,
      fontFamily: "var(--mono)"
    }
  }, "SITUATION OVERVIEW"), React.createElement("div", {
    style: {
      fontSize: 14,
      color: "rgba(200,220,240,.75)",
      lineHeight: 1.85
    }
  }, "This week's threat intelligence from ", React.createElement("strong", {
    style: {
      color: ACCENT
    }
  }, advisories.length + exploits.length + news.length, " sources"), " identifies ", React.createElement("strong", {
    style: {
      color: "#ff4444"
    }
  }, criticals.length, " critical vulnerabilities"), ", with ", React.createElement("strong", {
    style: {
      color: "#ff9944"
    }
  }, wildExploits.length, " actively exploited in the wild"), ".", threatActors.length > 0 && React.createElement(React.Fragment, null, " Active ransomware / APT campaigns confirmed: ", React.createElement("strong", {
    style: {
      color: "#c084fc"
    }
  }, threatActors.slice(0, 3).join(", ")), "."), " ", React.createElement("strong", {
    style: {
      color: "#00e676"
    }
  }, meItems.length, " advisories"), " carry direct GCC / Middle East risk.", topSectors.length > 0 && React.createElement(React.Fragment, null, " Highest-exposure sectors: ", React.createElement("strong", {
    style: {
      color: ACCENT
    }
  }, topSectors.slice(0, 3).map(s => s[0]).join(", ")), "."))), React.createElement("div", {
    style: {
      background: "rgba(123,47,247,.06)",
      border: "1px solid rgba(123,47,247,.25)",
      borderRadius: 8,
      padding: "20px 22px",
      marginBottom: 16
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: 3,
      color: "rgba(123,47,247,.85)",
      marginBottom: 10,
      fontFamily: "var(--mono)"
    }
  }, "\uD83E\uDD16 AI SECURITY & GOVERNANCE"), React.createElement("div", {
    style: {
      fontSize: 14,
      color: "rgba(200,220,240,.75)",
      lineHeight: 1.85
    }
  }, "GenAI risk should be tracked alongside traditional CVE exposure. Align assessments to the", " ", React.createElement("a", {
    href: "https://owasp.org/www-project-top-10-for-large-language-model-applications/",
    target: "_blank",
    rel: "noopener noreferrer",
    style: {
      color: ACCENT2
    }
  }, "OWASP LLM Top 10"), " ", "and ", React.createElement("a", {
    href: "https://atlas.mitre.org/",
    target: "_blank",
    rel: "noopener noreferrer",
    style: {
      color: ACCENT2
    }
  }, "MITRE ATLAS"), " ", "for threat modelling. Use the", " ", React.createElement("a", {
    href: "https://www.nist.gov/itl/ai-risk-management-framework",
    target: "_blank",
    rel: "noopener noreferrer",
    style: {
      color: ACCENT2
    }
  }, "NIST AI RMF"), " ", "for governance. Review real-world failures in the", " ", React.createElement("a", {
    href: "https://incidentdatabase.ai/",
    target: "_blank",
    rel: "noopener noreferrer",
    style: {
      color: ACCENT2
    }
  }, "AI Incident Database"), " ", "(e.g. prompt injection, training-data leaks, agent over-permissioning). Full curated toolkit:", " ", React.createElement("a", {
    href: "https://github.com/restuhaqza/awesome-ai-security",
    target: "_blank",
    rel: "noopener noreferrer",
    style: {
      color: ACCENT2
    }
  }, "Awesome AI Security \u2197"), " ", "\xB7 also in GenAI \u2192 Standards & Tools.")), React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: 3,
      color: "rgba(200,0,0,.7)",
      marginBottom: 10,
      fontFamily: "var(--mono)"
    }
  }, "\uD83D\uDD34 PATCH NOW \u2014 CRITICAL & ACTIVELY EXPLOITED"), patchNow.length === 0 ? React.createElement("div", {
    style: {
      fontSize: 14,
      color: "rgba(200,220,240,.3)",
      marginBottom: 16,
      padding: "14px",
      background: "rgba(255,255,255,.02)",
      borderRadius: 6
    }
  }, "No critical/exploited items this period.") : patchNow.map(a => React.createElement(ActionRow, {
    key: a.id,
    item: a,
    label: "PATCH NOW",
    labelColor: "#ff4444",
    labelBg: "rgba(200,0,0,.15)"
  })), React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: 3,
      color: "rgba(220,100,0,.7)",
      marginBottom: 10,
      fontFamily: "var(--mono)",
      marginTop: 20
    }
  }, "\uD83D\uDFE1 MONITOR \u2014 HIGH SEVERITY"), monitor.length === 0 ? React.createElement("div", {
    style: {
      fontSize: 14,
      color: "rgba(200,220,240,.3)",
      marginBottom: 16,
      padding: "14px",
      background: "rgba(255,255,255,.02)",
      borderRadius: 6
    }
  }, "No high-severity items this period.") : monitor.map(a => React.createElement(ActionRow, {
    key: a.id,
    item: a,
    label: "MONITOR",
    labelColor: "#ff9944",
    labelBg: "rgba(220,100,0,.12)"
  })), topSectors.length > 0 && React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: 3,
      color: "rgba(0,200,255,.6)",
      marginBottom: 10,
      fontFamily: "var(--mono)",
      marginTop: 20
    }
  }, "\uD83C\uDFED SECTOR EXPOSURE THIS WEEK"), React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      marginBottom: 16
    }
  }, topSectors.map(([sector, count]) => {
    const pct = Math.round(count / (topSectors[0][1] || 1) * 100);
    return React.createElement("div", {
      key: sector,
      style: {
        flex: 1,
        minWidth: 140,
        background: "rgba(255,255,255,.025)",
        border: "1px solid rgba(255,255,255,.07)",
        borderRadius: 6,
        padding: "14px 16px"
      }
    }, React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 700,
        color: "#ddeeff",
        marginBottom: 8
      }
    }, sector), React.createElement("div", {
      style: {
        height: 4,
        background: "rgba(255,255,255,.06)",
        borderRadius: 2,
        overflow: "hidden",
        marginBottom: 6
      }
    }, React.createElement("div", {
      style: {
        width: `${pct}%`,
        height: "100%",
        background: `linear-gradient(90deg,${ACCENT}55,${ACCENT})`,
        borderRadius: 2
      }
    })), React.createElement("div", {
      style: {
        fontSize: 11,
        color: "rgba(200,220,240,.4)",
        fontFamily: "var(--mono)"
      }
    }, count, " advisories"));
  }))), threatActors.length > 0 && React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: 3,
      color: "rgba(192,132,252,.7)",
      marginBottom: 10,
      fontFamily: "var(--mono)",
      marginTop: 4
    }
  }, "\uD83C\uDFAF ACTIVE THREAT ACTORS"), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      marginBottom: 16
    }
  }, threatActors.map(ta => React.createElement("span", {
    key: ta,
    style: {
      fontSize: 13,
      color: "#c084fc",
      fontFamily: "var(--mono)",
      background: "rgba(123,47,247,.09)",
      padding: "7px 14px",
      border: "1px solid rgba(123,47,247,.25)",
      borderRadius: 4
    }
  }, ta)))), meItems.length > 0 && React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: 3,
      color: "rgba(0,200,100,.6)",
      marginBottom: 10,
      fontFamily: "var(--mono)",
      marginTop: 4
    }
  }, "\uD83C\uDF0D GCC / MIDDLE EAST ALERT"), meItems.map(a => React.createElement(ActionRow, {
    key: a.id,
    item: a,
    label: "GCC RISK",
    labelColor: "#00e676",
    labelBg: "rgba(0,200,100,.1)"
  }))), React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: 3,
      color: "rgba(0,200,255,.5)",
      marginBottom: 10,
      fontFamily: "var(--mono)",
      marginTop: 20
    }
  }, "\uD83D\uDCF0 WATCH \u2014 EMERGING INTELLIGENCE"), watchList.map(a => React.createElement(ActionRow, {
    key: a.id,
    item: a,
    label: "WATCH",
    labelColor: "#64b5f6",
    labelBg: "rgba(25,118,210,.12)"
  })), React.createElement("div", {
    style: {
      padding: "14px 16px",
      background: "rgba(0,200,255,.03)",
      border: "1px solid rgba(0,200,255,.08)",
      borderRadius: 6,
      marginTop: 16,
      fontSize: 12,
      color: "rgba(200,220,240,.35)",
      lineHeight: 1.7
    }
  }, "\uD83D\uDCCB Auto-generated from ", advisories.length + exploits.length + news.length, " live sources \xB7 BCyberAware by Vikas Pandita (Global Head of Security Architecture \xB7 TOGAF 9.2 \xB7 IIM Kozhikode EPGP) \xB7 Sources refresh every 2 hours"));
}
function GenAISecurityView({
  advisories,
  exploits,
  news
}) {
  const [aiTab, setAiTab] = useState("overview");
  const isAI = item => {
    const text = (item.title + " " + item.summary).toLowerCase();
    return AI_KW.some(kw => text.includes(kw));
  };
  const aiAdvisories = advisories.filter(isAI);
  const aiExploits = exploits.filter(isAI);
  const aiNews = news.filter(isAI);
  const totalAI = aiAdvisories.length + aiExploits.length + aiNews.length;
  return React.createElement("div", {
    style: {
      animation: "fadeIn .3s ease"
    }
  }, React.createElement("div", {
    style: {
      textAlign: "center",
      marginBottom: 20
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      letterSpacing: 4,
      color: ACCENT2,
      marginBottom: 8,
      fontFamily: "var(--mono)"
    }
  }, "\uD83E\uDD16 GENAI SECURITY INTELLIGENCE"), React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 900,
      color: "#ddeeff",
      marginBottom: 6
    }
  }, "AI & LLM Threat Landscape"), React.createElement("div", {
    style: {
      fontSize: 14,
      color: "rgba(200,220,240,.4)"
    }
  }, "Curated by Vikas Pandita \xB7 GenAI Security Specialist")), React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      marginBottom: 16,
      flexWrap: "wrap"
    }
  }, React.createElement(StatCard, {
    label: "AI Advisories",
    value: aiAdvisories.length,
    color: ACCENT2
  }), React.createElement(StatCard, {
    label: "AI Exploits",
    value: aiExploits.length,
    color: "#ff4444"
  }), React.createElement(StatCard, {
    label: "AI News Items",
    value: aiNews.length,
    color: "#e91e63"
  }), React.createElement(StatCard, {
    label: "Total AI Items",
    value: totalAI,
    color: ACCENT
  })), React.createElement("div", {
    style: {
      display: "flex",
      gap: 4,
      marginBottom: 16,
      borderBottom: "1px solid rgba(255,255,255,.07)",
      overflowX: "auto",
      WebkitOverflowScrolling: "touch"
    }
  }, [["overview", "📊 Overview"], ["owasp", "🔟 OWASP LLM Top 10"], ["resources", "📚 Standards & Tools"], ["feed", "📡 Live AI Feed"]].map(([id, lbl]) => React.createElement("button", {
    key: id,
    onClick: () => setAiTab(id),
    style: {
      padding: "10px 18px",
      background: "transparent",
      border: "none",
      borderBottom: aiTab === id ? `3px solid ${ACCENT2}` : "3px solid transparent",
      color: aiTab === id ? ACCENT2 : "rgba(200,220,240,.45)",
      fontSize: 14,
      cursor: "pointer",
      fontFamily: "var(--mono)",
      fontWeight: aiTab === id ? 700 : 400,
      whiteSpace: "nowrap"
    }
  }, lbl))), aiTab === "overview" && React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: 3,
      color: "rgba(123,47,247,.7)",
      marginBottom: 12,
      fontFamily: "var(--mono)"
    }
  }, "AI THREAT CATEGORIES"), React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))",
      gap: 10,
      marginBottom: 20
    }
  }, [{
    icon: "💉",
    name: "Prompt Injection",
    desc: "Crafted inputs override LLM system instructions to bypass safety controls or exfiltrate confidential data",
    risk: "CRITICAL",
    color: "#ff4444",
    bg: "rgba(200,0,0,.08)"
  }, {
    icon: "🎭",
    name: "Deepfakes & Synthetic Media",
    desc: "AI-generated fake audio/video used for fraud, social engineering, and large-scale disinformation campaigns",
    risk: "HIGH",
    color: "#ff9944",
    bg: "rgba(220,100,0,.08)"
  }, {
    icon: "🕵️",
    name: "AI-Powered Phishing",
    desc: "LLMs generating highly personalised, grammatically perfect phishing at scale in any language",
    risk: "HIGH",
    color: "#ff9944",
    bg: "rgba(220,100,0,.08)"
  }, {
    icon: "☠️",
    name: "Training Data Poisoning",
    desc: "Corrupting datasets to embed backdoors or malicious biases into production AI models before deployment",
    risk: "HIGH",
    color: "#ff9944",
    bg: "rgba(220,100,0,.08)"
  }, {
    icon: "🔓",
    name: "Data Exfiltration via LLM",
    desc: "Extracting sensitive PII or IP through crafted prompts against RAG systems and vector databases",
    risk: "CRITICAL",
    color: "#ff4444",
    bg: "rgba(200,0,0,.08)"
  }, {
    icon: "🤖",
    name: "Rogue AI Agents",
    desc: "Agentic AI with excessive permissions taking unauthorised real-world actions without human oversight",
    risk: "HIGH",
    color: "#ff9944",
    bg: "rgba(220,100,0,.08)"
  }, {
    icon: "🧬",
    name: "Model Theft",
    desc: "Stealing proprietary AI models via systematic API extraction or direct model-weight exfiltration",
    risk: "HIGH",
    color: "#ff9944",
    bg: "rgba(220,100,0,.08)"
  }, {
    icon: "💰",
    name: "AI Fraud & Scams",
    desc: "Voice cloning and AI personas used for financial fraud, BEC, and executive impersonation at scale",
    risk: "HIGH",
    color: "#ff9944",
    bg: "rgba(220,100,0,.08)"
  }].map(t => React.createElement("div", {
    key: t.name,
    style: {
      background: t.bg,
      border: `1px solid ${t.color}22`,
      borderLeft: `3px solid ${t.color}`,
      borderRadius: 6,
      padding: "16px"
    }
  }, React.createElement("div", {
    style: {
      fontSize: 22,
      marginBottom: 6
    }
  }, t.icon), React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: "#eef4ff",
      marginBottom: 5
    }
  }, t.name), React.createElement("div", {
    style: {
      fontSize: 12,
      color: "rgba(200,220,240,.5)",
      lineHeight: 1.6,
      marginBottom: 8
    }
  }, t.desc), React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 800,
      padding: "3px 10px",
      background: "rgba(0,0,0,.2)",
      border: `1px solid ${t.color}`,
      color: t.color,
      borderRadius: 3,
      fontFamily: "var(--mono)"
    }
  }, t.risk)))), React.createElement("div", {
    style: {
      background: "rgba(0,166,81,.06)",
      border: "1px solid rgba(0,166,81,.2)",
      borderRadius: 8,
      padding: "20px 22px",
      marginBottom: 16
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: 3,
      color: "rgba(0,200,100,.7)",
      marginBottom: 10,
      fontFamily: "var(--mono)"
    }
  }, "\uD83C\uDF0D AI RISK FOR GCC / MIDDLE EAST ORGANISATIONS"), [{
    threat: "AI-Enhanced BEC & Wire Fraud",
    impact: "GCC banking sector facing AI-generated executive voice cloning targeting fraudulent wire transfer approvals"
  }, {
    threat: "Deepfake Government Communications",
    impact: "AI-forged official communications targeting GCC public sector — verify all digital correspondence and requests"
  }, {
    threat: "Arabic-Language AI Phishing",
    impact: "LLMs now produce fluent Arabic phishing — language quality is no longer a reliable detection indicator"
  }, {
    threat: "Smart City & ICS AI Attacks",
    impact: "AI-optimised attacks on Vision 2030 and UAE smart city infrastructure (SCADA + AI convergence risk)"
  }].map(r => React.createElement("div", {
    key: r.threat,
    style: {
      display: "flex",
      gap: 12,
      padding: "10px 0",
      borderBottom: "1px solid rgba(0,200,100,.08)"
    }
  }, React.createElement("span", {
    style: {
      color: "#00e676",
      flexShrink: 0
    }
  }, "\u25B8"), React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: "#00e676",
      marginBottom: 3
    }
  }, r.threat), React.createElement("div", {
    style: {
      fontSize: 13,
      color: "rgba(200,220,240,.5)",
      lineHeight: 1.6
    }
  }, r.impact)))))), aiTab === "owasp" && React.createElement("div", null, React.createElement("div", {
    style: {
      background: "rgba(255,255,255,.02)",
      border: "1px solid rgba(0,200,255,.1)",
      borderRadius: 8,
      padding: "16px 20px",
      marginBottom: 16,
      fontSize: 13,
      color: "rgba(200,220,240,.5)",
      lineHeight: 1.7
    }
  }, "The ", React.createElement("strong", {
    style: {
      color: ACCENT
    }
  }, "OWASP Top 10 for LLM Applications"), " defines the most critical security risks in large language model deployments. As a GenAI Security specialist, these are the controls every AI system must address before going to production."), React.createElement("div", {
    style: {
      display: "grid",
      gap: 10
    }
  }, OWASP_LLM.map(item => {
    const s = SEV_S[item.risk] || SEV_S.LOW;
    return React.createElement("div", {
      key: item.id,
      style: {
        background: "rgba(5,8,15,.92)",
        border: `1px solid ${s.border}33`,
        borderLeft: `4px solid ${s.border}`,
        borderRadius: 6,
        padding: "16px 18px"
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        gap: 10,
        alignItems: "center",
        marginBottom: 8,
        flexWrap: "wrap"
      }
    }, React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 900,
        color: ACCENT2,
        fontFamily: "var(--mono)",
        minWidth: 52
      }
    }, item.id), React.createElement("span", {
      style: {
        fontSize: 15,
        fontWeight: 700,
        color: "#eef4ff"
      }
    }, item.name), React.createElement(SevBadge, {
      sev: item.risk
    })), React.createElement("div", {
      style: {
        fontSize: 13,
        color: "rgba(200,220,240,.6)",
        lineHeight: 1.75
      }
    }, item.desc));
  })), React.createElement("div", {
    style: {
      padding: "12px 16px",
      background: "rgba(123,47,247,.05)",
      border: "1px solid rgba(123,47,247,.15)",
      borderRadius: 6,
      marginTop: 14,
      fontSize: 12,
      color: "rgba(200,220,240,.4)",
      lineHeight: 1.7
    }
  }, "Source: ", React.createElement("a", {
    href: "https://owasp.org/www-project-top-10-for-large-language-model-applications/",
    target: "_blank",
    rel: "noopener noreferrer",
    style: {
      color: ACCENT2
    }
  }, "OWASP Top 10 for LLM Applications \u2197"), " \xB7 Curated for GCC practitioners by Vikas Pandita")), aiTab === "resources" && React.createElement("div", null, React.createElement("div", {
    style: {
      background: "rgba(255,255,255,.02)",
      border: "1px solid rgba(123,47,247,.2)",
      borderRadius: 8,
      padding: "16px 20px",
      marginBottom: 16,
      fontSize: 13,
      color: "rgba(200,220,240,.55)",
      lineHeight: 1.75
    }
  }, "Curated from", " ", React.createElement("a", {
    href: "https://github.com/restuhaqza/awesome-ai-security",
    target: "_blank",
    rel: "noopener noreferrer",
    style: {
      color: ACCENT2,
      fontWeight: 600
    }
  }, "Awesome AI Security \u2197"), " ", "\u2014 frameworks for governance and open tools for LLM red teaming, guardrails, and incident research. Use across BCyberAware, Threatforge, and SAR projects."), React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: 3,
      color: "rgba(123,47,247,.7)",
      marginBottom: 12,
      fontFamily: "var(--mono)"
    }
  }, "FRAMEWORKS & STANDARDS"), React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
      gap: 10,
      marginBottom: 20
    }
  }, AI_SECURITY_FRAMEWORKS.map(r => React.createElement("a", {
    key: r.name,
    href: r.url,
    target: "_blank",
    rel: "noopener noreferrer",
    style: {
      display: "block",
      background: "rgba(5,8,15,.92)",
      border: "1px solid rgba(123,47,247,.2)",
      borderLeft: `4px solid ${ACCENT2}`,
      borderRadius: 6,
      padding: "14px 16px",
      textDecoration: "none"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      marginBottom: 6
    }
  }, React.createElement("span", {
    style: {
      fontSize: 18
    }
  }, r.flag), React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: "#eef4ff"
    }
  }, r.name), React.createElement("span", {
    style: {
      fontSize: 11,
      color: ACCENT2,
      marginLeft: "auto",
      fontFamily: "var(--mono)"
    }
  }, "\u2197")), React.createElement("div", {
    style: {
      fontSize: 12,
      color: "rgba(200,220,240,.5)",
      lineHeight: 1.65
    }
  }, r.desc)))), React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: 3,
      color: "rgba(0,200,255,.6)",
      marginBottom: 12,
      fontFamily: "var(--mono)"
    }
  }, "TOOLS & RESEARCH"), React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
      gap: 10
    }
  }, AI_SECURITY_TOOLS.map(r => React.createElement("a", {
    key: r.name,
    href: r.url,
    target: "_blank",
    rel: "noopener noreferrer",
    style: {
      display: "block",
      background: "rgba(5,8,15,.92)",
      border: "1px solid rgba(0,200,255,.15)",
      borderLeft: `4px solid ${ACCENT}`,
      borderRadius: 6,
      padding: "14px 16px",
      textDecoration: "none"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      marginBottom: 6
    }
  }, React.createElement("span", {
    style: {
      fontSize: 18
    }
  }, r.flag), React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: "#eef4ff"
    }
  }, r.name), React.createElement("span", {
    style: {
      fontSize: 11,
      color: ACCENT,
      marginLeft: "auto",
      fontFamily: "var(--mono)"
    }
  }, "\u2197")), React.createElement("div", {
    style: {
      fontSize: 12,
      color: "rgba(200,220,240,.5)",
      lineHeight: 1.65
    }
  }, r.desc))))), aiTab === "feed" && React.createElement("div", null, totalAI === 0 ? React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "40px",
      color: "rgba(200,220,240,.3)",
      fontSize: 14
    }
  }, "No AI-specific items in current feed. Try \u26A1 Force Latest to refresh.") : React.createElement(React.Fragment, null, aiAdvisories.length > 0 && React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: 2,
      color: "rgba(0,200,255,.5)",
      marginBottom: 10,
      fontFamily: "var(--mono)"
    }
  }, "\uD83C\uDFDB\uFE0F AI-RELATED ADVISORIES (", aiAdvisories.length, ")"), aiAdvisories.map(a => React.createElement(AdvisoryCard, {
    key: a.id,
    adv: a
  }))), aiExploits.length > 0 && React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: 2,
      color: "rgba(200,0,0,.6)",
      marginBottom: 10,
      fontFamily: "var(--mono)",
      marginTop: 16
    }
  }, "\u26A1 AI-RELATED EXPLOITS (", aiExploits.length, ")"), aiExploits.map(a => React.createElement(AdvisoryCard, {
    key: a.id,
    adv: a
  }))), aiNews.length > 0 && React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: 2,
      color: "rgba(233,30,99,.6)",
      marginBottom: 10,
      fontFamily: "var(--mono)",
      marginTop: 16
    }
  }, "\uD83D\uDCF0 AI SECURITY NEWS (", aiNews.length, ")"), aiNews.map(a => React.createElement(AdvisoryCard, {
    key: a.id,
    adv: a
  }))))));
}
function DarkWebView() {
  const DW_RED = "#ff1744";
  const DW_PURPLE = "#7c4dff";
  const DW_ORANGE = "#ff6d00";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("victims");
  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(force ? "/api/darkweb?bust=1" : "/api/darkweb", {
        cache: "no-store"
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const victims = data?.ransomware_victims || [];
  const groups = data?.ransomware_groups || [];
  const breaches = data?.data_breaches || [];
  const c2s = data?.c2_servers || [];
  const activeGroups = groups.filter(g => (g.status || "").toLowerCase().includes("activ")).length;
  const DWCard = ({
    left,
    children
  }) => React.createElement("div", {
    style: {
      background: "rgba(5,8,15,.92)",
      border: `1px solid ${left}33`,
      borderLeft: `4px solid ${left}`,
      borderRadius: 6,
      padding: "16px 18px",
      marginBottom: 10
    }
  }, children);
  const Tag = ({
    color,
    bg,
    border,
    children
  }) => React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 800,
      padding: "3px 10px",
      background: bg || `${color}22`,
      border: `1px solid ${border || color}`,
      color,
      borderRadius: 3,
      fontFamily: "var(--mono)",
      letterSpacing: 1
    }
  }, children);
  if (loading) return React.createElement("div", {
    style: {
      animation: "fadeIn .3s ease",
      textAlign: "center",
      padding: "60px 20px"
    }
  }, React.createElement("div", {
    style: {
      fontSize: 14,
      color: DW_RED,
      fontFamily: "var(--mono)",
      letterSpacing: 3,
      animation: "pulse 1.5s infinite"
    }
  }, "\u27F3 SCANNING DARK WEB SOURCES\u2026"), React.createElement("div", {
    style: {
      fontSize: 12,
      color: "rgba(200,220,240,.3)",
      marginTop: 10
    }
  }, "ransomware.live \xB7 HaveIBeenPwned \xB7 Cybercrime Tracker"));
  if (error) return React.createElement("div", {
    style: {
      padding: "18px 20px",
      background: "rgba(200,0,0,.1)",
      border: "1px solid rgba(200,0,0,.3)",
      borderRadius: 6,
      fontSize: 14,
      color: "#ff6666"
    }
  }, "\u26A0 Dark web feed unavailable: ", error, React.createElement("button", {
    onClick: () => load(true),
    style: {
      marginLeft: 14,
      padding: "4px 12px",
      background: "rgba(200,0,0,.15)",
      border: "1px solid rgba(200,0,0,.4)",
      color: "#ff6666",
      fontSize: 12,
      cursor: "pointer",
      fontFamily: "var(--mono)",
      borderRadius: 4
    }
  }, "Retry"));
  return React.createElement("div", {
    style: {
      animation: "fadeIn .3s ease"
    }
  }, React.createElement("div", {
    style: {
      background: "rgba(139,0,0,.12)",
      border: "1px solid rgba(255,23,68,.25)",
      borderRadius: 8,
      padding: "18px 22px",
      marginBottom: 20,
      display: "flex",
      alignItems: "flex-start",
      gap: 16,
      flexWrap: "wrap"
    }
  }, React.createElement("span", {
    style: {
      fontSize: 30,
      flexShrink: 0,
      lineHeight: 1
    }
  }, "\uD83D\uDD75\uFE0F"), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 260
    }
  }, React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 900,
      color: DW_RED,
      marginBottom: 6,
      letterSpacing: 1.5,
      fontFamily: "var(--mono)"
    }
  }, "DARK WEB EARLY WARNING SYSTEM"), React.createElement("div", {
    style: {
      fontSize: 13,
      color: "rgba(200,220,240,.55)",
      lineHeight: 1.75
    }
  }, "Open-source dark web intelligence: ransomware leak sites, public breach notifications, and C2 server tracking.", " ", "Sources: ", React.createElement("strong", {
    style: {
      color: "rgba(200,220,240,.8)"
    }
  }, "ransomware.live"), " \xB7 ", React.createElement("strong", {
    style: {
      color: "rgba(200,220,240,.8)"
    }
  }, "HaveIBeenPwned"), " \xB7 ", React.createElement("strong", {
    style: {
      color: "rgba(200,220,240,.8)"
    }
  }, "Cybercrime Tracker"), " \xB7 No personal data lookups.")), React.createElement("button", {
    onClick: () => load(true),
    disabled: loading,
    style: {
      flexShrink: 0,
      padding: "7px 16px",
      background: "rgba(255,23,68,.1)",
      border: "1px solid rgba(255,23,68,.35)",
      color: DW_RED,
      fontSize: 12,
      cursor: "pointer",
      fontFamily: "var(--mono)",
      borderRadius: 4,
      fontWeight: 700,
      whiteSpace: "nowrap"
    }
  }, "\u26A1 Force Latest")), React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      marginBottom: 20,
      flexWrap: "wrap"
    }
  }, React.createElement(StatCard, {
    label: "Ransomware Victims",
    value: victims.length,
    color: DW_RED,
    sub: "Recent (leak sites)"
  }), React.createElement(StatCard, {
    label: "Active Groups",
    value: activeGroups,
    color: "#ff4444",
    sub: "Ransomware Gangs"
  }), React.createElement(StatCard, {
    label: "Known Data Breaches",
    value: breaches.length,
    color: DW_PURPLE,
    sub: "via HaveIBeenPwned"
  }), React.createElement(StatCard, {
    label: "C2 Servers Tracked",
    value: c2s.length,
    color: DW_ORANGE,
    sub: "Cybercrime Tracker"
  })), React.createElement("div", {
    style: {
      display: "flex",
      gap: 4,
      marginBottom: 16,
      borderBottom: "1px solid rgba(255,255,255,.07)",
      flexWrap: "wrap"
    }
  }, [["victims", `🎯 Ransomware Victims (${victims.length})`], ["groups", `💀 Active Groups (${groups.length})`], ["breaches", `🔓 Data Breaches (${breaches.length})`], ["c2", `🕷️ C2 Servers (${c2s.length})`]].map(([id, lbl]) => React.createElement("button", {
    key: id,
    onClick: () => setTab(id),
    style: {
      padding: "10px 18px",
      background: "transparent",
      border: "none",
      borderBottom: tab === id ? `3px solid ${DW_RED}` : "3px solid transparent",
      color: tab === id ? DW_RED : "rgba(200,220,240,.45)",
      fontSize: 14,
      cursor: "pointer",
      fontFamily: "var(--mono)",
      fontWeight: tab === id ? 700 : 400,
      whiteSpace: "nowrap"
    }
  }, lbl))), tab === "victims" && (victims.length === 0 ? React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "40px",
      color: "rgba(200,220,240,.3)",
      fontSize: 14
    }
  }, "No victim data loaded. Try \u26A1 Force Latest.") : victims.map((v, i) => React.createElement(DWCard, {
    key: i,
    left: "#c00000"
  }, React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      alignItems: "center",
      marginBottom: 10
    }
  }, React.createElement(Tag, {
    color: "#ff4444",
    bg: "rgba(200,0,0,.15)",
    border: "#c00000"
  }, "\uD83C\uDFAF RANSOMWARE VICTIM"), React.createElement("span", {
    style: {
      fontSize: 12,
      color: "#c084fc",
      fontFamily: "var(--mono)",
      background: "rgba(123,47,247,.09)",
      padding: "3px 10px",
      border: "1px solid rgba(123,47,247,.25)",
      borderRadius: 3
    }
  }, v.group), v.country && React.createElement("span", {
    style: {
      fontSize: 12,
      color: "rgba(200,220,240,.45)",
      fontFamily: "var(--mono)",
      padding: "3px 8px",
      border: "1px solid rgba(255,255,255,.1)",
      borderRadius: 3
    }
  }, v.country), v.sector && React.createElement("span", {
    style: {
      fontSize: 12,
      color: "rgba(200,220,240,.35)"
    }
  }, v.sector), React.createElement("span", {
    style: {
      fontSize: 11,
      color: "rgba(200,220,240,.3)",
      marginLeft: "auto",
      fontFamily: "var(--mono)"
    }
  }, v.date ? new Date(v.date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }) : "")), React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: "#eef4ff",
      marginBottom: v.description ? 8 : 0
    }
  }, v.victim), v.description && React.createElement("div", {
    style: {
      fontSize: 13,
      color: "rgba(200,220,240,.5)",
      lineHeight: 1.75
    }
  }, v.description), v.website && React.createElement("div", {
    style: {
      marginTop: 12,
      paddingTop: 10,
      borderTop: "1px solid rgba(255,255,255,.05)"
    }
  }, React.createElement("a", {
    href: v.website.startsWith("http") ? v.website : `https://${v.website}`,
    target: "_blank",
    rel: "noopener noreferrer",
    style: {
      fontSize: 12,
      color: ACCENT,
      fontFamily: "var(--mono)",
      background: "rgba(0,200,255,.07)",
      padding: "4px 12px",
      border: "1px solid rgba(0,200,255,.22)",
      borderRadius: 3,
      display: "inline-block"
    }
  }, "\uD83C\uDF10 ", v.website.replace(/^https?:\/\//, "").slice(0, 55), " \u2197"))))), tab === "groups" && (groups.length === 0 ? React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "40px",
      color: "rgba(200,220,240,.3)",
      fontSize: 14
    }
  }, "No group data loaded. Try \u26A1 Force Latest.") : React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))",
      gap: 10
    }
  }, groups.map((g, i) => {
    const isActive = (g.status || "").toLowerCase().includes("activ");
    return React.createElement("div", {
      key: i,
      style: {
        background: "rgba(5,8,15,.92)",
        border: `1px solid ${isActive ? "rgba(255,23,68,.2)" : "rgba(255,255,255,.07)"}`,
        borderLeft: `4px solid ${isActive ? "#c00000" : "#333"}`,
        borderRadius: 6,
        padding: "16px 18px"
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        marginBottom: 10,
        gap: 8
      }
    }, React.createElement("div", {
      style: {
        fontSize: 15,
        fontWeight: 700,
        color: "#eef4ff"
      }
    }, g.name), React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        padding: "2px 8px",
        background: isActive ? "rgba(200,0,0,.15)" : "rgba(255,255,255,.04)",
        border: `1px solid ${isActive ? "#c00000" : "rgba(255,255,255,.1)"}`,
        color: isActive ? "#ff4444" : "rgba(200,220,240,.35)",
        borderRadius: 3,
        fontFamily: "var(--mono)",
        flexShrink: 0,
        whiteSpace: "nowrap"
      }
    }, isActive ? "● ACTIVE" : "◌ INACTIVE")), g.victim_count > 0 && React.createElement(React.Fragment, null, React.createElement("div", {
      style: {
        fontSize: 30,
        fontWeight: 900,
        color: isActive ? "#ff4444" : "rgba(200,220,240,.3)",
        fontFamily: "var(--mono)",
        lineHeight: 1
      }
    }, g.victim_count), React.createElement("div", {
      style: {
        fontSize: 10,
        color: "rgba(200,220,240,.3)",
        letterSpacing: 2,
        fontFamily: "var(--mono)",
        marginTop: 2,
        marginBottom: 8
      }
    }, "KNOWN VICTIMS")), g.last_seen && React.createElement("div", {
      style: {
        fontSize: 12,
        color: "rgba(200,220,240,.3)",
        marginBottom: 4
      }
    }, "Last seen: ", g.last_seen), g.description && React.createElement("div", {
      style: {
        fontSize: 12,
        color: "rgba(200,220,240,.4)",
        lineHeight: 1.65,
        marginTop: 6
      }
    }, g.description), g.locations?.length > 0 && React.createElement("div", {
      style: {
        display: "flex",
        gap: 4,
        flexWrap: "wrap",
        marginTop: 8
      }
    }, g.locations.slice(0, 3).map(loc => React.createElement("span", {
      key: loc,
      style: {
        fontSize: 10,
        color: "rgba(200,220,240,.35)",
        fontFamily: "var(--mono)",
        padding: "2px 6px",
        border: "1px solid rgba(255,255,255,.07)",
        borderRadius: 2
      }
    }, loc))));
  }))), tab === "breaches" && (breaches.length === 0 ? React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "40px",
      color: "rgba(200,220,240,.3)",
      fontSize: 14
    }
  }, "No breach data loaded. Try \u26A1 Force Latest.") : breaches.map((b, i) => React.createElement(DWCard, {
    key: i,
    left: "#7c4dff"
  }, React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      alignItems: "center",
      marginBottom: 10
    }
  }, React.createElement(Tag, {
    color: "#b39ddb",
    bg: "rgba(124,77,255,.15)",
    border: "#7c4dff"
  }, "\uD83D\uDD13 DATA BREACH"), b.is_verified && React.createElement(Tag, {
    color: "#ff6666",
    bg: "rgba(200,0,0,.1)",
    border: "rgba(200,0,0,.35)"
  }, "\u2713 VERIFIED"), b.is_sensitive && React.createElement(Tag, {
    color: "#ff9944",
    bg: "rgba(255,100,0,.1)",
    border: "rgba(255,100,0,.3)"
  }, "\u26A0 SENSITIVE"), React.createElement("span", {
    style: {
      fontSize: 11,
      color: "rgba(200,220,240,.35)",
      marginLeft: "auto",
      fontFamily: "var(--mono)"
    }
  }, b.breach_date)), React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: "#eef4ff",
      marginBottom: 4
    }
  }, b.title), b.domain && React.createElement("div", {
    style: {
      fontSize: 13,
      color: "rgba(0,200,255,.6)",
      fontFamily: "var(--mono)",
      marginBottom: 8
    }
  }, b.domain), b.description && React.createElement("div", {
    style: {
      fontSize: 13,
      color: "rgba(200,220,240,.5)",
      lineHeight: 1.75,
      marginBottom: 10
    }
  }, b.description), b.data_classes?.length > 0 && React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap",
      marginBottom: 10
    }
  }, b.data_classes.map(dc => React.createElement("span", {
    key: dc,
    style: {
      fontSize: 11,
      color: "#b39ddb",
      fontFamily: "var(--mono)",
      background: "rgba(124,77,255,.09)",
      padding: "3px 9px",
      border: "1px solid rgba(124,77,255,.2)",
      borderRadius: 3
    }
  }, dc))), b.pwn_count > 0 && React.createElement("div", {
    style: {
      fontSize: 13,
      color: "rgba(200,220,240,.4)",
      fontFamily: "var(--mono)",
      borderTop: "1px solid rgba(255,255,255,.05)",
      paddingTop: 8
    }
  }, React.createElement("span", {
    style: {
      color: "#ff4444",
      fontWeight: 700
    }
  }, b.pwn_count.toLocaleString()), " accounts compromised")))), tab === "c2" && (c2s.length === 0 ? React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "40px",
      color: "rgba(200,220,240,.3)",
      fontSize: 14
    }
  }, "No C2 data loaded. Try \u26A1 Force Latest.") : c2s.map((c, i) => React.createElement(DWCard, {
    key: i,
    left: "#e65100"
  }, React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      alignItems: "center",
      marginBottom: 8
    }
  }, React.createElement(Tag, {
    color: "#ff9944",
    bg: "rgba(255,109,0,.12)",
    border: "#e65100"
  }, "\uD83D\uDD77\uFE0F C2 SERVER"), React.createElement("span", {
    style: {
      fontSize: 11,
      color: "rgba(200,220,240,.3)",
      fontFamily: "var(--mono)"
    }
  }, c.date ? new Date(c.date).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }) : ""), c.url && React.createElement("a", {
    href: c.url,
    target: "_blank",
    rel: "noopener noreferrer",
    style: {
      marginLeft: "auto",
      fontSize: 11,
      color: ACCENT,
      fontFamily: "var(--mono)"
    }
  }, "Inspect \u2197")), React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: "#eef4ff",
      marginBottom: c.description ? 6 : 0,
      fontFamily: "var(--mono)"
    }
  }, c.title), c.description && React.createElement("div", {
    style: {
      fontSize: 13,
      color: "rgba(200,220,240,.5)",
      lineHeight: 1.75
    }
  }, c.description)))), React.createElement("div", {
    style: {
      marginTop: 20,
      padding: "12px 16px",
      background: "rgba(255,23,68,.04)",
      border: "1px solid rgba(255,23,68,.1)",
      borderRadius: 6,
      fontSize: 12,
      color: "rgba(200,220,240,.35)",
      lineHeight: 1.75
    }
  }, "\uD83D\uDD75\uFE0F Sources: ", React.createElement("strong", {
    style: {
      color: "rgba(200,220,240,.5)"
    }
  }, "ransomware.live"), " (public API) \xB7 ", React.createElement("strong", {
    style: {
      color: "rgba(200,220,240,.5)"
    }
  }, "HaveIBeenPwned"), " (public breach list \u2014 no personal lookups) \xB7 ", React.createElement("strong", {
    style: {
      color: "rgba(200,220,240,.5)"
    }
  }, "Cybercrime Tracker"), " (C2 RSS) \xB7 Cache: 2 hours \xB7 For awareness and defence only.", data?.fetched_at_human && React.createElement("span", {
    style: {
      marginLeft: 8
    }
  }, "\xB7 ", data.fetched_at_human)));
}
const CHAT_SUGGESTIONS = ["Summarise today's critical threats", "What is being exploited in the wild right now?", "Which advisories matter for GCC / Middle East?", "Explain prompt injection and how to defend against it", "What should a CISO patch first this week?"];
function renderMd(text) {
  const inline = (s, k) => s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => p.startsWith("**") ? React.createElement("strong", {
    key: k + "-" + i,
    style: {
      color: "#eef4ff"
    }
  }, p.slice(2, -2)) : p.startsWith("`") ? React.createElement("code", {
    key: k + "-" + i,
    style: {
      fontFamily: "var(--mono)",
      background: "rgba(0,200,255,.08)",
      padding: "1px 5px",
      borderRadius: 3,
      color: ACCENT
    }
  }, p.slice(1, -1)) : p);
  return text.split("\n").map((line, i) => {
    const t = line.trim();
    if (!t) return React.createElement("div", {
      key: i,
      style: {
        height: 6
      }
    });
    if (/^#{1,4}\s/.test(t)) return React.createElement("div", {
      key: i,
      style: {
        fontWeight: 800,
        color: ACCENT,
        marginTop: 8,
        marginBottom: 3,
        fontSize: 13,
        letterSpacing: .5
      }
    }, inline(t.replace(/^#+\s/, ""), i));
    if (/^(?:[-*•]|\d+[.)])\s/.test(t)) return React.createElement("div", {
      key: i,
      style: {
        display: "flex",
        gap: 8,
        paddingLeft: 4,
        marginBottom: 3
      }
    }, React.createElement("span", {
      style: {
        color: ACCENT2,
        flexShrink: 0
      }
    }, "\u25B8"), React.createElement("span", null, inline(t.replace(/^(?:[-*•]|\d+[.)])\s/, ""), i)));
    return React.createElement("div", {
      key: i,
      style: {
        marginBottom: 4
      }
    }, inline(t, i));
  });
}
function ThreatAnalystChat({
  externalPrompt,
  onConsumedPrompt
}) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([{
    role: "assistant",
    content: "👋 I'm the **BCyberAware Threat Analyst** — an AI grounded in the live feed on this dashboard.\n\nAsk me about today's advisories, active exploits, threat actors, or click **🛡️ AI Triage** on any advisory card."
  }]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [unread, setUnread] = useState(false);
  const endRef = React.useRef(null);
  const abortRef = React.useRef(null);
  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  }, [msgs, open]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (!open) setUnread(true);
    }, 6000);
    return () => clearTimeout(t);
  }, []);
  const send = async text => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput("");
    const history = [...msgs.filter((m, i) => i > 0), {
      role: "user",
      content: q
    }];
    setMsgs(m => [...m, {
      role: "user",
      content: q
    }, {
      role: "assistant",
      content: "",
      streaming: true
    }]);
    setBusy(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: history.slice(-8)
        }),
        signal: ctrl.signal
      });
      if (!r.ok) {
        let e = "Assistant unavailable";
        try {
          e = (await r.json()).error || e;
        } catch {}
        throw new Error(e);
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "",
        acc = "";
      while (true) {
        const {
          done,
          value
        } = await reader.read();
        if (done) break;
        buf += dec.decode(value, {
          stream: true
        });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const ln of lines) {
          const s = ln.trim();
          if (!s.startsWith("data:")) continue;
          const payload = s.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const j = JSON.parse(payload);
            if (j.response) {
              acc += j.response;
              setMsgs(m => {
                const c = [...m];
                c[c.length - 1] = {
                  role: "assistant",
                  content: acc,
                  streaming: true
                };
                return c;
              });
            }
          } catch {}
        }
      }
      setMsgs(m => {
        const c = [...m];
        c[c.length - 1] = {
          role: "assistant",
          content: acc || "_(no response)_"
        };
        return c;
      });
    } catch (e) {
      if (e.name !== "AbortError") setMsgs(m => {
        const c = [...m];
        c[c.length - 1] = {
          role: "assistant",
          content: "⚠ " + e.message,
          error: true
        };
        return c;
      });
    }
    setBusy(false);
  };
  const stop = () => {
    abortRef.current?.abort();
    setBusy(false);
  };
  useEffect(() => {
    if (externalPrompt) {
      setOpen(true);
      setUnread(false);
      send(externalPrompt);
      onConsumedPrompt?.();
    }
  }, [externalPrompt]);
  return React.createElement(React.Fragment, null, !open && React.createElement("button", {
    onClick: () => {
      setOpen(true);
      setUnread(false);
    },
    "aria-label": "Open AI Threat Analyst",
    style: {
      position: "fixed",
      right: 20,
      bottom: 20,
      zIndex: 90,
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "12px 18px",
      borderRadius: 30,
      border: `1px solid rgba(0,200,255,.45)`,
      background: "linear-gradient(135deg,rgba(0,40,70,.95),rgba(40,10,80,.95))",
      color: "#eef4ff",
      cursor: "pointer",
      boxShadow: "0 8px 32px rgba(0,200,255,.25)",
      fontFamily: "var(--mono)",
      fontWeight: 700,
      fontSize: 13,
      letterSpacing: .5,
      backdropFilter: "blur(8px)"
    }
  }, React.createElement("span", {
    style: {
      fontSize: 18
    }
  }, "\uD83D\uDEE1\uFE0F"), " Ask Threat Analyst", unread && React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: "50%",
      background: "#00e676",
      boxShadow: "0 0 8px #00e676",
      animation: "pulse 1.4s infinite"
    }
  })), open && React.createElement("div", {
    className: "chat-panel",
    role: "dialog",
    "aria-label": "AI Threat Analyst",
    style: {
      position: "fixed",
      right: 20,
      bottom: 20,
      zIndex: 90,
      width: 400,
      maxWidth: "calc(100vw - 24px)",
      height: 600,
      maxHeight: "calc(100vh - 40px)",
      display: "flex",
      flexDirection: "column",
      background: "rgba(6,10,20,.97)",
      border: "1px solid rgba(0,200,255,.3)",
      borderRadius: 14,
      boxShadow: "0 16px 60px rgba(0,0,0,.6), 0 0 30px rgba(0,200,255,.12)",
      overflow: "hidden",
      animation: "fadeIn .25s ease",
      backdropFilter: "blur(12px)"
    }
  }, React.createElement("div", {
    className: "chat-header",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "12px 14px",
      background: "linear-gradient(90deg,rgba(0,200,255,.12),rgba(123,47,247,.14))",
      borderBottom: "1px solid rgba(0,200,255,.18)"
    }
  }, React.createElement("span", {
    style: {
      fontSize: 22
    }
  }, "\uD83D\uDEE1\uFE0F"), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    className: "chat-title",
    style: {
      fontSize: 13,
      fontWeight: 800,
      color: "#eef4ff",
      letterSpacing: .5
    }
  }, "Threat Analyst ", React.createElement("span", {
    style: {
      fontSize: 9,
      padding: "2px 6px",
      marginLeft: 4,
      borderRadius: 3,
      background: "rgba(0,230,118,.12)",
      border: "1px solid rgba(0,230,118,.4)",
      color: "#00e676",
      fontFamily: "var(--mono)",
      letterSpacing: 1,
      verticalAlign: "middle"
    }
  }, "AI")), React.createElement("div", {
    className: "chat-subtitle",
    style: {
      fontSize: 10,
      color: "rgba(200,220,240,.45)",
      fontFamily: "var(--mono)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, "Grounded in live feed \xB7 Cloudflare Workers AI")), React.createElement("button", {
    onClick: () => setMsgs(msgs.slice(0, 1)),
    title: "Clear conversation",
    "aria-label": "Clear conversation",
    style: {
      background: "transparent",
      border: "1px solid rgba(255,255,255,.1)",
      color: "rgba(200,220,240,.5)",
      borderRadius: 6,
      padding: "4px 8px",
      cursor: "pointer",
      fontSize: 12
    }
  }, "\u21BA"), React.createElement("button", {
    onClick: () => setOpen(false),
    "aria-label": "Close",
    style: {
      background: "transparent",
      border: "1px solid rgba(255,255,255,.1)",
      color: "rgba(200,220,240,.6)",
      borderRadius: 6,
      padding: "4px 9px",
      cursor: "pointer",
      fontSize: 14,
      lineHeight: 1
    }
  }, "\u2715")), React.createElement("div", {
    style: {
      flex: 1,
      overflowY: "auto",
      padding: "14px 14px 6px",
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, msgs.map((m, i) => React.createElement("div", {
    key: i,
    style: {
      alignSelf: m.role === "user" ? "flex-end" : "flex-start",
      maxWidth: "88%"
    }
  }, React.createElement("div", {
    className: m.role === "user" ? "chat-msg-user" : "chat-msg-bot",
    style: {
      fontSize: 13.5,
      lineHeight: 1.6,
      padding: "10px 13px",
      borderRadius: m.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
      background: m.role === "user" ? "linear-gradient(135deg,rgba(0,200,255,.18),rgba(0,200,255,.08))" : m.error ? "rgba(200,0,0,.12)" : "rgba(255,255,255,.04)",
      border: `1px solid ${m.role === "user" ? "rgba(0,200,255,.35)" : m.error ? "rgba(200,0,0,.35)" : "rgba(255,255,255,.08)"}`,
      color: m.error ? "#ff8a80" : "rgba(220,232,245,.92)",
      wordBreak: "break-word"
    }
  }, m.role === "assistant" ? renderMd(m.content) : m.content, m.streaming && React.createElement("span", {
    style: {
      display: "inline-block",
      width: 7,
      height: 14,
      background: ACCENT,
      marginLeft: 3,
      verticalAlign: "text-bottom",
      animation: "pulse .8s infinite"
    }
  })))), msgs.length === 1 && React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      marginTop: 4
    }
  }, React.createElement("div", {
    style: {
      fontSize: 10,
      letterSpacing: 2,
      color: "rgba(200,220,240,.3)",
      fontFamily: "var(--mono)"
    }
  }, "TRY ASKING"), CHAT_SUGGESTIONS.map(s => React.createElement("button", {
    key: s,
    onClick: () => send(s),
    className: "chat-suggestion",
    style: {
      textAlign: "left",
      padding: "8px 12px",
      fontSize: 12.5,
      background: "rgba(123,47,247,.08)",
      border: "1px solid rgba(123,47,247,.25)",
      color: "#d1c4e9",
      borderRadius: 8,
      cursor: "pointer"
    }
  }, "\u203A ", s))), React.createElement("div", {
    ref: endRef
  })), React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      send();
    },
    className: "chat-composer",
    style: {
      display: "flex",
      gap: 8,
      padding: "10px 12px",
      borderTop: "1px solid rgba(255,255,255,.07)",
      background: "rgba(0,0,0,.3)"
    }
  }, React.createElement("input", {
    value: input,
    onChange: e => setInput(e.target.value),
    placeholder: "Ask about a CVE, threat actor, or today's feed\u2026",
    maxLength: 1200,
    disabled: busy,
    "aria-label": "Message",
    style: {
      flex: 1,
      padding: "10px 12px",
      background: "rgba(255,255,255,.04)",
      border: "1px solid rgba(0,200,255,.2)",
      borderRadius: 8,
      color: "#eef4ff",
      fontSize: 13.5,
      outline: "none",
      fontFamily: "inherit"
    }
  }), busy ? React.createElement("button", {
    type: "button",
    onClick: stop,
    style: {
      padding: "0 14px",
      background: "rgba(200,0,0,.15)",
      border: "1px solid rgba(200,0,0,.4)",
      color: "#ff6666",
      borderRadius: 8,
      cursor: "pointer",
      fontFamily: "var(--mono)",
      fontWeight: 700,
      fontSize: 12
    }
  }, "\u25A0") : React.createElement("button", {
    type: "submit",
    disabled: !input.trim(),
    style: {
      padding: "0 16px",
      background: input.trim() ? "linear-gradient(135deg,#00c8ff,#7b2ff7)" : "rgba(255,255,255,.05)",
      border: "none",
      color: input.trim() ? "#fff" : "rgba(255,255,255,.25)",
      borderRadius: 8,
      cursor: input.trim() ? "pointer" : "not-allowed",
      fontWeight: 800,
      fontSize: 14
    }
  }, "\u27A4")), React.createElement("div", {
    style: {
      padding: "5px 12px 8px",
      fontSize: 10,
      color: "rgba(200,220,240,.28)",
      textAlign: "center",
      fontFamily: "var(--mono)"
    }
  }, "AI can make mistakes \u2014 verify against the linked sources.")));
}
const KNOWN_ENTITIES = [{
  name: "LockBit",
  kind: "ransomware",
  color: "#ff1744",
  re: /\blockbit\b/i
}, {
  name: "Qilin",
  kind: "ransomware",
  color: "#ff5252",
  re: /\bqilin\b/i
}, {
  name: "Akira",
  kind: "ransomware",
  color: "#ff6e40",
  re: /\bakira\b/i
}, {
  name: "Cl0p",
  kind: "ransomware",
  color: "#ff1744",
  re: /\bcl0p\b|\bclop\b/i
}, {
  name: "Black Basta",
  kind: "ransomware",
  color: "#e53935",
  re: /black\s*basta/i
}, {
  name: "RansomHub",
  kind: "ransomware",
  color: "#d32f2f",
  re: /ransomhub/i
}, {
  name: "Play",
  kind: "ransomware",
  color: "#c62828",
  re: /play ransomware|\bplay\b.*ransom/i
}, {
  name: "Scattered Spider",
  kind: "intrusion-set",
  color: "#ab47bc",
  re: /scattered spider|unc3944|octo tempest/i
}, {
  name: "Lazarus",
  kind: "intrusion-set",
  color: "#8e24aa",
  re: /\blazarus\b|hidden cobra|apt38/i
}, {
  name: "APT29",
  kind: "intrusion-set",
  color: "#7b1fa2",
  re: /\bapt29\b|cozy bear|midnight blizzard/i
}, {
  name: "APT28",
  kind: "intrusion-set",
  color: "#6a1b9a",
  re: /\bapt28\b|fancy bear|forest blizzard/i
}, {
  name: "Volt Typhoon",
  kind: "intrusion-set",
  color: "#9c27b0",
  re: /volt typhoon/i
}, {
  name: "Salt Typhoon",
  kind: "intrusion-set",
  color: "#8e24aa",
  re: /salt typhoon/i
}, {
  name: "Kimsuky",
  kind: "intrusion-set",
  color: "#7e57c2",
  re: /\bkimsuky\b/i
}, {
  name: "Lumma Stealer",
  kind: "malware",
  color: "#26c6da",
  re: /\blumma\b/i
}, {
  name: "RedLine",
  kind: "malware",
  color: "#00acc1",
  re: /\bredline\b/i
}, {
  name: "Cobalt Strike",
  kind: "tool",
  color: "#29b6f6",
  re: /cobalt strike/i
}, {
  name: "Ivanti",
  kind: "vendor",
  color: "#ff9100",
  re: /\bivanti\b|connect secure/i
}, {
  name: "Fortinet",
  kind: "vendor",
  color: "#ee3124",
  re: /fortinet|fortigate|fortios/i
}, {
  name: "Cisco",
  kind: "vendor",
  color: "#049fd9",
  re: /\bcisco\b|ios xe|\basa\b/i
}, {
  name: "Microsoft",
  kind: "vendor",
  color: "#0078d4",
  re: /microsoft|windows|exchange|sharepoint|azure/i
}, {
  name: "Palo Alto",
  kind: "vendor",
  color: "#fa582d",
  re: /palo alto|pan-os|globalprotect/i
}, {
  name: "VMware",
  kind: "vendor",
  color: "#607d8b",
  re: /vmware|esxi|vcenter/i
}];
const KNOWLEDGE_VENDORS = [["Microsoft", /microsoft|windows|exchange|sharepoint|azure|defender|office 365/i], ["Cisco", /\bcisco\b|ios xe|asa|anyconnect/i], ["Fortinet", /fortinet|fortigate|fortios|fortiguard/i], ["Ivanti", /\bivanti\b|connect secure/i], ["Palo Alto", /palo alto|pan-os|globalprotect/i], ["Linux", /\blinux\b|kernel|ubuntu|debian/i], ["WordPress", /wordpress|wp-content/i], ["VMware", /vmware|esxi|vcenter/i], ["Apple", /\bapple\b|\bios\b|macos|webkit/i], ["GitLab", /gitlab|github/i]];
function itemText(a) {
  return `${a.title || ""} ${a.summary || ""} ${(a.affected_products || []).join(" ")} ${a.threat_actor || ""}`;
}
function extractIOCs(text) {
  const ips = [...new Set(String(text).match(/\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g) || [])].filter(ip => !/^(0|127|255)\./.test(ip) && !/^10\./.test(ip) && !/^192\.168\./.test(ip)).slice(0, 10);
  const hashes = [...new Set(String(text).match(/\b[a-fA-F0-9]{64}\b|\b[a-fA-F0-9]{40}\b/g) || [])].slice(0, 8);
  const domains = [...new Set(String(text).match(/\b(?:[a-z0-9-]+\.)+(?:ru|cn|onion|xyz|top|cc)\b/gi) || [])].filter(d => !/w3\.org|example\./i.test(d)).slice(0, 8);
  return {
    ips,
    hashes,
    domains
  };
}
function buildKnowledgeIndex(items) {
  const techniques = ALL_MITRE_TECHNIQUES.map(t => {
    const hits = items.filter(a => t.re.test(itemText(a)));
    return {
      ...t,
      count: hits.length,
      items: hits.slice(0, 8)
    };
  }).filter(t => t.count > 0);
  const entities = KNOWN_ENTITIES.map(e => {
    const hits = items.filter(a => e.re.test(itemText(a)) || a.threat_actor && e.re.test(a.threat_actor));
    return {
      ...e,
      count: hits.length,
      items: hits.slice(0, 8)
    };
  }).filter(e => e.count > 0);
  items.forEach(a => {
    if (a.threat_actor && !entities.some(e => e.name.toLowerCase() === a.threat_actor.toLowerCase())) {
      const hits = items.filter(x => x.threat_actor === a.threat_actor);
      entities.push({
        name: a.threat_actor,
        kind: "intrusion-set",
        color: "#c084fc",
        count: hits.length,
        items: hits.slice(0, 8)
      });
    }
  });
  const vendors = KNOWLEDGE_VENDORS.map(([name, re]) => {
    const hits = items.filter(a => re.test(itemText(a)));
    return {
      name,
      count: hits.length,
      items: hits.slice(0, 8),
      color: "#00c8ff"
    };
  }).filter(v => v.count > 0).sort((a, b) => b.count - a.count);
  const cves = [];
  const seen = new Set();
  items.forEach(a => (a.cve_ids || []).forEach(c => {
    if (seen.has(c)) return;
    seen.add(c);
    const hits = items.filter(x => (x.cve_ids || []).includes(c));
    cves.push({
      name: c,
      count: hits.length,
      items: hits.slice(0, 6),
      epss: Math.max(0, ...hits.map(h => h.epss || 0))
    });
  }));
  cves.sort((a, b) => b.epss - a.epss || b.count - a.count);
  const iocs = {
    ips: [],
    hashes: [],
    domains: []
  };
  items.forEach(a => {
    const found = extractIOCs(itemText(a));
    found.ips.forEach(v => {
      if (!iocs.ips.includes(v)) iocs.ips.push(v);
    });
    found.hashes.forEach(v => {
      if (!iocs.hashes.includes(v)) iocs.hashes.push(v);
    });
    found.domains.forEach(v => {
      if (!iocs.domains.includes(v)) iocs.domains.push(v);
    });
  });
  return {
    techniques,
    entities,
    vendors,
    cves: cves.slice(0, 20),
    iocs
  };
}
function KnowledgeView({
  advisories,
  exploits,
  news,
  focus,
  onClearFocus,
  onAskAI
}) {
  const [tab, setTab] = useState(focus?.type === "entity" ? "encyclopedia" : focus?.type === "ioc" ? "hunt" : "matrix");
  const [selected, setSelected] = useState(focus || null);
  const [dw, setDw] = useState(null);
  useEffect(() => {
    fetch("/api/darkweb", {
      cache: "no-store"
    }).then(r => r.json()).then(setDw).catch(() => setDw(null));
  }, []);
  useEffect(() => {
    if (focus) {
      setSelected(focus);
      setTab(focus.type === "entity" ? "encyclopedia" : focus.type === "ioc" ? "hunt" : "matrix");
    }
  }, [focus]);
  const items = [...advisories, ...exploits, ...news];
  const idx = buildKnowledgeIndex(items);
  const groups = dw?.ransomware_groups || [];
  const victims = dw?.ransomware_victims || [];
  const c2s = dw?.c2_servers || [];
  const selectedItems = (() => {
    if (!selected) return [];
    if (selected.type === "technique") return idx.techniques.find(t => t.id === selected.id)?.items || items.filter(a => ALL_MITRE_TECHNIQUES.find(t => t.id === selected.id)?.re.test(itemText(a)));
    if (selected.type === "entity") return idx.entities.find(e => e.name === selected.id)?.items || items.filter(a => itemText(a).toLowerCase().includes(String(selected.id).toLowerCase()));
    if (selected.type === "vendor") return idx.vendors.find(v => v.name === selected.id)?.items || [];
    if (selected.type === "cve") return items.filter(a => (a.cve_ids || []).includes(selected.id));
    return [];
  })();
  const diamond = {
    adversary: idx.entities.filter(e => e.kind === "ransomware" || e.kind === "intrusion-set").length + groups.filter(g => (g.status || "").includes("activ")).length,
    infra: idx.vendors.length + c2s.length,
    victim: victims.length + items.filter(a => a.middle_east_relevance === "HIGH").length,
    capability: idx.techniques.length + idx.entities.filter(e => e.kind === "malware" || e.kind === "tool").length
  };
  const copy = text => {
    try {
      navigator.clipboard.writeText(text);
    } catch {}
  };
  return React.createElement("div", {
    style: {
      animation: "fadeIn .3s ease"
    }
  }, React.createElement("div", {
    style: {
      textAlign: "center",
      marginBottom: 18
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      letterSpacing: 4,
      color: ACCENT2,
      marginBottom: 8,
      fontFamily: "var(--mono)"
    }
  }, "\uD83E\uDDEC THREAT KNOWLEDGE GRAPH"), React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 900,
      color: "#ddeeff",
      marginBottom: 6
    }
  }, "ATT&CK \xB7 Entities \xB7 Relationships \xB7 Hunt"), React.createElement("div", {
    style: {
      fontSize: 13,
      color: "rgba(200,220,240,.4)"
    }
  }, "OpenCTI ideas, native on this dashboard \u2014 STIX 2.1 export, no OpenCTI server")), React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
      gap: 10,
      marginBottom: 16
    }
  }, [{
    q: "ADVERSARY",
    v: diamond.adversary,
    c: "#c084fc",
    s: "Actors & ransomware groups"
  }, {
    q: "INFRASTRUCTURE",
    v: diamond.infra,
    c: "#29b6f6",
    s: "Vendors + C2 servers"
  }, {
    q: "VICTIMOLOGY",
    v: diamond.victim,
    c: "#00e676",
    s: "Leak victims + GCC risk"
  }, {
    q: "CAPABILITY",
    v: diamond.capability,
    c: "#ff9100",
    s: "TTPs, malware & tools"
  }].map(d => React.createElement("div", {
    key: d.q,
    style: {
      background: `${d.c}10`,
      border: `1px solid ${d.c}44`,
      borderRadius: 8,
      padding: "14px 16px"
    }
  }, React.createElement("div", {
    style: {
      fontSize: 10,
      letterSpacing: 2,
      color: d.c,
      fontFamily: "var(--mono)",
      marginBottom: 6
    }
  }, d.q), React.createElement("div", {
    style: {
      fontSize: 28,
      fontWeight: 900,
      color: d.c,
      fontFamily: "var(--mono)",
      lineHeight: 1
    }
  }, d.v), React.createElement("div", {
    style: {
      fontSize: 11,
      color: "rgba(200,220,240,.4)",
      marginTop: 4
    }
  }, d.s)))), React.createElement("div", {
    style: {
      display: "flex",
      gap: 4,
      marginBottom: 16,
      borderBottom: "1px solid rgba(255,255,255,.07)",
      overflowX: "auto"
    }
  }, [["matrix", "⚔️ ATT&CK Matrix"], ["graph", "🕸 Relationship Graph"], ["encyclopedia", "📚 Encyclopedia"], ["hunt", "🎯 IOC Hunt"]].map(([id, lbl]) => React.createElement("button", {
    key: id,
    onClick: () => setTab(id),
    style: {
      padding: "10px 16px",
      background: "transparent",
      border: "none",
      borderBottom: tab === id ? `3px solid ${ACCENT2}` : "3px solid transparent",
      color: tab === id ? ACCENT2 : "rgba(200,220,240,.45)",
      fontSize: 13,
      cursor: "pointer",
      fontFamily: "var(--mono)",
      fontWeight: tab === id ? 700 : 400,
      whiteSpace: "nowrap"
    }
  }, lbl))), tab === "matrix" && React.createElement("div", null, React.createElement("div", {
    style: {
      overflowX: "auto",
      marginBottom: 16
    }
  }, React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: `repeat(${MITRE_MATRIX.length},minmax(110px,1fr))`,
      gap: 6,
      minWidth: 980
    }
  }, MITRE_MATRIX.map(col => {
    const max = Math.max(1, ...col.techniques.map(t => idx.techniques.find(x => x.id === t.id)?.count || 0));
    return React.createElement("div", {
      key: col.code
    }, React.createElement("div", {
      style: {
        fontSize: 10,
        fontWeight: 800,
        color: ACCENT,
        fontFamily: "var(--mono)",
        letterSpacing: .4,
        marginBottom: 6,
        minHeight: 32
      }
    }, col.tactic, React.createElement("div", {
      style: {
        color: "rgba(200,220,240,.35)",
        fontWeight: 500
      }
    }, col.code)), col.techniques.map(t => {
      const hit = idx.techniques.find(x => x.id === t.id);
      const n = hit?.count || 0;
      const hot = selected?.type === "technique" && selected.id === t.id;
      const alpha = n ? .12 + .55 * (n / max) : 0.03;
      return React.createElement("button", {
        key: t.id,
        onClick: () => setSelected(hot ? null : {
          type: "technique",
          id: t.id
        }),
        style: {
          display: "block",
          width: "100%",
          textAlign: "left",
          marginBottom: 5,
          padding: "8px 8px",
          borderRadius: 5,
          cursor: "pointer",
          background: n ? `${t.color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}` : "rgba(255,255,255,.03)",
          border: `1px solid ${hot ? t.color : n ? t.color + "66" : "rgba(255,255,255,.06)"}`,
          boxShadow: hot ? `0 0 10px ${t.color}55` : "none"
        }
      }, React.createElement("div", {
        style: {
          fontSize: 10,
          fontWeight: 800,
          color: n ? t.color : "rgba(200,220,240,.3)",
          fontFamily: "var(--mono)"
        }
      }, t.id, n ? ` · ${n}` : ""), React.createElement("div", {
        style: {
          fontSize: 10,
          color: n ? "rgba(230,238,250,.8)" : "rgba(200,220,240,.28)",
          lineHeight: 1.35
        }
      }, t.name));
    }));
  }))), React.createElement("div", {
    style: {
      fontSize: 12,
      color: "rgba(200,220,240,.4)",
      marginBottom: 10,
      fontFamily: "var(--mono)"
    }
  }, "Click a technique cell to list live items mapped to it. Heat = current feed volume.")), tab === "graph" && React.createElement("div", {
    style: {
      background: "rgba(5,8,15,.95)",
      border: "1px solid rgba(123,47,247,.25)",
      borderRadius: 8,
      padding: "16px 12px",
      overflowX: "auto",
      marginBottom: 16
    }
  }, React.createElement("svg", {
    viewBox: "0 0 920 340",
    style: {
      width: "100%",
      minWidth: 720
    },
    xmlns: "http://www.w3.org/2000/svg"
  }, React.createElement("rect", {
    width: "920",
    height: "340",
    fill: "#060c18",
    rx: "6"
  }), ["VENDORS", "CVEs", "ATT&CK", "ACTORS"].map((lbl, i) => React.createElement("text", {
    key: lbl,
    x: 80 + i * 230,
    y: "22",
    fill: "rgba(200,220,240,.4)",
    fontSize: "10",
    fontFamily: "monospace",
    letterSpacing: "2"
  }, lbl)), (() => {
    const vendors = idx.vendors.slice(0, 6);
    const cves = idx.cves.slice(0, 7);
    const techs = idx.techniques.slice(0, 7);
    const actors = idx.entities.filter(e => e.kind !== "vendor").slice(0, 6);
    const node = (list, x, color) => list.map((n, i) => ({
      ...n,
      x,
      y: 50 + i * 42,
      color: n.color || color
    }));
    const V = node(vendors, 80, "#00c8ff");
    const C = node(cves, 310, "#ff6e6e");
    const T = node(techs, 540, "#ffab40");
    const A = node(actors, 770, "#c084fc");
    const edges = [];
    V.forEach(v => C.forEach(c => {
      if (c.items.some(it => v.items.includes(it) || itemText(it).toLowerCase().includes(v.name.toLowerCase()))) edges.push([v, c, "#00c8ff33"]);
    }));
    C.forEach(c => T.forEach(t => {
      if (c.items.some(it => t.re?.test(itemText(it)))) edges.push([c, t, "#ffab4033"]);
    }));
    A.forEach(a => C.forEach(c => {
      if (c.items.some(it => a.re?.test(itemText(it)) || itemText(it).toLowerCase().includes(a.name.toLowerCase()))) edges.push([a, c, "#c084fc33"]);
    }));
    return React.createElement("g", null, edges.slice(0, 40).map((e, i) => React.createElement("line", {
      key: i,
      x1: e[0].x + 70,
      y1: e[0].y + 8,
      x2: e[1].x,
      y2: e[1].y + 8,
      stroke: e[2],
      strokeWidth: "1"
    })), [...V, ...C, ...T, ...A].map((n, i) => React.createElement("g", {
      key: i,
      style: {
        cursor: "pointer"
      },
      onClick: () => setSelected({
        type: n.id ? "technique" : n.name?.startsWith("CVE") ? "cve" : KNOWN_ENTITIES.some(k => k.name === n.name) ? "entity" : "vendor",
        id: n.id || n.name
      })
    }, React.createElement("rect", {
      x: n.x - 8,
      y: n.y - 10,
      width: 150,
      height: 28,
      rx: "4",
      fill: `${n.color}18`,
      stroke: `${n.color}66`
    }), React.createElement("text", {
      x: n.x,
      y: n.y + 8,
      fill: n.color,
      fontSize: "10",
      fontFamily: "monospace",
      fontWeight: "700"
    }, (n.id || n.name || "").slice(0, 18), n.count ? ` (${n.count})` : ""))));
  })()), React.createElement("div", {
    style: {
      fontSize: 12,
      color: "rgba(200,220,240,.4)",
      marginTop: 8,
      fontFamily: "var(--mono)"
    }
  }, "Edges = co-occurrence in the live feed (vendor \u2194 CVE \u2194 technique \u2194 actor). Click a node to inspect.")), tab === "encyclopedia" && React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: 2,
      color: "rgba(192,132,252,.75)",
      fontFamily: "var(--mono)",
      marginBottom: 10
    }
  }, "LIVE ENTITIES IN THIS FEED"), React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))",
      gap: 10,
      marginBottom: 18
    }
  }, idx.entities.slice(0, 16).map(e => React.createElement("button", {
    key: e.name,
    onClick: () => setSelected({
      type: "entity",
      id: e.name
    }),
    style: {
      textAlign: "left",
      background: "rgba(5,8,15,.92)",
      border: `1px solid ${selected?.id === e.name ? e.color : e.color + "33"}`,
      borderLeft: `4px solid ${e.color}`,
      borderRadius: 6,
      padding: "14px 16px",
      cursor: "pointer"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6
    }
  }, React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 800,
      color: "#eef4ff"
    }
  }, e.name), React.createElement("span", {
    style: {
      fontSize: 10,
      fontFamily: "var(--mono)",
      color: e.color,
      border: `1px solid ${e.color}55`,
      padding: "2px 7px",
      borderRadius: 3
    }
  }, e.kind)), React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 900,
      color: e.color,
      fontFamily: "var(--mono)",
      lineHeight: 1
    }
  }, e.count), React.createElement("div", {
    style: {
      fontSize: 11,
      color: "rgba(200,220,240,.4)"
    }
  }, "linked live items"))), idx.entities.length === 0 && React.createElement("div", {
    style: {
      color: "rgba(200,220,240,.35)",
      padding: "20px"
    }
  }, "No named actors in the current snapshot \u2014 ransomware groups from Dark Web still appear below.")), groups.length > 0 && React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: 2,
      color: "rgba(255,23,68,.7)",
      fontFamily: "var(--mono)",
      marginBottom: 10
    }
  }, "RANSOMWARE GROUPS (ransomware.live)"), React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))",
      gap: 8,
      marginBottom: 16
    }
  }, groups.filter(g => (g.status || "").includes("activ")).slice(0, 12).map(g => React.createElement("div", {
    key: g.name,
    style: {
      background: "rgba(5,8,15,.92)",
      border: "1px solid rgba(255,23,68,.2)",
      borderLeft: "4px solid #c00000",
      borderRadius: 6,
      padding: "12px 14px"
    }
  }, React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: "#eef4ff"
    }
  }, g.name), React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#ff6666",
      fontFamily: "var(--mono)",
      marginTop: 4
    }
  }, "\u25CF ACTIVE", g.victim_count ? ` · ${g.victim_count} victims` : ""), g.description && React.createElement("div", {
    style: {
      fontSize: 11,
      color: "rgba(200,220,240,.4)",
      marginTop: 6,
      lineHeight: 1.5
    }
  }, g.description.slice(0, 120))))))), tab === "hunt" && React.createElement("div", null, React.createElement("div", {
    style: {
      padding: "12px 16px",
      background: "rgba(255,145,0,.06)",
      border: "1px solid rgba(255,145,0,.25)",
      borderRadius: 6,
      marginBottom: 14,
      fontSize: 12.5,
      color: "rgba(200,220,240,.55)",
      lineHeight: 1.7
    }
  }, "\uD83C\uDFAF Observables extracted from the live feed plus Feodo Tracker C2 servers. For defensive hunting only \u2014 verify before blocking."), [["IPv4", idx.iocs.ips, "#29b6f6"], ["Hashes", idx.iocs.hashes, "#ffab40"], ["Suspicious domains", idx.iocs.domains, "#c084fc"]].map(([lbl, list, col]) => React.createElement("div", {
    key: lbl,
    style: {
      marginBottom: 14
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: 2,
      color: col,
      fontFamily: "var(--mono)",
      marginBottom: 8
    }
  }, lbl.toUpperCase(), " (", list.length, ")"), React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6
    }
  }, list.length === 0 && React.createElement("span", {
    style: {
      fontSize: 12,
      color: "rgba(200,220,240,.3)"
    }
  }, "None extracted this cycle."), list.map(v => React.createElement("button", {
    key: v,
    onClick: () => copy(v),
    title: "Copy",
    style: {
      fontSize: 11,
      fontFamily: "var(--mono)",
      padding: "5px 10px",
      background: `${col}14`,
      border: `1px solid ${col}44`,
      color: col,
      borderRadius: 4,
      cursor: "pointer"
    }
  }, v, " \u29C9"))))), c2s.length > 0 && React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: 2,
      color: "#ff9944",
      fontFamily: "var(--mono)",
      margin: "16px 0 8px"
    }
  }, "ACTIVE BOTNET C2 (abuse.ch Feodo / Cybercrime Tracker)"), c2s.slice(0, 8).map((c, i) => React.createElement("div", {
    key: i,
    style: {
      background: "rgba(5,8,15,.92)",
      border: "1px solid rgba(255,109,0,.25)",
      borderLeft: "4px solid #e65100",
      borderRadius: 6,
      padding: "10px 14px",
      marginBottom: 8,
      fontFamily: "var(--mono)",
      fontSize: 12,
      color: "#eef4ff"
    }
  }, c.title, c.url && React.createElement("a", {
    href: c.url,
    target: "_blank",
    rel: "noopener noreferrer",
    style: {
      marginLeft: 10,
      color: ACCENT
    }
  }, "inspect \u2197"))))), selected && selectedItems.length > 0 && React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12,
      letterSpacing: 1.5,
      color: ACCENT,
      fontFamily: "var(--mono)"
    }
  }, "LINKED LIVE ITEMS \xB7 ", selected.type, " \xB7 ", selected.id, " (", selectedItems.length, ")"), React.createElement("button", {
    onClick: () => {
      setSelected(null);
      onClearFocus && onClearFocus();
    },
    style: {
      fontSize: 11,
      fontFamily: "var(--mono)",
      padding: "4px 10px",
      background: "transparent",
      border: "1px solid rgba(255,255,255,.15)",
      color: "rgba(200,220,240,.5)",
      borderRadius: 4,
      cursor: "pointer"
    }
  }, "\u2715 Clear")), selectedItems.map(a => React.createElement(AdvisoryCard, {
    key: a.id,
    adv: a,
    onAskAI: onAskAI
  }))));
}
function BCyberAwareDashboard() {
  const [advisories, setAdvisories] = useState([]);
  const [exploits, setExploits] = useState([]);
  const [news, setNews] = useState([]);
  const [breaking, setBreaking] = useState([]);
  const [social, setSocial] = useState([]);
  const [brief, setBrief] = useState(null);
  const [heatmap, setHeatmap] = useState([]);
  const [feedMeta, setFeedMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [feedError, setFeedError] = useState(null);
  const [filterSev, setFilterSev] = useState("All");
  const [filterME, setFilterME] = useState(false);
  const [filterExp, setFilterExp] = useState(false);
  const [filterEpss, setFilterEpss] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [watchlist, setWatchlist] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("bca_watchlist") || "[]");
    } catch {
      return [];
    }
  });
  const [aiPrompt, setAiPrompt] = useState(null);
  const [knowFocus, setKnowFocus] = useState(null);
  const [view, setView] = useState("feed");
  const [feedTab, setFeedTab] = useState("advisories");
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("bca_theme") || (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    } catch {
      return "dark";
    }
  });
  const searchInputRef = React.useRef(null);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (theme === "light") {
      document.body.classList.add("light-theme");
      document.documentElement.classList.add("light-theme");
    } else {
      document.body.classList.remove("light-theme");
      document.documentElement.classList.remove("light-theme");
    }
    try {
      localStorage.setItem("bca_theme", theme);
    } catch {}
  }, [theme]);
  useEffect(() => {
    const onKey = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setView("feed");
        setTimeout(() => searchInputRef.current?.focus(), 40);
      } else if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        setView("feed");
        setTimeout(() => searchInputRef.current?.focus(), 40);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const toggleWatch = useCallback(item => {
    setWatchlist(prev => {
      const exists = prev.some(w => w.id === item.id);
      const next = exists ? prev.filter(w => w.id !== item.id) : [item, ...prev].slice(0, 100);
      try {
        localStorage.setItem("bca_watchlist", JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);
  const askAIAboutItem = useCallback(item => {
    const cvePart = item.cve_ids?.length ? ` (${item.cve_ids.join(", ")})` : "";
    const epssPart = item.epss != null ? ` [EPSS: ${item.epss}%]` : "";
    setAiPrompt(`Triage this ${item.severity || ""} item from ${item.source}: "${item.title}"${cvePart}${epssPart}. Explain: 1) What is vulnerable & impact, 2) Detection / IOCs to hunt, 3) Immediate remediation steps for enterprise / GCC SOC teams.`);
  }, []);
  const openKnowledge = useCallback(focus => {
    setKnowFocus(focus || null);
    setView("knowledge");
  }, []);
  const exportIntel = useCallback((items, fmt) => {
    const stamp = new Date().toISOString().slice(0, 10);
    if (fmt === "stix") {
      const bundle = buildStixBundle(items);
      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: "application/stix+json"
      });
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = `bcyberaware-stix21-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(u);
      return;
    }
    if (fmt === "json") {
      const blob = new Blob([JSON.stringify(items, null, 2)], {
        type: "application/json"
      });
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = `bcyberaware-intel-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(u);
    } else {
      const header = ["ID", "Severity", "CVSS", "EPSS_%", "Exploit_In_Wild", "GCC_Relevance", "Date", "Source", "CVEs", "Title", "URL"];
      const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const rows = items.map(x => [x.id, x.severity, x.cvss || "", x.epss ?? "", x.exploit_in_wild ? "YES" : "NO", x.middle_east_relevance || "", x.date || "", x.source || "", (x.cve_ids || []).join(";"), x.title || "", x.source_url || ""].map(esc).join(","));
      const blob = new Blob([[header.join(","), ...rows].join("\n")], {
        type: "text/csv;charset=utf-8"
      });
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = `bcyberaware-intel-${stamp}.csv`;
      a.click();
      URL.revokeObjectURL(u);
    }
  }, []);
  const refreshFeed = useCallback(async (force = false) => {
    setLoading(true);
    setFeedError(null);
    try {
      const data = await loadFeed(force);
      setAdvisories(data.advisories || []);
      setExploits(data.exploits || []);
      setNews(data.news || []);
      setBreaking(data.breaking || []);
      setSocial(data.social || []);
      setHeatmap(data.heatmap || []);
      setFeedMeta(data);
    } catch (e) {
      setFeedError("Could not reach live feed: " + e.message);
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    refreshFeed();
  }, []);
  const [alertsOn, setAlertsOn] = useState(() => {
    try {
      return localStorage.getItem("bca_alerts") === "1" && typeof Notification !== "undefined" && Notification.permission === "granted";
    } catch {
      return false;
    }
  });
  const toggleAlerts = useCallback(async () => {
    if (alertsOn) {
      setAlertsOn(false);
      try {
        localStorage.setItem("bca_alerts", "0");
      } catch {}
      return;
    }
    if (typeof Notification === "undefined") return;
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return;
    try {
      if ("serviceWorker" in navigator) {
        await navigator.serviceWorker.register("/sw.js");
        await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(r, 2000))]);
      }
    } catch {}
    try {
      localStorage.setItem("bca_alerts", "1");
    } catch {}
    setAlertsOn(true);
    showAlert("🔔 BCyberAware alerts enabled", "You'll be notified about new CRITICAL and exploited-in-the-wild threats while the site is open in a tab. Nothing is stored on any server.", "/");
  }, [alertsOn]);
  useEffect(() => {
    if (!alertsOn) return;
    const KEY = "bca_alert_seen";
    const check = async () => {
      try {
        const data = await loadFeed(false);
        const hot = [...(data.advisories || []), ...(data.exploits || []), ...(data.breaking || [])].filter(a => a.severity === "CRITICAL" || a.exploit_in_wild);
        let seen;
        try {
          seen = new Set(JSON.parse(localStorage.getItem(KEY) || "[]"));
        } catch {
          seen = new Set();
        }
        if (!seen.size) {
          try {
            localStorage.setItem(KEY, JSON.stringify(hot.map(a => a.id).slice(0, 300)));
          } catch {}
          return;
        }
        const fresh = hot.filter(a => a.id && !seen.has(a.id)).slice(0, 3);
        fresh.forEach(a => showAlert(`🚨 ${a.severity || "ALERT"} · ${a.source}`, a.title, a.source_url || "/"));
        if (fresh.length) {
          try {
            localStorage.setItem(KEY, JSON.stringify([...hot.map(a => a.id), ...seen].slice(0, 300)));
          } catch {}
        }
      } catch {}
    };
    check();
    const t = setInterval(check, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, [alertsOn]);
  useEffect(() => {
    if (!feedMeta) return;
    let cancelled = false;
    setBrief({
      loading: true
    });
    fetch(`${PROXY}?action=brief`, {
      cache: "no-store"
    }).then(r => r.json()).then(d => {
      if (!cancelled) setBrief(d);
    }).catch(() => {
      if (!cancelled) setBrief(null);
    });
    return () => {
      cancelled = true;
    };
  }, [feedMeta?.fetched_at]);
  const matchesSearch = a => {
    if (!searchQ.trim()) return true;
    const q = searchQ.trim().toLowerCase();
    const hay = `${a.title || ""} ${a.summary || ""} ${a.source || ""} ${a.author || ""} ${(a.cve_ids || []).join(" ")} ${(a.affected_products || []).join(" ")} ${a.threat_actor || ""}`.toLowerCase();
    return hay.includes(q);
  };
  const applyFilters = arr => arr.filter(a => {
    if (!matchesSearch(a)) return false;
    if (filterSev !== "All" && a.severity !== filterSev) return false;
    if (filterME && a.middle_east_relevance !== "HIGH") return false;
    if (filterExp && !a.exploit_in_wild) return false;
    if (filterEpss && (a.epss || 0) < 10) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === "epss") return (b.epss || 0) - (a.epss || 0) || (b.ts || 0) - (a.ts || 0);
    if (sortBy === "recent") return (b.ts || 0) - (a.ts || 0);
    return SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity) || (b.ts || 0) - (a.ts || 0) || (b.epss || 0) - (a.epss || 0);
  });
  const fAdvisories = applyFilters(advisories);
  const fExploits = applyFilters(exploits);
  const fNews = news.filter(matchesSearch);
  const fSocial = social.filter(matchesSearch);
  const watchIds = new Set(watchlist.map(w => w.id));
  const defcon = computeDefcon(advisories, exploits);
  const allItems = [...advisories, ...exploits, ...news, ...social];
  const counts = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0
  };
  advisories.forEach(a => {
    if (counts[a.severity] !== undefined) counts[a.severity]++;
  });
  const FLAGS = {
    US: "🇺🇸",
    GB: "🇬🇧",
    CN: "🇨🇳",
    RU: "🇷🇺",
    IN: "🇮🇳",
    DE: "🇩🇪",
    AU: "🇦🇺",
    CA: "🇨🇦",
    FR: "🇫🇷",
    IR: "🇮🇷",
    KP: "🇰🇵",
    AE: "🇦🇪",
    SA: "🇸🇦",
    QA: "🇶🇦",
    KW: "🇰🇼",
    PK: "🇵🇰",
    UA: "🇺🇦",
    BR: "🇧🇷",
    JP: "🇯🇵",
    KR: "🇰🇷",
    NL: "🇳🇱",
    SG: "🇸🇬",
    TR: "🇹🇷",
    IL: "🇮🇱",
    ZA: "🇿🇦",
    NG: "🇳🇬",
    MX: "🇲🇽"
  };
  const navBtn = (v, l) => React.createElement("button", {
    key: v,
    onClick: () => setView(v),
    className: view === v ? "nav-active" : "",
    style: {
      padding: "5px 10px",
      whiteSpace: "nowrap",
      background: view === v ? "rgba(0,200,255,0.1)" : "transparent",
      border: `1px solid ${view === v ? "rgba(0,200,255,0.35)" : "rgba(255,255,255,0.08)"}`,
      color: view === v ? ACCENT : "rgba(200,220,240,0.45)",
      fontSize: 12,
      letterSpacing: .5,
      cursor: "pointer",
      fontFamily: "var(--mono)",
      borderRadius: 4,
      fontWeight: view === v ? 700 : 400
    }
  }, l);
  const SOURCES_DATA = [{
    name: "CISA KEV",
    cat: "Advisory",
    flag: "🇺🇸",
    url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
    desc: "Actively exploited vulnerabilities — updated continuously by US CISA."
  }, {
    name: "CISA Alerts",
    cat: "Advisory",
    flag: "🇺🇸",
    url: "https://www.cisa.gov/news-events/cybersecurity-advisories",
    desc: "Full US-CERT security alerts and advisories from the US government."
  }, {
    name: "NVD / CVE.org",
    cat: "Advisory",
    flag: "🌐",
    url: "https://nvd.nist.gov",
    desc: "NIST National Vulnerability Database — critical CVEs published in the last 30 days, enriched with FIRST.org EPSS."
  }, {
    name: "GitHub Advisory (GHSA)",
    cat: "Advisory",
    flag: "🐙",
    url: "https://github.com/advisories",
    desc: "GitHub Security Lab reviewed critical advisories across enterprise & open-source ecosystems."
  }, {
    name: "CERT-In (India)",
    cat: "Advisory",
    flag: "🇮🇳",
    url: "https://www.cert-in.org.in",
    desc: "India's national CERT — enterprise and national infrastructure security advisories."
  }, {
    name: "NCSC UK",
    cat: "Advisory",
    flag: "🇬🇧",
    url: "https://www.ncsc.gov.uk",
    desc: "UK National Cyber Security Centre — official news, guidance and threat reports."
  }, {
    name: "CERT-EU",
    cat: "Advisory",
    flag: "🇪🇺",
    url: "https://cert.europa.eu",
    desc: "EU institutions' CERT — security advisories for European enterprise software."
  }, {
    name: "JPCERT/CC (Japan)",
    cat: "Advisory",
    flag: "🇯🇵",
    url: "https://www.jpcert.or.jp/english/",
    desc: "Japan Computer Emergency Response Team — APAC zero-day and enterprise alerts."
  }, {
    name: "CIS Security Advisories",
    cat: "Advisory",
    flag: "🛡️",
    url: "https://www.cisecurity.org/advisory",
    desc: "Center for Internet Security / MS-ISAC advisories for government and enterprise."
  }, {
    name: "Cisco PSIRT",
    cat: "Advisory",
    flag: "🛡️",
    url: "https://sec.cloudapps.cisco.com/security/center/publicationListing.x",
    desc: "Official Cisco Product Security Incident Response Team advisories (IOS XE, ASA, Firepower)."
  }, {
    name: "Palo Alto PSIRT",
    cat: "Advisory",
    flag: "🔥",
    url: "https://security.paloaltonetworks.com",
    desc: "Palo Alto Networks PAN-OS, GlobalProtect and Prisma security advisories."
  }, {
    name: "FortiGuard PSIRT",
    cat: "Advisory",
    flag: "🧱",
    url: "https://www.fortiguard.com/psirt",
    desc: "Fortinet FortiOS, FortiGate, FortiManager and VPN PSIRT advisories."
  }, {
    name: "Microsoft Security",
    cat: "Advisory",
    flag: "🇺🇸",
    url: "https://www.microsoft.com/en-us/security/blog/",
    desc: "Microsoft Security blog — threat research, patches and nation-state tracking."
  }, {
    name: "Exploit-DB",
    cat: "Exploit",
    flag: "⚡",
    url: "https://www.exploit-db.com",
    desc: "Public exploit database — proof-of-concept exploits for known vulnerabilities."
  }, {
    name: "ZDI 0-Day Pipeline",
    cat: "Exploit",
    flag: "🧨",
    url: "https://www.zerodayinitiative.com/advisories/upcoming/",
    desc: "Trend Micro Zero Day Initiative — vulnerabilities awaiting vendor disclosure (pre-patch 0-days)."
  }, {
    name: "The Hacker News",
    cat: "News",
    flag: "📰",
    url: "https://thehackernews.com",
    desc: "Leading cybersecurity news — APTs, data breaches, and vulnerabilities."
  }, {
    name: "Bleeping Computer",
    cat: "News",
    flag: "📰",
    url: "https://www.bleepingcomputer.com",
    desc: "Breaking security news — ransomware, malware, and incident reports."
  }, {
    name: "The Record",
    cat: "News",
    flag: "🎙️",
    url: "https://therecord.media",
    desc: "Recorded Future News — nation-state operations, ransomware and policy."
  }, {
    name: "CyberScoop",
    cat: "News",
    flag: "📰",
    url: "https://cyberscoop.com",
    desc: "US government and enterprise cybersecurity journalism."
  }, {
    name: "Security Affairs",
    cat: "News",
    flag: "📰",
    url: "https://securityaffairs.com",
    desc: "High-frequency global breach, APT and hacktivism coverage by Pierluigi Paganini."
  }, {
    name: "HackRead",
    cat: "News",
    flag: "📰",
    url: "https://hackread.com",
    desc: "Global hacking news — breaches, dark web and cybercrime."
  }, {
    name: "The Register Security",
    cat: "News",
    flag: "🇬🇧",
    url: "https://www.theregister.com/security/",
    desc: "UK tech press security desk — incidents, patches and industry analysis."
  }, {
    name: "SANS ISC",
    cat: "News",
    flag: "🔍",
    url: "https://isc.sans.edu",
    desc: "SANS Internet Storm Center — daily threat intelligence and handler diaries."
  }, {
    name: "SecurityWeek",
    cat: "News",
    flag: "📰",
    url: "https://www.securityweek.com",
    desc: "Enterprise security news covering vulnerabilities, threats and industry trends."
  }, {
    name: "Krebs on Security",
    cat: "News",
    flag: "📰",
    url: "https://krebsonsecurity.com",
    desc: "In-depth security news and investigation by Brian Krebs."
  }, {
    name: "Cisco Talos",
    cat: "News",
    flag: "🛡️",
    url: "https://blog.talosintelligence.com",
    desc: "Cisco Talos threat research — malware, campaigns, and enterprise threats."
  }, {
    name: "Unit 42 (Palo Alto)",
    cat: "News",
    flag: "🔬",
    url: "https://unit42.paloaltonetworks.com",
    desc: "Palo Alto Networks threat research — APTs, ransomware gangs and cloud threats."
  }, {
    name: "Check Point Research",
    cat: "News",
    flag: "🔬",
    url: "https://research.checkpoint.com",
    desc: "Check Point threat research — malware reverse engineering and campaign tracking."
  }, {
    name: "CrowdStrike Threat Intel",
    cat: "News",
    flag: "🦅",
    url: "https://www.crowdstrike.com/en-us/blog/",
    desc: "CrowdStrike adversary intelligence, eCrime and intrusion analysis."
  }, {
    name: "Mandiant (Google Cloud)",
    cat: "News",
    flag: "🔥",
    url: "https://cloud.google.com/blog/topics/threat-intelligence",
    desc: "Mandiant frontline incident response and zero-day espionage investigations."
  }, {
    name: "Sophos X-Ops",
    cat: "News",
    flag: "🛡️",
    url: "https://news.sophos.com/en-us/category/threat-research/",
    desc: "Sophos X-Ops active adversary, ransomware and firewall exploit telemetry."
  }, {
    name: "Rapid7 Emergent Threats",
    cat: "News",
    flag: "🚀",
    url: "https://www.rapid7.com/blog/",
    desc: "Rapid7 AttackerKB & emergent vulnerability exploitation analysis."
  }, {
    name: "Dark Reading",
    cat: "News",
    flag: "📰",
    url: "https://www.darkreading.com",
    desc: "Enterprise security news — vulnerabilities, cloud, and risk for global SOCs."
  }, {
    name: "GBHackers",
    cat: "News",
    flag: "📰",
    url: "https://gbhackers.com",
    desc: "Daily hacking news — exploits, tools and vulnerability write-ups."
  }, {
    name: "Google Project Zero",
    cat: "News",
    flag: "🔬",
    url: "https://googleprojectzero.blogspot.com",
    desc: "Elite vulnerability research — zero-days and exploit analysis."
  }, {
    name: "Malwarebytes Labs",
    cat: "News",
    flag: "📰",
    url: "https://www.malwarebytes.com/blog",
    desc: "Malware trends, ransomware families, and threat actor activity."
  }, {
    name: "Help Net Security",
    cat: "News",
    flag: "📰",
    url: "https://www.helpnetsecurity.com",
    desc: "Daily cybersecurity news for practitioners and CISOs."
  }, {
    name: "Infosecurity Magazine",
    cat: "News",
    flag: "📰",
    url: "https://www.infosecurity-magazine.com",
    desc: "European and global infosec news — regulations, breaches, and defence."
  }, {
    name: "Schneier on Security",
    cat: "News",
    flag: "📰",
    url: "https://www.schneier.com",
    desc: "Bruce Schneier — security analysis, cryptography and policy commentary."
  }, {
    name: "Ars Technica Security",
    cat: "News",
    flag: "📰",
    url: "https://arstechnica.com/security/",
    desc: "In-depth technical security coverage (filtered from Ars feed)."
  }, {
    name: "Telegram: DarkFeed",
    cat: "News",
    flag: "📡",
    url: "https://t.me/secharvester",
    desc: "Public Telegram threat intelligence channel — no login required."
  }, {
    name: "The Hindu Tech",
    cat: "News",
    flag: "🇮🇳",
    url: "https://www.thehindu.com/sci-tech/technology/",
    desc: "India's most credible newspaper — cybersecurity filtered feed."
  }, {
    name: "Economic Times IT",
    cat: "News",
    flag: "🇮🇳",
    url: "https://economictimes.indiatimes.com/tech",
    desc: "India's leading business newspaper — covers RBI cyber alerts, DPDP Act, MeitY."
  }, {
    name: "infosec.exchange (Mastodon)",
    cat: "Social",
    flag: "🐘",
    url: "https://infosec.exchange",
    desc: "The infosec community's Mastodon home — public timeline, keyword-filtered for security relevance."
  }, {
    name: "Mastodon #cybersecurity",
    cat: "Social",
    flag: "🐘",
    url: "https://mastodon.social/tags/cybersecurity",
    desc: "Federated #cybersecurity hashtag stream from mastodon.social."
  }, {
    name: "Bluesky",
    cat: "Social",
    flag: "🦋",
    url: "https://bsky.app/search?q=cybersecurity",
    desc: "Latest cybersecurity posts via Bluesky's public AppView API."
  }, {
    name: "Hacker News (YC)",
    cat: "Social",
    flag: "🟠",
    url: "https://news.ycombinator.com",
    desc: "Security stories trending on Hacker News (Algolia API, ≥3 points)."
  }, {
    name: "Reddit r/netsec",
    cat: "Social",
    flag: "👽",
    url: "https://www.reddit.com/r/netsec/",
    desc: "Technical information-security community — research, write-ups and tooling."
  }, {
    name: "Awesome AI Security",
    cat: "AI Security",
    flag: "⭐",
    url: "https://github.com/restuhaqza/awesome-ai-security",
    desc: "Curated master index — frameworks, LLM tools, papers, benchmarks, and AI incident research."
  }, {
    name: "AI Incident Database",
    cat: "AI Security",
    flag: "📊",
    url: "https://incidentdatabase.ai/",
    desc: "Real-world AI system failures and misuse cases for executive briefings."
  }, {
    name: "MITRE ATLAS",
    cat: "AI Security",
    flag: "🎯",
    url: "https://atlas.mitre.org/",
    desc: "Adversarial threat landscape for AI — tactics and techniques knowledge base."
  }, {
    name: "NIST AI RMF",
    cat: "AI Security",
    flag: "🇺🇸",
    url: "https://www.nist.gov/itl/ai-risk-management-framework",
    desc: "US AI risk management framework for governance and compliance."
  }, {
    name: "OWASP LLM Top 10",
    cat: "AI Security",
    flag: "🔟",
    url: "https://owasp.org/www-project-top-10-for-large-language-model-applications/",
    desc: "Top 10 critical risks for LLM applications — also built into GenAI tab."
  }];
  const healthByName = {};
  (feedMeta?.source_health || []).forEach(h => {
    healthByName[h.name] = h;
  });
  return React.createElement("div", {
    className: `bca-app ${theme === "light" ? "light-theme" : "dark-theme"}`,
    style: {
      minHeight: "100vh",
      background: theme === "light" ? "#f4f6fb" : "#05080f",
      color: theme === "light" ? "#1e293b" : "#c8d8e8"
    }
  }, React.createElement("style", null, `
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes shimmer{0%{left:-60%}100%{left:120%}}
        @keyframes glow{0%,100%{opacity:.7}50%{opacity:1}}
        @keyframes tickerScroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        .ticker-track:hover{animation-play-state:paused}
        @media(max-width:520px){.chat-panel{right:0 !important;bottom:0 !important;width:100vw !important;max-width:100vw !important;height:100vh !important;max-height:100vh !important;border-radius:0 !important}}
        button:hover{opacity:.85}
      `), React.createElement("div", {
    className: "topbar-wrap",
    style: {
      background: theme === "light" ? "rgba(255,255,255,0.92)" : "rgba(0,0,0,.7)",
      borderBottom: `1px solid ${theme === "light" ? "rgba(0,0,0,0.08)" : "rgba(0,200,255,.1)"}`,
      position: "sticky",
      top: 0,
      zIndex: 50,
      backdropFilter: "blur(8px)"
    }
  }, React.createElement("div", {
    className: "topbar",
    style: {
      maxWidth: 1400,
      margin: "0 auto",
      padding: "8px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 58,
      gap: 10,
      flexWrap: "wrap"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexShrink: 0
    }
  }, React.createElement("img", {
    src: "logo.svg",
    alt: "BCyberAware Logo",
    style: {
      width: 36,
      height: 36,
      objectFit: "contain"
    }
  }), React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 900,
      color: ACCENT,
      letterSpacing: 1.5,
      lineHeight: 1.1,
      fontFamily: "var(--display)"
    }
  }, "BCyberAware"), React.createElement("div", {
    className: "logo-sub",
    style: {
      fontSize: 9,
      color: theme === "light" ? "#64748b" : "rgba(200,220,240,.4)",
      letterSpacing: 1
    }
  }, "by Vikas Pandita"))), React.createElement("nav", {
    className: "topnav",
    "aria-label": "Main navigation",
    style: {
      display: "flex",
      gap: 4,
      flex: "1 1 auto",
      overflowX: "auto",
      WebkitOverflowScrolling: "touch",
      padding: "4px 0",
      justifyContent: "center"
    }
  }, [["feed", "▦ Live Feed"], ["knowledge", "🧬 Knowledge"], ["heatmap", "🌍 Heatmap"], ["ciso", "📋 CISO Brief"], ["genai", "🤖 GenAI"], ["darkweb", "🕵️ Dark Web"], ["sources", "◎ Sources"], ["demo", "▶ Demo"], ["about", "◉ About"]].map(([v, l]) => navBtn(v, l))), React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      flexShrink: 0
    }
  }, loading ? React.createElement("span", {
    style: {
      fontSize: 11,
      color: ACCENT,
      animation: "pulse 1.5s infinite",
      fontFamily: "var(--mono)",
      whiteSpace: "nowrap"
    }
  }, "\u27F3 Fetching\u2026") : React.createElement(React.Fragment, null, React.createElement("span", {
    title: defcon.desc,
    style: {
      fontSize: 10.5,
      padding: "4px 9px",
      background: defcon.bg,
      border: `1px solid ${defcon.color}88`,
      color: defcon.color,
      fontFamily: "var(--mono)",
      borderRadius: 4,
      fontWeight: 800,
      letterSpacing: .8,
      whiteSpace: "nowrap"
    }
  }, "\u25CF ", defcon.label), feedMeta && React.createElement("span", {
    className: "feed-meta",
    style: {
      fontSize: 10,
      color: "rgba(200,220,240,.28)",
      fontFamily: "var(--mono)",
      whiteSpace: "nowrap"
    }
  }, feedMeta.from_cache ? "⚡" : "🔄", " ", feedMeta.fetched_at_human)), React.createElement("button", {
    onClick: () => refreshFeed(false),
    disabled: loading,
    style: {
      padding: "5px 12px",
      background: "transparent",
      border: `1px solid rgba(0,200,255,.3)`,
      color: ACCENT,
      fontSize: 12,
      cursor: loading ? "not-allowed" : "pointer",
      fontFamily: "var(--mono)",
      opacity: loading ? .4 : 1,
      borderRadius: 4,
      fontWeight: 600,
      whiteSpace: "nowrap"
    }
  }, "\u27F3 Refresh"), React.createElement("button", {
    onClick: () => refreshFeed(true),
    disabled: loading,
    style: {
      padding: "5px 12px",
      background: "rgba(255,100,0,.08)",
      border: `1px solid rgba(255,100,0,.35)`,
      color: "#ff9944",
      fontSize: 12,
      cursor: loading ? "not-allowed" : "pointer",
      fontFamily: "var(--mono)",
      opacity: loading ? .4 : 1,
      borderRadius: 4,
      fontWeight: 600,
      whiteSpace: "nowrap"
    }
  }, "\u26A1 Force Latest"), React.createElement("button", {
    onClick: () => setTheme(theme === "dark" ? "light" : "dark"),
    title: theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode",
    "aria-label": theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode",
    className: "theme-toggle-btn",
    style: {
      padding: "5px 11px",
      background: theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
      border: `1px solid ${theme === "dark" ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.12)"}`,
      color: theme === "dark" ? "#ffd700" : "#b45309",
      fontSize: 12,
      cursor: "pointer",
      fontFamily: "var(--mono)",
      borderRadius: 4,
      fontWeight: 700,
      whiteSpace: "nowrap",
      display: "inline-flex",
      alignItems: "center",
      gap: 5
    }
  }, theme === "dark" ? "☀️ Light" : "🌙 Dark"), React.createElement("button", {
    onClick: toggleAlerts,
    title: alertsOn ? "Alerts are ON — click to turn off" : "Get browser notifications when new CRITICAL or exploited-in-the-wild threats appear. No login, no email — nothing leaves your browser.",
    "aria-label": alertsOn ? "Disable threat alerts" : "Enable threat alerts",
    className: `alerts-btn${alertsOn ? " alerts-on" : ""}`,
    style: {
      padding: "5px 11px",
      background: alertsOn ? "rgba(0,230,118,0.1)" : "rgba(255,255,255,0.06)",
      border: `1px solid ${alertsOn ? "rgba(0,230,118,0.45)" : "rgba(255,255,255,0.16)"}`,
      color: alertsOn ? "#00e676" : "#9fb6cc",
      fontSize: 12,
      cursor: "pointer",
      fontFamily: "var(--mono)",
      borderRadius: 4,
      fontWeight: 700,
      whiteSpace: "nowrap",
      display: "inline-flex",
      alignItems: "center",
      gap: 5
    }
  }, alertsOn ? "🔔 On" : "🔔 Alerts")))), React.createElement(BreakingTicker, {
    items: breaking
  }), React.createElement("div", {
    style: {
      maxWidth: 1150,
      margin: "0 auto",
      padding: "22px 20px"
    }
  }, view === "feed" && React.createElement("div", {
    style: {
      animation: "fadeIn .3s ease"
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      marginBottom: 20,
      flexWrap: "wrap"
    }
  }, React.createElement(StatCard, {
    label: "Total Items",
    value: allItems.length,
    color: ACCENT
  }), React.createElement(StatCard, {
    label: "Fresh (24h)",
    value: allItems.filter(a => a.ts && Date.now() - a.ts < 24 * 60 * 60 * 1000).length,
    color: "#00e5ff",
    sub: "Last 24 hours"
  }), React.createElement(StatCard, {
    label: "Critical",
    value: counts.CRITICAL,
    color: "#ff4444"
  }), React.createElement(StatCard, {
    label: "Exploits",
    value: exploits.length,
    color: "#ff4444",
    sub: "Incl. 0-day pipeline"
  }), React.createElement(StatCard, {
    label: "Security News",
    value: news.length,
    color: "#e91e63"
  }), React.createElement(StatCard, {
    label: "GCC High Risk",
    value: [...advisories, ...exploits].filter(a => a.middle_east_relevance === "HIGH").length,
    color: "#00e676",
    sub: "Middle East"
  }), feedMeta?.sources_live != null && React.createElement(StatCard, {
    label: "Sources Live",
    value: `${feedMeta.sources_live}/${feedMeta.sources_total}`,
    color: "#00e676",
    sub: "Real telemetry"
  })), loading && React.createElement("div", {
    style: {
      height: 3,
      background: "rgba(0,200,255,.07)",
      overflow: "hidden",
      position: "relative",
      borderRadius: 2,
      marginBottom: 16
    }
  }, React.createElement("div", {
    style: {
      position: "absolute",
      height: "100%",
      width: "55%",
      background: `linear-gradient(90deg,transparent,${ACCENT},transparent)`,
      animation: "shimmer 1.4s infinite"
    }
  })), feedError && React.createElement("div", {
    style: {
      padding: "14px 18px",
      background: "rgba(200,0,0,.1)",
      border: "1px solid rgba(200,0,0,.3)",
      borderRadius: 6,
      marginBottom: 16,
      fontSize: 14,
      color: "#ff6666"
    }
  }, "\u26A0 ", feedError), React.createElement(AIBriefCard, {
    brief: brief
  }), React.createElement("div", {
    className: "search-bar-wrap",
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      alignItems: "center",
      marginBottom: 14,
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(0,200,255,0.18)",
      borderRadius: 8,
      padding: "10px 14px"
    }
  }, React.createElement("span", {
    style: {
      fontSize: 14,
      color: ACCENT
    }
  }, "\uD83D\uDD0E"), React.createElement("input", {
    ref: searchInputRef,
    value: searchQ,
    onChange: e => setSearchQ(e.target.value),
    placeholder: "Search CVE (e.g. CVE-2026-), vendor (Fortinet, Ivanti, Cisco, Microsoft), MITRE tactic, or keyword\u2026 (Press / or \u2318K)",
    "aria-label": "Global threat search",
    style: {
      flex: "1 1 260px",
      background: "transparent",
      border: "none",
      color: "#eef4ff",
      fontSize: 13.5,
      outline: "none",
      fontFamily: "var(--mono)"
    }
  }), searchQ && React.createElement("button", {
    onClick: () => setSearchQ(""),
    style: {
      padding: "3px 9px",
      fontSize: 11,
      fontFamily: "var(--mono)",
      background: "rgba(255,255,255,0.06)",
      border: "1px solid rgba(255,255,255,0.15)",
      color: "#ddeeff",
      borderRadius: 4,
      cursor: "pointer"
    }
  }, "\u2715 Clear"), React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginLeft: "auto"
    }
  }, React.createElement("button", {
    onClick: () => exportIntel(feedTab === "advisories" ? fAdvisories : feedTab === "exploits" ? fExploits : feedTab === "news" ? fNews : feedTab === "watchlist" ? watchlist : fSocial, "csv"),
    title: "Export current view to CSV",
    className: "export-btn",
    style: {
      padding: "5px 10px",
      fontSize: 11,
      fontFamily: "var(--mono)",
      background: "rgba(0,200,255,0.07)",
      border: "1px solid rgba(0,200,255,0.25)",
      color: ACCENT,
      borderRadius: 4,
      cursor: "pointer",
      fontWeight: 600
    }
  }, "\u2B07 CSV"), React.createElement("button", {
    onClick: () => exportIntel(feedTab === "advisories" ? fAdvisories : feedTab === "exploits" ? fExploits : feedTab === "news" ? fNews : feedTab === "watchlist" ? watchlist : fSocial, "json"),
    title: "Export current view to JSON",
    className: "export-btn",
    style: {
      padding: "5px 10px",
      fontSize: 11,
      fontFamily: "var(--mono)",
      background: "rgba(123,47,247,0.1)",
      border: "1px solid rgba(123,47,247,0.3)",
      color: "#d8b4fe",
      borderRadius: 4,
      cursor: "pointer",
      fontWeight: 600
    }
  }, "\u2B07 JSON"), React.createElement("button", {
    onClick: () => exportIntel(feedTab === "advisories" ? fAdvisories : feedTab === "exploits" ? fExploits : feedTab === "news" ? fNews : feedTab === "watchlist" ? watchlist : fSocial, "stix"),
    title: "Export OASIS STIX 2.1 bundle (OpenCTI / MISP / TAXII compatible)",
    className: "export-btn",
    style: {
      padding: "5px 10px",
      fontSize: 11,
      fontFamily: "var(--mono)",
      background: "rgba(255,145,0,0.1)",
      border: "1px solid rgba(255,145,0,0.35)",
      color: "#ffab40",
      borderRadius: 4,
      cursor: "pointer",
      fontWeight: 600
    }
  }, "\u2B07 STIX 2.1"), React.createElement("a", {
    href: "/feed.xml",
    target: "_blank",
    rel: "noopener noreferrer",
    title: "Subscribe to the live threat feed in any RSS reader \u2014 no login, no email",
    className: "export-btn",
    style: {
      padding: "5px 10px",
      fontSize: 11,
      fontFamily: "var(--mono)",
      background: "rgba(255,102,0,0.1)",
      border: "1px solid rgba(255,102,0,0.35)",
      color: "#ff8a50",
      borderRadius: 4,
      cursor: "pointer",
      fontWeight: 600,
      textDecoration: "none"
    }
  }, "\uD83D\uDCE1 RSS"))), React.createElement(ThreatVelocityPanel, {
    advisories: advisories,
    exploits: exploits,
    news: news,
    activeSearch: searchQ,
    onSelectKeyword: q => setSearchQ(q)
  }), React.createElement("div", {
    className: "feed-tabs-wrap",
    style: {
      display: "flex",
      gap: 4,
      marginBottom: 16,
      borderBottom: "1px solid rgba(255,255,255,.07)",
      overflowX: "auto",
      WebkitOverflowScrolling: "touch"
    }
  }, [["advisories", `🏛️ Advisories (${fAdvisories.length})`], ["exploits", `⚡ Exploits (${fExploits.length})`], ["news", `📰 Security News (${fNews.length})`], ["social", `💬 Social Intel (${fSocial.length})`], ["watchlist", `★ Watchlist (${watchlist.length})`]].map(([id, lbl]) => React.createElement("button", {
    key: id,
    onClick: () => setFeedTab(id),
    className: `feed-tab-btn ${feedTab === id ? "tab-active" : ""}`,
    style: {
      padding: "10px 18px",
      background: "transparent",
      border: "none",
      borderBottom: feedTab === id ? `3px solid ${ACCENT}` : "3px solid transparent",
      color: feedTab === id ? ACCENT : "rgba(200,220,240,.45)",
      fontSize: 14,
      letterSpacing: .5,
      cursor: "pointer",
      fontFamily: "var(--mono)",
      fontWeight: feedTab === id ? 700 : 400,
      whiteSpace: "nowrap"
    }
  }, lbl))), feedTab !== "news" && feedTab !== "social" && feedTab !== "watchlist" && React.createElement("div", {
    className: "filter-bar-wrap",
    style: {
      display: "flex",
      gap: 7,
      flexWrap: "wrap",
      marginBottom: 16,
      alignItems: "center"
    }
  }, React.createElement("span", {
    style: {
      fontSize: 12,
      color: "rgba(200,220,240,.3)",
      letterSpacing: 1.5,
      fontFamily: "var(--mono)"
    }
  }, "FILTER:"), ["All", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map(s => {
    const ss = SEV_S[s];
    return React.createElement("button", {
      key: s,
      onClick: () => setFilterSev(s),
      className: `filter-btn ${filterSev === s ? "active" : ""}`,
      style: {
        padding: "5px 14px",
        fontSize: 13,
        cursor: "pointer",
        fontFamily: "var(--mono)",
        background: filterSev === s ? ss?.bg || "rgba(0,200,255,.09)" : "transparent",
        border: `1px solid ${filterSev === s ? ss?.border || ACCENT : "rgba(255,255,255,.1)"}`,
        color: filterSev === s ? ss?.text || ACCENT : "rgba(200,220,240,.45)",
        borderRadius: 4,
        fontWeight: filterSev === s ? 700 : 400
      }
    }, s);
  }), React.createElement("div", {
    style: {
      width: 1,
      height: 18,
      background: "rgba(255,255,255,.08)"
    }
  }), React.createElement("button", {
    onClick: () => setFilterME(!filterME),
    className: `filter-btn ${filterME ? "active" : ""}`,
    style: {
      padding: "5px 14px",
      fontSize: 13,
      cursor: "pointer",
      fontFamily: "var(--mono)",
      background: filterME ? "rgba(0,166,81,.12)" : "transparent",
      border: `1px solid ${filterME ? "#00a651" : "rgba(255,255,255,.1)"}`,
      color: filterME ? "#00e676" : "rgba(200,220,240,.45)",
      borderRadius: 4,
      fontWeight: filterME ? 700 : 400
    }
  }, "\uD83C\uDF0D GCC / Middle East"), React.createElement("button", {
    onClick: () => setFilterExp(!filterExp),
    className: `filter-btn ${filterExp ? "active" : ""}`,
    style: {
      padding: "5px 14px",
      fontSize: 13,
      cursor: "pointer",
      fontFamily: "var(--mono)",
      background: filterExp ? "rgba(200,0,0,.12)" : "transparent",
      border: `1px solid ${filterExp ? "#c00000" : "rgba(255,255,255,.1)"}`,
      color: filterExp ? "#ff4444" : "rgba(200,220,240,.45)",
      borderRadius: 4,
      fontWeight: filterExp ? 700 : 400
    }
  }, "\u26A1 Exploit in Wild"), React.createElement("button", {
    onClick: () => setFilterEpss(!filterEpss),
    className: `filter-btn ${filterEpss ? "active" : ""}`,
    style: {
      padding: "5px 14px",
      fontSize: 13,
      cursor: "pointer",
      fontFamily: "var(--mono)",
      background: filterEpss ? "rgba(255,145,0,.14)" : "transparent",
      border: `1px solid ${filterEpss ? "#ff9100" : "rgba(255,255,255,.1)"}`,
      color: filterEpss ? "#ff9100" : "rgba(200,220,240,.45)",
      borderRadius: 4,
      fontWeight: filterEpss ? 700 : 400
    }
  }, "\uD83C\uDFAF EPSS \u2265 10%"), React.createElement("div", {
    style: {
      marginLeft: "auto",
      display: "flex",
      gap: 5,
      alignItems: "center"
    }
  }, React.createElement("span", {
    style: {
      fontSize: 11,
      color: "rgba(200,220,240,.3)",
      fontFamily: "var(--mono)"
    }
  }, "SORT:"), [["sev", "Severity"], ["epss", "EPSS Risk"], ["recent", "Newest"]].map(([k, lbl]) => React.createElement("button", {
    key: k,
    onClick: () => setSortBy(k),
    className: `sort-btn ${sortBy === k ? "active" : ""}`,
    style: {
      padding: "4px 10px",
      fontSize: 11.5,
      cursor: "pointer",
      fontFamily: "var(--mono)",
      background: sortBy === k ? "rgba(0,200,255,.12)" : "transparent",
      border: `1px solid ${sortBy === k ? ACCENT : "rgba(255,255,255,.1)"}`,
      color: sortBy === k ? ACCENT : "rgba(200,220,240,.45)",
      borderRadius: 4,
      fontWeight: sortBy === k ? 700 : 400
    }
  }, lbl)))), feedTab === "advisories" && (fAdvisories.length === 0 ? React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "40px",
      color: "rgba(200,220,240,.35)",
      fontSize: 14
    }
  }, "No advisories match your current filter/search.") : fAdvisories.map(a => React.createElement(AdvisoryCard, {
    key: a.id,
    adv: a,
    onAskAI: askAIAboutItem,
    onToggleWatch: toggleWatch,
    isWatched: watchIds.has(a.id),
    onOpenKnowledge: openKnowledge
  }))), feedTab === "exploits" && (fExploits.length === 0 ? React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "40px",
      color: "rgba(200,220,240,.35)",
      fontSize: 14
    }
  }, "No exploits match your current filter/search.") : fExploits.map(a => React.createElement(AdvisoryCard, {
    key: a.id,
    adv: a,
    onAskAI: askAIAboutItem,
    onToggleWatch: toggleWatch,
    isWatched: watchIds.has(a.id),
    onOpenKnowledge: openKnowledge
  }))), feedTab === "news" && (fNews.length === 0 ? React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "40px",
      color: "rgba(200,220,240,.35)",
      fontSize: 14
    }
  }, "No news items match \"", searchQ, "\".") : fNews.map(a => React.createElement(AdvisoryCard, {
    key: a.id,
    adv: a,
    onAskAI: askAIAboutItem,
    onToggleWatch: toggleWatch,
    isWatched: watchIds.has(a.id),
    onOpenKnowledge: openKnowledge
  }))), feedTab === "social" && React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      padding: "12px 16px",
      background: "rgba(99,100,255,.06)",
      border: "1px solid rgba(99,100,255,.2)",
      borderRadius: 6,
      marginBottom: 14,
      fontSize: 12.5,
      color: "rgba(200,220,240,.55)",
      lineHeight: 1.7
    }
  }, "\uD83D\uDCAC What the security community is talking about right now \u2014 infosec.exchange (Mastodon), Bluesky, Hacker News and r/netsec. Keyword-filtered for security relevance \xB7 community posts, not verified intelligence."), fSocial.length === 0 ? React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "40px",
      color: "rgba(200,220,240,.3)",
      fontSize: 14
    }
  }, "No social posts match your filter.") : fSocial.map(p => React.createElement(SocialCard, {
    key: p.id,
    post: p
  }))), feedTab === "watchlist" && (watchlist.length === 0 ? React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "45px 20px",
      color: "rgba(200,220,240,.4)",
      fontSize: 14,
      background: "rgba(255,255,255,.015)",
      border: "1px dashed rgba(255,255,255,.1)",
      borderRadius: 8
    }
  }, "\u2605 Your analyst watchlist is empty. Click ", React.createElement("strong", null, "\u2606 SAVE"), " on any advisory, exploit, or news card to pin items here for triage or export (saved in your browser).") : watchlist.map(a => React.createElement(AdvisoryCard, {
    key: a.id,
    adv: a,
    onAskAI: askAIAboutItem,
    onToggleWatch: toggleWatch,
    isWatched: true,
    onOpenKnowledge: openKnowledge
  })))), view === "heatmap" && React.createElement("div", {
    style: {
      animation: "fadeIn .3s ease"
    }
  }, React.createElement("div", {
    style: {
      textAlign: "center",
      marginBottom: 20
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      letterSpacing: 4,
      color: ACCENT,
      marginBottom: 8,
      fontFamily: "var(--mono)"
    }
  }, "\uD83C\uDF0D GLOBAL THREAT HEATMAP"), React.createElement("div", {
    style: {
      fontSize: 14,
      color: "rgba(200,220,240,.45)",
      marginBottom: 4
    }
  }, "Countries ranked by threat activity \xB7 Refreshed every 2 hours"), React.createElement("div", {
    style: {
      fontSize: 12,
      color: "rgba(200,220,240,.25)"
    }
  }, "CRITICAL=4pts \xB7 HIGH=3pts \xB7 MEDIUM=2pts \xB7 LOW=1pt")), React.createElement("div", {
    style: {
      background: "rgba(5,8,15,.97)",
      border: "1px solid rgba(0,200,255,.15)",
      borderRadius: 8,
      padding: "20px",
      marginBottom: 16,
      overflowX: "auto"
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: 2,
      color: "rgba(0,200,255,.5)",
      marginBottom: 14,
      fontFamily: "var(--mono)"
    }
  }, "WORLD THREAT MAP"), React.createElement("svg", {
    viewBox: "0 0 900 440",
    style: {
      width: "100%",
      minWidth: 600
    },
    xmlns: "http://www.w3.org/2000/svg"
  }, React.createElement("rect", {
    width: "900",
    height: "440",
    fill: "#060c18",
    rx: "6"
  }), [110, 220, 330, 440].map(y => React.createElement("line", {
    key: y,
    x1: "0",
    y1: y,
    x2: "900",
    y2: y,
    stroke: "rgba(0,200,255,.04)",
    strokeWidth: "1"
  })), [180, 360, 540, 720].map(x => React.createElement("line", {
    key: x,
    x1: x,
    y1: "0",
    x2: x,
    y2: "440",
    stroke: "rgba(0,200,255,.04)",
    strokeWidth: "1"
  })), [{
    code: "US",
    x: 100,
    y: 140,
    w: 140,
    h: 85
  }, {
    code: "CA",
    x: 100,
    y: 72,
    w: 140,
    h: 65
  }, {
    code: "MX",
    x: 115,
    y: 228,
    w: 85,
    h: 52
  }, {
    code: "BR",
    x: 190,
    y: 285,
    w: 95,
    h: 85
  }, {
    code: "GB",
    x: 375,
    y: 108,
    w: 48,
    h: 42
  }, {
    code: "DE",
    x: 422,
    y: 108,
    w: 48,
    h: 42
  }, {
    code: "FR",
    x: 390,
    y: 148,
    w: 48,
    h: 40
  }, {
    code: "NL",
    x: 422,
    y: 93,
    w: 32,
    h: 18
  }, {
    code: "UA",
    x: 468,
    y: 112,
    w: 58,
    h: 42
  }, {
    code: "SE",
    x: 438,
    y: 72,
    w: 36,
    h: 40
  }, {
    code: "IT",
    x: 428,
    y: 150,
    w: 36,
    h: 50
  }, {
    code: "ES",
    x: 378,
    y: 150,
    w: 44,
    h: 40
  }, {
    code: "RU",
    x: 478,
    y: 62,
    w: 185,
    h: 92
  }, {
    code: "TR",
    x: 478,
    y: 156,
    w: 58,
    h: 36
  }, {
    code: "IR",
    x: 528,
    y: 156,
    w: 58,
    h: 48
  }, {
    code: "AE",
    x: 555,
    y: 212,
    w: 36,
    h: 26
  }, {
    code: "SA",
    x: 502,
    y: 196,
    w: 62,
    h: 52
  }, {
    code: "IL",
    x: 490,
    y: 174,
    w: 26,
    h: 26
  }, {
    code: "QA",
    x: 547,
    y: 212,
    w: 22,
    h: 20
  }, {
    code: "KW",
    x: 528,
    y: 192,
    w: 24,
    h: 20
  }, {
    code: "NG",
    x: 405,
    y: 252,
    w: 52,
    h: 48
  }, {
    code: "ZA",
    x: 428,
    y: 332,
    w: 58,
    h: 52
  }, {
    code: "PK",
    x: 588,
    y: 158,
    w: 48,
    h: 48
  }, {
    code: "IN",
    x: 628,
    y: 174,
    w: 72,
    h: 72
  }, {
    code: "CN",
    x: 658,
    y: 118,
    w: 102,
    h: 82
  }, {
    code: "KP",
    x: 753,
    y: 126,
    w: 32,
    h: 32
  }, {
    code: "KR",
    x: 758,
    y: 156,
    w: 30,
    h: 30
  }, {
    code: "JP",
    x: 788,
    y: 133,
    w: 42,
    h: 58
  }, {
    code: "SG",
    x: 708,
    y: 267,
    w: 22,
    h: 20
  }, {
    code: "AU",
    x: 728,
    y: 302,
    w: 115,
    h: 82
  }].map(country => {
    const hm = heatmap.find(h => h.code === country.code);
    const max = heatmap[0]?.score || 1;
    const pct = hm ? hm.score / max : 0;
    const s = hm ? SEV_S[hm.level] || SEV_S.LOW : null;
    const fill = hm ? hm.level === "CRITICAL" ? `rgba(200,0,0,${.4 + pct * .5})` : hm.level === "HIGH" ? `rgba(220,100,0,${.35 + pct * .4})` : hm.level === "MEDIUM" ? `rgba(200,170,0,${.3 + pct * .35})` : `rgba(0,140,70,${.25 + pct * .3})` : "rgba(255,255,255,.04)";
    const stroke = hm ? s?.border || "#444" : "rgba(0,200,255,.08)";
    const isTop3 = hm && heatmap.slice(0, 3).some(h => h.code === country.code);
    return React.createElement("g", {
      key: country.code
    }, React.createElement("rect", {
      x: country.x,
      y: country.y,
      width: country.w,
      height: country.h,
      fill: fill,
      stroke: stroke,
      strokeWidth: isTop3 ? 2.5 : 1,
      rx: "4",
      style: {
        filter: isTop3 ? `drop-shadow(0 0 10px ${stroke})` : "none"
      }
    }), isTop3 && React.createElement("rect", {
      x: country.x,
      y: country.y,
      width: country.w,
      height: country.h,
      fill: "none",
      stroke: stroke,
      strokeWidth: "2",
      rx: "4",
      opacity: "0.4"
    }, React.createElement("animate", {
      attributeName: "opacity",
      values: "0.4;0;0.4",
      dur: "2s",
      repeatCount: "indefinite"
    })), React.createElement("text", {
      x: country.x + country.w / 2,
      y: country.y + country.h / 2 - (hm ? 7 : 0),
      textAnchor: "middle",
      fontSize: country.w > 80 ? 11 : country.w > 45 ? 10 : 9,
      fill: hm ? "#fff" : "rgba(200,220,240,.25)",
      fontWeight: "700",
      fontFamily: "monospace"
    }, country.code), hm && React.createElement("text", {
      x: country.x + country.w / 2,
      y: country.y + country.h / 2 + 11,
      textAnchor: "middle",
      fontSize: "9",
      fill: s?.text || "#fff",
      fontWeight: "700"
    }, hm.score, "pt"));
  }), [{
    label: "CRITICAL",
    color: "rgba(200,0,0,.7)",
    border: "#c00000"
  }, {
    label: "HIGH",
    color: "rgba(220,100,0,.6)",
    border: "#dd6600"
  }, {
    label: "MEDIUM",
    color: "rgba(200,170,0,.5)",
    border: "#c8a000"
  }, {
    label: "LOW",
    color: "rgba(0,140,70,.4)",
    border: "#008c46"
  }, {
    label: "NO DATA",
    color: "rgba(255,255,255,.04)",
    border: "rgba(0,200,255,.1)"
  }].map((l, i) => React.createElement("g", {
    key: l.label,
    transform: `translate(${18 + i * 165},408)`
  }, React.createElement("rect", {
    width: "14",
    height: "14",
    fill: l.color,
    stroke: l.border,
    strokeWidth: "1",
    rx: "2"
  }), React.createElement("text", {
    x: "20",
    y: "11",
    fontSize: "11",
    fill: "rgba(200,220,240,.5)",
    fontFamily: "monospace"
  }, l.label))))), React.createElement("div", {
    style: {
      background: "rgba(5,8,15,.95)",
      border: "1px solid rgba(0,200,255,.12)",
      borderRadius: 8,
      padding: "20px",
      marginBottom: 16
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: 2,
      color: "rgba(0,200,255,.5)",
      marginBottom: 16,
      fontFamily: "var(--mono)"
    }
  }, "TOP 15 COUNTRIES BY THREAT SCORE"), heatmap.length === 0 ? React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "30px",
      color: "rgba(200,220,240,.3)",
      fontSize: 14
    }
  }, "Loading\u2026 click \u26A1 Force Latest") : React.createElement("div", {
    style: {
      display: "grid",
      gap: 9
    }
  }, heatmap.slice(0, 15).map((c, i) => {
    const s = SEV_S[c.level] || SEV_S.LOW;
    const pct = Math.round(c.score / (heatmap[0]?.score || 1) * 100);
    return React.createElement("div", {
      key: c.code,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12
      }
    }, React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 900,
        fontFamily: "var(--mono)",
        color: i < 3 ? s.text : "rgba(200,220,240,.35)",
        minWidth: 24,
        textAlign: "right"
      }
    }, String(i + 1).padStart(2, "0")), React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 7,
        minWidth: 165
      }
    }, React.createElement("span", {
      style: {
        fontSize: 18
      }
    }, FLAGS[c.code] || "🌐"), React.createElement("span", {
      style: {
        fontSize: 13,
        color: "#ddeeff",
        fontWeight: 600
      }
    }, c.name)), React.createElement("div", {
      style: {
        flex: 1,
        height: 26,
        background: "rgba(255,255,255,.04)",
        borderRadius: 3,
        overflow: "hidden",
        position: "relative"
      }
    }, React.createElement("div", {
      style: {
        width: `${pct}%`,
        height: "100%",
        background: `linear-gradient(90deg,${s.border}55,${s.border})`,
        borderRadius: 3,
        minWidth: 4,
        boxShadow: i < 3 ? `0 0 8px ${s.border}88` : "none"
      }
    }), React.createElement("div", {
      style: {
        position: "absolute",
        right: 10,
        top: "50%",
        transform: "translateY(-50%)",
        fontSize: 11,
        color: "rgba(200,220,240,.5)",
        fontFamily: "var(--mono)"
      }
    }, c.score, "pts")), React.createElement("span", {
      style: {
        fontSize: 10,
        padding: "3px 10px",
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.text,
        fontFamily: "var(--mono)",
        borderRadius: 2,
        fontWeight: 700,
        minWidth: 72,
        textAlign: "center"
      }
    }, c.level));
  }))), React.createElement("div", {
    style: {
      fontSize: 11,
      letterSpacing: 2,
      color: "rgba(0,200,255,.5)",
      marginBottom: 12,
      fontFamily: "var(--mono)"
    }
  }, "REGIONAL THREAT SUMMARY"), React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      marginBottom: 16
    }
  }, [{
    region: "🌍 Middle East / GCC",
    codes: ["AE", "SA", "QA", "KW", "BH", "OM", "IQ", "IR"],
    color: "#00e676",
    bg: "rgba(0,200,100,.08)",
    border: "rgba(0,200,100,.2)"
  }, {
    region: "🌏 Asia Pacific",
    codes: ["IN", "CN", "JP", "KR", "AU", "SG", "PK"],
    color: ACCENT,
    bg: "rgba(0,200,255,.06)",
    border: "rgba(0,200,255,.18)"
  }, {
    region: "🌎 Americas",
    codes: ["US", "CA", "BR", "MX"],
    color: "#ff9944",
    bg: "rgba(220,100,0,.08)",
    border: "rgba(220,100,0,.2)"
  }, {
    region: "🌍 Europe",
    codes: ["GB", "DE", "FR", "NL", "IT", "ES", "SE", "UA"],
    color: "#c084fc",
    bg: "rgba(123,47,247,.08)",
    border: "rgba(123,47,247,.2)"
  }, {
    region: "⚠️ Threat Actors",
    codes: ["RU", "CN", "IR", "KP"],
    color: "#ff4444",
    bg: "rgba(200,0,0,.1)",
    border: "rgba(200,0,0,.25)"
  }].map(r => {
    const total = heatmap.filter(h => r.codes.includes(h.code)).reduce((s, h) => s + h.score, 0);
    const topC = heatmap.find(h => r.codes.includes(h.code));
    return React.createElement("div", {
      key: r.region,
      style: {
        flex: 1,
        minWidth: 150,
        background: r.bg,
        border: `1px solid ${r.border}`,
        borderRadius: 6,
        padding: "14px 16px"
      }
    }, React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 700,
        color: r.color,
        marginBottom: 6
      }
    }, r.region), React.createElement("div", {
      style: {
        fontSize: 30,
        fontWeight: 900,
        color: r.color,
        fontFamily: "var(--mono)",
        lineHeight: 1,
        marginBottom: 4
      }
    }, total), React.createElement("div", {
      style: {
        fontSize: 11,
        color: "rgba(200,220,240,.35)"
      }
    }, "threat score"), topC && React.createElement("div", {
      style: {
        fontSize: 11,
        color: "rgba(200,220,240,.3)",
        marginTop: 5
      }
    }, "Top: ", topC.name));
  })), React.createElement("div", {
    style: {
      padding: "12px 16px",
      background: "rgba(0,200,255,.04)",
      border: "1px solid rgba(0,200,255,.1)",
      borderRadius: 6,
      fontSize: 12,
      color: "rgba(200,220,240,.4)",
      lineHeight: 1.7
    }
  }, "\u2139\uFE0F Scores derived from advisory geographic metadata \u2014 not real-time attack traffic. Refreshes every 2 hours.")), view === "sources" && React.createElement("div", {
    style: {
      maxWidth: 780,
      margin: "0 auto",
      animation: "fadeIn .3s ease"
    }
  }, React.createElement("div", {
    style: {
      textAlign: "center",
      marginBottom: 24
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      letterSpacing: 4,
      color: ACCENT,
      marginBottom: 8,
      fontFamily: "var(--mono)"
    }
  }, "INTELLIGENCE SOURCES \xB7 LIVE TELEMETRY"), React.createElement("div", {
    style: {
      fontSize: 15,
      color: "rgba(200,220,240,.4)"
    }
  }, feedMeta?.sources_live != null ? React.createElement(React.Fragment, null, React.createElement("strong", {
    style: {
      color: "#00e676"
    }
  }, feedMeta.sources_live), " of ", React.createElement("strong", {
    style: {
      color: ACCENT
    }
  }, feedMeta.sources_total), " feeds responding this cycle \xB7 per-source latency measured on every refresh") : "Live RSS feeds · AI Security references · refreshed every 2 hours")), ["Advisory", "Exploit", "News", "Social", "AI Security"].map(cat => React.createElement("div", {
    key: cat,
    style: {
      marginBottom: 28
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      letterSpacing: 2,
      color: "rgba(0,200,255,.6)",
      marginBottom: 12,
      fontFamily: "var(--mono)",
      fontWeight: 700,
      borderBottom: "1px solid rgba(255,255,255,.06)",
      paddingBottom: 8
    }
  }, cat === "Advisory" ? "🏛️" : cat === "Exploit" ? "⚡" : cat === "AI Security" ? "🤖" : cat === "Social" ? "💬" : "📰", " ", cat.toUpperCase(), " SOURCES"), SOURCES_DATA.filter(s => s.cat === cat).map(src => {
    const h = healthByName[src.name];
    const isRef = src.cat === "AI Security";
    const status = isRef ? "ref" : h ? h.ok ? "live" : "down" : "unknown";
    const badge = status === "live" ? {
      bg: "rgba(0,150,70,.12)",
      border: "#008c46",
      color: "#00e676",
      label: "● LIVE"
    } : status === "down" ? {
      bg: "rgba(200,0,0,.12)",
      border: "#c00000",
      color: "#ff4444",
      label: "● DOWN"
    } : status === "ref" ? {
      bg: "rgba(123,47,247,.1)",
      border: "#7b2ff7",
      color: "#c084fc",
      label: "◆ REFERENCE"
    } : {
      bg: "rgba(200,170,0,.1)",
      border: "#c8a000",
      color: "#ffd700",
      label: "◌ PENDING"
    };
    return React.createElement("div", {
      key: src.name,
      style: {
        background: "rgba(255,255,255,.025)",
        border: `1px solid ${status === "down" ? "rgba(200,0,0,.2)" : "rgba(255,255,255,.07)"}`,
        borderRadius: 6,
        padding: "16px 18px",
        marginBottom: 10
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 14
      }
    }, React.createElement("div", {
      style: {
        flex: 1
      }
    }, React.createElement("div", {
      style: {
        display: "flex",
        gap: 10,
        alignItems: "center",
        marginBottom: 7,
        flexWrap: "wrap"
      }
    }, React.createElement("span", {
      style: {
        fontSize: 20
      }
    }, src.flag), React.createElement("span", {
      style: {
        fontSize: 15,
        fontWeight: 700,
        color: "#ddeeff"
      }
    }, src.name), React.createElement("span", {
      style: {
        fontSize: 11,
        padding: "3px 10px",
        letterSpacing: 1,
        fontFamily: "var(--mono)",
        borderRadius: 3,
        background: badge.bg,
        border: `1px solid ${badge.border}`,
        color: badge.color,
        fontWeight: 700
      }
    }, badge.label), h && h.ok && React.createElement("span", {
      style: {
        fontSize: 11,
        color: "rgba(200,220,240,.35)",
        fontFamily: "var(--mono)"
      }
    }, h.items, " items \xB7 ", h.ms, "ms")), React.createElement("div", {
      style: {
        fontSize: 13,
        color: "rgba(200,220,240,.5)",
        lineHeight: 1.75
      }
    }, src.desc)), React.createElement("a", {
      href: src.url,
      target: "_blank",
      rel: "noopener noreferrer",
      style: {
        fontSize: 13,
        color: ACCENT,
        fontFamily: "var(--mono)",
        border: `1px solid rgba(0,200,255,.25)`,
        padding: "7px 14px",
        borderRadius: 4,
        whiteSpace: "nowrap",
        flexShrink: 0,
        fontWeight: 600
      }
    }, "VISIT \u2197")));
  })))), view === "demo" && React.createElement("div", {
    style: {
      maxWidth: 820,
      margin: "0 auto",
      animation: "fadeIn .3s ease"
    }
  }, React.createElement("div", {
    style: {
      textAlign: "center",
      marginBottom: 24
    }
  }, React.createElement("div", {
    style: {
      fontSize: 13,
      letterSpacing: 4,
      color: ACCENT,
      marginBottom: 8,
      fontFamily: "var(--mono)"
    }
  }, "\u25B6 DEMO VIDEO"), React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: "#ddeeff",
      marginBottom: 6
    }
  }, "See BCyberAware in Action")), React.createElement("div", {
    style: {
      position: "relative",
      paddingBottom: "56.25%",
      height: 0,
      borderRadius: 10,
      overflow: "hidden",
      border: `1px solid rgba(0,200,255,.2)`,
      boxShadow: `0 0 40px rgba(0,200,255,.1)`,
      marginBottom: 20,
      background: "#000"
    }
  }, React.createElement("iframe", {
    src: `https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?rel=0&modestbranding=1`,
    title: "BCyberAware Demo",
    frameBorder: "0",
    allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
    allowFullScreen: true,
    style: {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%"
    }
  })), React.createElement("div", {
    style: {
      background: "rgba(255,0,0,.07)",
      border: "1px solid rgba(255,0,0,.2)",
      borderRadius: 8,
      padding: "18px 22px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 14
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: "#ddeeff",
      marginBottom: 4
    }
  }, "\uD83C\uDFAC BCyberAware YouTube Channel"), React.createElement("div", {
    style: {
      fontSize: 13,
      color: "rgba(200,220,240,.45)"
    }
  }, "Cybersecurity tutorials and threat walkthroughs by Vikas Pandita")), React.createElement("a", {
    href: YOUTUBE_CHANNEL,
    target: "_blank",
    rel: "noopener noreferrer",
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      fontSize: 14,
      color: "#fff",
      fontWeight: 700,
      background: "#ff0000",
      padding: "10px 20px",
      borderRadius: 6,
      whiteSpace: "nowrap"
    }
  }, "\u25B6 Subscribe"))), view === "about" && React.createElement("div", {
    style: {
      maxWidth: 680,
      margin: "0 auto",
      animation: "fadeIn .3s ease"
    }
  }, React.createElement("div", {
    style: {
      textAlign: "center",
      marginBottom: 30
    }
  }, React.createElement("img", {
    src: "logo.svg",
    alt: "BCyberAware Logo",
    style: {
      width: 90,
      height: 90,
      objectFit: "contain",
      margin: "0 auto 16px",
      display: "block"
    }
  }), React.createElement("div", {
    style: {
      fontSize: 26,
      fontWeight: 900,
      color: "#ddeeff",
      letterSpacing: 2,
      marginBottom: 7,
      fontFamily: "var(--display)"
    }
  }, "BCyberAware"), React.createElement("div", {
    style: {
      fontSize: 13,
      color: "rgba(200,220,240,.35)",
      letterSpacing: 2
    }
  }, "SECURITY INTELLIGENCE FOR THE MODERN ENTERPRISE")), React.createElement("div", {
    style: {
      background: "rgba(255,255,255,.025)",
      border: "1px solid rgba(0,200,255,.12)",
      borderRadius: 6,
      padding: "22px 24px",
      marginBottom: 12
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12,
      letterSpacing: 3,
      color: "rgba(0,200,255,.55)",
      marginBottom: 12,
      fontFamily: "var(--mono)",
      fontWeight: 700
    }
  }, "AUTHOR"), React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 800,
      color: "#ddeeff",
      marginBottom: 5
    }
  }, "Vikas Pandita"), React.createElement("div", {
    style: {
      fontSize: 14,
      color: "rgba(200,220,240,.5)",
      marginBottom: 16
    }
  }, "Global Head of Security Architecture \xB7 AI Researcher \xB7 Blogger"), React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, ["TOGAF 9.2", "IIM Kozhikode EPGP", "14+ Years Experience", "Big 4 Consulting", "IOC Security Architect", "GenAI Security"].map(b => React.createElement("span", {
    key: b,
    style: {
      fontSize: 12,
      color: ACCENT,
      fontFamily: "var(--mono)",
      background: "rgba(0,200,255,.07)",
      padding: "5px 12px",
      border: `1px solid rgba(0,200,255,.2)`,
      borderRadius: 4
    }
  }, b)))), React.createElement("div", {
    style: {
      background: "rgba(255,255,255,.025)",
      border: "1px solid rgba(0,200,255,.12)",
      borderRadius: 6,
      padding: "22px 24px"
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12,
      letterSpacing: 3,
      color: "rgba(0,200,255,.55)",
      marginBottom: 12,
      fontFamily: "var(--mono)",
      fontWeight: 700
    }
  }, "PLATFORM CAPABILITIES"), ["🛡️ AI Threat Analyst — chat assistant grounded in the live feed (Cloudflare Workers AI)", "🤖 AI Situation Summary — executive brief regenerated with every feed refresh", "🧬 Knowledge Graph — ATT&CK heat matrix, relationship graph, actor encyclopedia, IOC hunt (OpenCTI ideas, native)", "⬇ STIX 2.1 export — OASIS bundle for OpenCTI / MISP / TAXII / SIEM", "💬 Social Intel — infosec.exchange, Bluesky, Hacker News, r/netsec", "48 live intelligence sources with real-time health telemetry", "🔴 Breaking-news ticker — incident-grade stories from the last 48 hours", "ZDI 0-Day Pipeline — vulnerabilities awaiting vendor disclosure", "GenAI tab — OWASP LLM Top 10, Standards & Tools (Awesome AI Security)", "CISO Brief — AI governance links (NIST AI RMF, MITRE ATLAS, AI Incident Database)", "CISA KEV · NVD · GHSA · CERT-In · NCSC UK · CERT-EU · JPCERT · Cisco / Palo Alto / FortiGuard PSIRT", "The Record · Unit 42 · Check Point · CrowdStrike · Mandiant · Talos · Project Zero · Krebs", "GCC / Middle East relevance scoring + OpenCTI-style confidence & TLP on every card", "Global threat heatmap — country-level risk visualisation", "Source verification link on every advisory card · auto-refresh every 2 hours"].map((f, i) => React.createElement("div", {
    key: i,
    style: {
      fontSize: 14,
      color: "rgba(200,220,240,.55)",
      padding: "7px 0",
      borderBottom: "1px solid rgba(255,255,255,.05)",
      display: "flex",
      gap: 10,
      lineHeight: 1.5
    }
  }, React.createElement("span", {
    style: {
      color: ACCENT,
      flexShrink: 0
    }
  }, "\u25B8"), f)), React.createElement("div", {
    style: {
      marginTop: 16,
      fontSize: 12,
      color: "rgba(200,220,240,.25)",
      fontFamily: "var(--mono)"
    }
  }, "Open source \xB7 MIT Licence \xB7 Contributions welcome on GitHub"))), view === "knowledge" && React.createElement(KnowledgeView, {
    advisories: advisories,
    exploits: exploits,
    news: news,
    focus: knowFocus,
    onClearFocus: () => setKnowFocus(null),
    onAskAI: askAIAboutItem
  }), view === "ciso" && React.createElement(CISOBriefView, {
    advisories: advisories,
    exploits: exploits,
    news: news
  }), view === "genai" && React.createElement(GenAISecurityView, {
    advisories: advisories,
    exploits: exploits,
    news: news
  }), view === "darkweb" && React.createElement(DarkWebView, null)), React.createElement(ThreatAnalystChat, {
    externalPrompt: aiPrompt,
    onConsumedPrompt: () => setAiPrompt(null)
  }), React.createElement("div", {
    className: "footer-wrap",
    style: {
      borderTop: "1px solid rgba(255,255,255,.05)",
      marginTop: 32,
      padding: "18px 24px",
      textAlign: "center"
    }
  }, React.createElement("div", {
    style: {
      fontSize: 12,
      color: "rgba(200,220,240,.2)",
      letterSpacing: 1,
      marginBottom: 10
    }
  }, "BCyberAware \xB7 Vikas Pandita \xB7 ", new Date().getFullYear(), " \xB7 MIT Licence \xB7 30+ live sources \xB7 CISA \xB7 NVD \xB7 ZDI \xB7 The Record \xB7 Unit 42 \xB7 Check Point \xB7 Talos \xB7 Project Zero \xB7 Krebs \xB7 +20 more")));
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(BCyberAwareDashboard, null));
