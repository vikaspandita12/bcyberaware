const { useState, useEffect, useCallback } = React;

// ── API (Cloudflare Pages Functions: /api/proxy, /api/darkweb) ───────────────
const PROXY   = "/api/proxy";
const ACCENT  = "#00c8ff";
const ACCENT2 = "#7b2ff7";
const YOUTUBE_VIDEO_ID = "xNS89clz9FI";
const YOUTUBE_CHANNEL  = "https://www.youtube.com/@BCyberAwarebyvikaspandita";

const SEV_S = {
  CRITICAL:{ bg:"rgba(200,0,0,0.15)",   border:"#c00000", text:"#ff4444" },
  HIGH:    { bg:"rgba(220,100,0,0.13)", border:"#dd6600", text:"#ff9944" },
  MEDIUM:  { bg:"rgba(200,170,0,0.11)", border:"#c8a000", text:"#ffd700" },
  LOW:     { bg:"rgba(0,140,70,0.11)",  border:"#008c46", text:"#00e676" },
};
const SEV_ORDER = ["CRITICAL","HIGH","MEDIUM","LOW"];

async function loadFeed(force=false) {
  const url = force ? `${PROXY}?action=feed&bust=1` : `${PROXY}?action=feed`;
  const r   = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Feed error ${r.status}`);
  return r.json();
}

function timeAgo(ts){
  if(!ts) return "";
  const s=(Date.now()-ts)/1000;
  if(s<60) return "just now";
  if(s<3600) return Math.round(s/60)+"m ago";
  if(s<86400) return Math.round(s/3600)+"h ago";
  return Math.round(s/86400)+"d ago";
}

// ── Breaking News Ticker ──────────────────────────────────────────────────────
function BreakingTicker({ items }) {
  if(!items||items.length===0) return null;
  const doubled=[...items,...items];
  return (
    <div style={{background:"linear-gradient(90deg,rgba(80,0,0,.55),rgba(40,0,10,.4))",borderBottom:"1px solid rgba(255,23,68,.25)",display:"flex",alignItems:"stretch",overflow:"hidden",height:38}}>
      <div style={{flexShrink:0,display:"flex",alignItems:"center",gap:8,padding:"0 16px",background:"rgba(200,0,0,.3)",borderRight:"1px solid rgba(255,23,68,.35)",zIndex:2}}>
        <span style={{width:8,height:8,borderRadius:"50%",background:"#ff1744",boxShadow:"0 0 8px #ff1744",animation:"pulse 1.1s infinite",display:"inline-block"}}/>
        <span style={{fontSize:11,fontWeight:900,color:"#ff6e6e",fontFamily:"var(--mono)",letterSpacing:2.5,whiteSpace:"nowrap"}}>BREAKING</span>
      </div>
      <div style={{flex:1,overflow:"hidden",position:"relative"}}>
        <div className="ticker-track" style={{display:"flex",alignItems:"center",height:"100%",width:"max-content",animation:`tickerScroll ${Math.max(40,items.length*11)}s linear infinite`}}>
          {doubled.map((b,i)=>(
            <a key={i} href={b.source_url} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:9,padding:"0 28px",whiteSpace:"nowrap",fontSize:13}}>
              <span style={{color:"#ff7961",fontFamily:"var(--mono)",fontSize:11,letterSpacing:.5}}>{b.source_flag} {b.source} · {timeAgo(b.ts)}</span>
              <span style={{fontWeight:600,color:"#ffe3e3"}}>{b.title}</span>
              <span style={{color:"rgba(255,100,100,.3)"}}>◆</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function SevBadge({ sev }) {
  const s = SEV_S[sev]||SEV_S.LOW;
  return <span style={{fontSize:12,fontWeight:800,letterSpacing:1.5,padding:"4px 12px",background:s.bg,border:`1px solid ${s.border}`,color:s.text,borderRadius:3,whiteSpace:"nowrap",fontFamily:"var(--mono)"}}>{sev}</span>;
}

function StatCard({ label, value, color, sub }) {
  return (
    <div style={{flex:1,minWidth:100,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:6,padding:"16px 14px",textAlign:"center"}}>
      <div style={{fontSize:34,fontWeight:900,color:color||ACCENT,fontFamily:"var(--mono)",lineHeight:1}}>{value}</div>
      <div style={{fontSize:11,letterSpacing:1.5,color:"rgba(200,220,240,0.4)",textTransform:"uppercase",marginTop:7,fontWeight:600}}>{label}</div>
      {sub&&<div style={{fontSize:11,color:"rgba(200,220,240,0.25)",marginTop:3}}>{sub}</div>}
    </div>
  );
}

function AdvisoryCard({ adv }) {
  const s=SEV_S[adv.severity]||SEV_S.LOW;
  const isNews=adv.category==="news";
  const isExploit=adv.category==="exploit";
  const borderCol=isNews?"#1976d2":isExploit?"#c00000":s.border;
  const isFresh=adv.ts&&(Date.now()-adv.ts)<24*60*60*1000;
  return (
    <div className="card" style={{background:"rgba(5,8,15,0.92)",border:`1px solid ${borderCol}33`,borderLeft:`4px solid ${borderCol}`,borderRadius:6,padding:"18px 20px",marginBottom:12,boxShadow:adv.exploit_in_wild?`0 0 14px ${borderCol}12`:"none"}}>
      <div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"center",marginBottom:10}}>
        {!isNews&&<SevBadge sev={adv.severity}/>}
        {isNews&&<span style={{fontSize:12,padding:"4px 12px",background:"rgba(25,118,210,0.15)",border:"1px solid #1976d255",color:"#64b5f6",letterSpacing:1,fontFamily:"var(--mono)",borderRadius:3}}>📰 NEWS</span>}
        {isExploit&&<span style={{fontSize:12,padding:"4px 12px",background:"rgba(200,0,0,0.15)",border:"1px solid #c0000055",color:"#ff4444",letterSpacing:1,fontFamily:"var(--mono)",borderRadius:3}}>⚡ PUBLIC EXPLOIT</span>}
        {adv.exploit_in_wild&&!isExploit&&<span style={{fontSize:12,padding:"4px 12px",background:"rgba(200,0,0,0.15)",border:"1px solid #c0000055",color:"#ff4444",letterSpacing:1,fontFamily:"var(--mono)",borderRadius:3}}>⚡ EXPLOIT IN WILD</span>}
        {adv.middle_east_relevance==="HIGH"&&<span style={{fontSize:12,padding:"4px 12px",background:"rgba(0,166,81,0.1)",border:"1px solid #00a65155",color:"#00e676",letterSpacing:1,fontFamily:"var(--mono)",borderRadius:3}}>🌍 GCC RISK</span>}
        {isFresh&&<span style={{fontSize:11,padding:"4px 10px",background:"rgba(0,200,255,0.1)",border:"1px solid rgba(0,200,255,.4)",color:"#00c8ff",letterSpacing:1,fontFamily:"var(--mono)",borderRadius:3,fontWeight:800}}>● FRESH</span>}
        <span style={{fontSize:12,color:"rgba(200,220,240,0.4)"}}>{adv.source_flag} {adv.source} · {adv.ts?timeAgo(adv.ts):adv.date}</span>
      </div>
      <div style={{fontSize:17,fontWeight:700,color:"#eef4ff",marginBottom:10,lineHeight:1.45}}>{adv.title}</div>
      <div style={{fontSize:14,color:"rgba(200,220,240,0.6)",lineHeight:1.75,marginBottom:12}}>{adv.summary}</div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
        {adv.cve_ids?.map(c=>(
          <a key={c} href={`https://nvd.nist.gov/vuln/detail/${c}`} target="_blank" rel="noopener noreferrer"
            style={{fontSize:12,color:ACCENT,fontFamily:"var(--mono)",background:"rgba(0,200,255,0.07)",padding:"4px 11px",border:`1px solid rgba(0,200,255,0.22)`,borderRadius:3}}>{c} ↗</a>
        ))}
        {adv.threat_actor&&<span style={{fontSize:12,color:"#c084fc",fontFamily:"var(--mono)",background:"rgba(123,47,247,0.09)",padding:"4px 11px",border:"1px solid rgba(123,47,247,0.25)",borderRadius:3}}>🎯 {adv.threat_actor}</span>}
        {adv.patch_available&&!isNews&&<span style={{fontSize:12,color:"#00e676",fontFamily:"var(--mono)",background:"rgba(0,200,100,0.07)",padding:"4px 11px",border:"1px solid rgba(0,200,100,0.22)",borderRadius:3}}>✔ PATCH AVAILABLE</span>}
      </div>
      <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:12,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <span style={{fontSize:12,color:"rgba(200,220,240,0.3)",fontFamily:"var(--mono)",letterSpacing:1}}>🔗 VERIFY SOURCE</span>
        <a href={adv.source_url||"#"} target="_blank" rel="noopener noreferrer"
          style={{display:"inline-flex",alignItems:"center",gap:7,fontSize:13,color:ACCENT,fontFamily:"var(--mono)",background:"rgba(0,200,255,0.07)",border:`1px solid rgba(0,200,255,0.28)`,padding:"7px 16px",borderRadius:4,whiteSpace:"nowrap",fontWeight:600}}>
          {adv.source_flag} View on {adv.source} ↗
        </a>
      </div>
    </div>
  );
}

// ── Social / community post card ──────────────────────────────────────────────
function SocialCard({ post }) {
  const col=post.source_color||"#6364ff";
  const isFresh=post.ts&&(Date.now()-post.ts)<24*60*60*1000;
  return (
    <a href={post.source_url} target="_blank" rel="noopener noreferrer" className="card" style={{display:"block",background:"rgba(5,8,15,0.92)",border:`1px solid ${col}33`,borderLeft:`4px solid ${col}`,borderRadius:6,padding:"14px 18px",marginBottom:10}}>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:8}}>
        <span style={{fontSize:11,padding:"3px 10px",background:`${col}1f`,border:`1px solid ${col}66`,color:col,letterSpacing:1,fontFamily:"var(--mono)",borderRadius:3,fontWeight:700}}>{post.source_flag} {post.source.toUpperCase()}</span>
        {post.author&&<span style={{fontSize:12,color:"rgba(200,220,240,.55)",fontFamily:"var(--mono)"}}>{post.author}</span>}
        {post.exploit_in_wild&&<span style={{fontSize:11,padding:"3px 8px",background:"rgba(200,0,0,.15)",border:"1px solid #c0000055",color:"#ff4444",borderRadius:3,fontFamily:"var(--mono)"}}>⚡</span>}
        {isFresh&&<span style={{fontSize:10,padding:"3px 8px",background:"rgba(0,200,255,0.1)",border:"1px solid rgba(0,200,255,.4)",color:"#00c8ff",letterSpacing:1,fontFamily:"var(--mono)",borderRadius:3,fontWeight:800}}>● FRESH</span>}
        <span style={{fontSize:11,color:"rgba(200,220,240,.35)",marginLeft:"auto",fontFamily:"var(--mono)"}}>{timeAgo(post.ts)}</span>
      </div>
      <div style={{fontSize:14,color:"rgba(220,232,245,.85)",lineHeight:1.65}}>{post.summary}</div>
      {post.cve_ids?.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}>{post.cve_ids.map(c=><span key={c} style={{fontSize:11,color:ACCENT,fontFamily:"var(--mono)",background:"rgba(0,200,255,.07)",padding:"3px 9px",border:"1px solid rgba(0,200,255,.22)",borderRadius:3}}>{c}</span>)}</div>}
    </a>
  );
}

// ── AI Situation Summary card ─────────────────────────────────────────────────
function AIBriefCard({ brief }) {
  if(!brief) return null;
  if(brief.loading) return (
    <div style={{background:"linear-gradient(135deg,rgba(123,47,247,.10),rgba(0,200,255,.06))",border:"1px solid rgba(123,47,247,.3)",borderRadius:10,padding:"18px 22px",marginBottom:20}}>
      <div style={{fontSize:11,letterSpacing:3,color:"rgba(192,132,252,.8)",fontFamily:"var(--mono)",marginBottom:10}}>🤖 AI SITUATION SUMMARY</div>
      {[92,100,78].map((w,i)=><div key={i} style={{height:12,width:`${w}%`,borderRadius:6,background:"rgba(255,255,255,.06)",marginBottom:9,position:"relative",overflow:"hidden"}}><div style={{position:"absolute",inset:0,width:"50%",background:"linear-gradient(90deg,transparent,rgba(192,132,252,.25),transparent)",animation:"shimmer 1.4s infinite"}}/></div>)}
    </div>
  );
  if(!brief.brief) return null;
  return (
    <div style={{background:"linear-gradient(135deg,rgba(123,47,247,.12),rgba(0,200,255,.06))",border:"1px solid rgba(123,47,247,.35)",borderRadius:10,padding:"18px 22px",marginBottom:20,boxShadow:"0 0 30px rgba(123,47,247,.08)",animation:"fadeIn .4s ease"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:10}}>
        <div style={{fontSize:11,letterSpacing:3,color:"rgba(192,132,252,.85)",fontFamily:"var(--mono)"}}>🤖 AI SITUATION SUMMARY</div>
        <div style={{fontSize:10,color:"rgba(200,220,240,.35)",fontFamily:"var(--mono)"}}>Generated from {brief.items} items · {brief.sources} sources · Workers AI{brief.stale?" · cached":""}</div>
      </div>
      <div style={{fontSize:15,color:"rgba(230,238,250,.9)",lineHeight:1.8,fontWeight:400}}>{brief.brief}</div>
    </div>
  );
}

// ── GenAI / OWASP data ────────────────────────────────────────────────────────
const AI_KW=["artificial intelligence","machine learning"," llm ","large language","chatgpt","openai","copilot","gemini","claude ","anthropic","genai","generative ai","prompt injection","jailbreak","model theft","training data poisoning","deepfake","foundation model","ai-powered","ai vulnerability","agentic ai","gpt-","ai agent","chatbot security","voice cloning","ai fraud","ai phishing","ai scam","ai attack","owasp llm","llm security","stable diffusion","midjourney","dall-e","synthetic media","vector database","rag attack","mitre atlas","ai red team","model inversion","data poisoning","hallucination","llm guard","ai safety","ai governance","samsung chatgpt","indirect prompt"];

const OWASP_LLM=[
  {id:"LLM01",name:"Prompt Injection",risk:"CRITICAL",desc:"Attackers craft inputs that override system instructions, causing LLMs to perform unintended actions or leak sensitive data from the system prompt or context window."},
  {id:"LLM02",name:"Insecure Output Handling",risk:"HIGH",desc:"LLM outputs passed to downstream systems (shells, browsers, SQL engines) without sanitisation lead to RCE, XSS, or SQL injection vulnerabilities."},
  {id:"LLM03",name:"Training Data Poisoning",risk:"HIGH",desc:"Malicious actors corrupt training datasets to introduce backdoors, biases, or vulnerabilities into the deployed model's behaviour at inference time."},
  {id:"LLM04",name:"Model Denial of Service",risk:"HIGH",desc:"Resource-intensive prompts exhaust compute budgets, causing denial of service for legitimate users and inflating API costs at scale."},
  {id:"LLM05",name:"Supply Chain Vulnerabilities",risk:"HIGH",desc:"Compromised pre-trained models, third-party datasets, or plugins introduce malicious code throughout the AI development and deployment supply chain."},
  {id:"LLM06",name:"Sensitive Information Disclosure",risk:"CRITICAL",desc:"LLMs may reveal confidential data from training corpora, system prompts, or prior conversation context to adversaries through targeted queries."},
  {id:"LLM07",name:"Insecure Plugin Design",risk:"HIGH",desc:"LLM plugins with excessive permissions or insufficient input validation can be weaponised for data exfiltration or unauthorised system actions."},
  {id:"LLM08",name:"Excessive Agency",risk:"HIGH",desc:"Autonomous AI agents granted excessive permissions can take destructive or unauthorised real-world actions without adequate human oversight controls."},
  {id:"LLM09",name:"Overreliance",risk:"MEDIUM",desc:"Blind trust in AI outputs without human oversight leads to undetected errors, misinformation propagation, and exploitable security gaps in decision pipelines."},
  {id:"LLM10",name:"Model Theft",risk:"HIGH",desc:"Adversaries extract proprietary model weights or replicate model behaviour through systematic API querying, stealing valuable IP and enabling targeted attacks."},
];

// ── AI Security resources (curated from awesome-ai-security) ─────────────────
const AI_SECURITY_FRAMEWORKS=[
  {name:"OWASP LLM Top 10",flag:"🔟",url:"https://owasp.org/www-project-top-10-for-large-language-model-applications/",desc:"Most critical risks in LLM applications — map controls to every GenAI deployment."},
  {name:"MITRE ATLAS",flag:"🎯",url:"https://atlas.mitre.org/",desc:"Adversary tactics and techniques against AI systems — use for threat modelling."},
  {name:"NIST AI RMF",flag:"🇺🇸",url:"https://www.nist.gov/itl/ai-risk-management-framework",desc:"US framework to govern, map, measure, and manage AI risk."},
  {name:"NIST AI 600-1 (GenAI)",flag:"📋",url:"https://csrc.nist.gov/pubs/ai/600/1/e2023/final",desc:"Generative AI profile for the NIST AI Risk Management Framework."},
  {name:"ISO/IEC 42001",flag:"🌐",url:"https://www.iso.org/standard/81230.html",desc:"AI management system standard for enterprise governance and audit."},
  {name:"Google SAIF",flag:"☁️",url:"https://cloud.google.com/security/ai",desc:"Secure AI Framework — design patterns for safe AI on cloud."},
  {name:"Microsoft AI Red Team",flag:"🛡️",url:"https://learn.microsoft.com/en-us/security/ai-red-team/",desc:"Guidance for red teaming and security testing of AI systems."},
  {name:"EU AI Act",flag:"🇪🇺",url:"https://artificialintelligenceact.eu/",desc:"EU regulatory framework for high-risk and general-purpose AI."},
];
const AI_SECURITY_TOOLS=[
  {name:"LLM Guard",flag:"🛡️",url:"https://github.com/protectai/llm-guard",desc:"Open-source toolkit — prompt injection, PII, toxicity, and output scanning."},
  {name:"garak",flag:"🔍",url:"https://github.com/leondz/garak",desc:"LLM vulnerability scanner — jailbreaks, leakage, hallucination probes."},
  {name:"PyRIT",flag:"⚔️",url:"https://github.com/Azure/PyRIT",desc:"Microsoft's AI red teaming framework for automated adversarial testing."},
  {name:"NeMo Guardrails",flag:"🚧",url:"https://github.com/NVIDIA/NeMo-Guardrails",desc:"Programmable guardrails for LLM agents and tool-using apps."},
  {name:"Microsoft Presidio",flag:"🔒",url:"https://github.com/microsoft/presidio",desc:"Detect and anonymise PII before data reaches an LLM or logs."},
  {name:"AI Incident Database",flag:"📊",url:"https://incidentdatabase.ai/",desc:"Real-world AI failures — Samsung leaks, jailbreaks, misuse cases for briefings."},
  {name:"Awesome AI Security",flag:"⭐",url:"https://github.com/restuhaqza/awesome-ai-security",desc:"Master curated index — papers, tools, benchmarks, and community links."},
];

// ── CISO Weekly Brief ─────────────────────────────────────────────────────────
function CISOBriefView({ advisories, exploits, news }) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now); monday.setDate(now.getDate()-(day===0?6:day-1));
  const friday = new Date(monday); friday.setDate(monday.getDate()+4);
  const fmt = d => d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
  const weekRange = `${fmt(monday)} – ${fmt(friday)}`;

  const allItems=[...advisories,...exploits];
  const criticals=allItems.filter(a=>a.severity==="CRITICAL");
  const wildExploits=allItems.filter(a=>a.exploit_in_wild);
  const meItems=allItems.filter(a=>a.middle_east_relevance==="HIGH").slice(0,3);
  const threatActors=[...new Set(allItems.filter(a=>a.threat_actor).map(a=>a.threat_actor))];
  const patchNow=[...new Map(allItems.filter(a=>a.exploit_in_wild||a.severity==="CRITICAL").map(a=>[a.id,a])).values()].slice(0,5);
  const monitor=advisories.filter(a=>a.severity==="HIGH"&&!a.exploit_in_wild).slice(0,4);
  const watchList=news.slice(0,4);

  const sectors={};
  allItems.forEach(a=>{
    const txt=([...(a.affected_products||[]),a.title,a.summary]).join(" ").toLowerCase();
    if(/microsoft|windows|exchange|sharepoint|active directory|azure|office 365/.test(txt)) sectors["Enterprise IT (Microsoft)"]=(sectors["Enterprise IT (Microsoft)"]||0)+1;
    if(/fortinet|palo alto|cisco|vpn|firewall|juniper|checkpoint|ivanti|f5/.test(txt)) sectors["Network Security"]=(sectors["Network Security"]||0)+1;
    if(/sap|oracle|erp|banking|payment|swift/.test(txt)) sectors["ERP / Finance"]=(sectors["ERP / Finance"]||0)+1;
    if(/scada|ics|industrial|energy|oil|gas|critical infrastructure/.test(txt)) sectors["Critical Infrastructure"]=(sectors["Critical Infrastructure"]||0)+1;
    if(/android|apple|ios|mobile|iphone/.test(txt)) sectors["Mobile / Endpoints"]=(sectors["Mobile / Endpoints"]||0)+1;
    if(/linux|apache|nginx|kubernetes|docker|cloud|aws|gcp|container/.test(txt)) sectors["Cloud / Linux"]=(sectors["Cloud / Linux"]||0)+1;
  });
  const topSectors=Object.entries(sectors).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const riskLevel=criticals.length>5?"ELEVATED":criticals.length>2?"HIGH":"MODERATE";
  const riskColor=riskLevel==="ELEVATED"?"#ff4444":riskLevel==="HIGH"?"#ff9944":"#ffd700";

  const ActionRow=({item,label,labelColor,labelBg})=>(
    <div style={{background:"rgba(5,8,15,.92)",border:"1px solid rgba(255,255,255,.07)",borderLeft:`4px solid ${SEV_S[item.severity]?.border||"#444"}`,borderRadius:5,padding:"14px 16px",marginBottom:10}}>
      <div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"center",marginBottom:8}}>
        <span style={{fontSize:11,fontWeight:800,padding:"3px 10px",background:labelBg,border:`1px solid ${labelColor}`,color:labelColor,borderRadius:3,fontFamily:"var(--mono)",letterSpacing:1}}>{label}</span>
        <SevBadge sev={item.severity}/>
        {item.exploit_in_wild&&<span style={{fontSize:11,padding:"3px 8px",background:"rgba(200,0,0,.15)",border:"1px solid #c00000",color:"#ff4444",borderRadius:3,fontFamily:"var(--mono)"}}>⚡ WILD</span>}
        <span style={{fontSize:11,color:"rgba(200,220,240,.35)"}}>{item.source_flag} {item.source}</span>
      </div>
      <div style={{fontSize:14,fontWeight:700,color:"#eef4ff",marginBottom:6,lineHeight:1.4}}>{item.title}</div>
      {item.cve_ids?.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>{item.cve_ids.slice(0,3).map(c=><a key={c} href={`https://nvd.nist.gov/vuln/detail/${c}`} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:ACCENT,fontFamily:"var(--mono)",background:"rgba(0,200,255,.07)",padding:"3px 9px",border:"1px solid rgba(0,200,255,.22)",borderRadius:3}}>{c} ↗</a>)}</div>}
      <div style={{fontSize:13,color:"rgba(200,220,240,.55)",lineHeight:1.6}}>{(item.summary||"").slice(0,180)}{(item.summary||"").length>180?"…":""}</div>
    </div>
  );

  return (
    <div style={{maxWidth:820,margin:"0 auto",animation:"fadeIn .3s ease"}}>
      <div style={{background:"rgba(0,200,255,.04)",border:"1px solid rgba(0,200,255,.15)",borderRadius:8,padding:"22px 24px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontSize:11,letterSpacing:3,color:"rgba(0,200,255,.6)",marginBottom:6,fontFamily:"var(--mono)"}}>📋 CISO WEEKLY THREAT BRIEF</div>
          <div style={{fontSize:22,fontWeight:900,color:"#ddeeff",marginBottom:4}}>Executive Threat Summary</div>
          <div style={{fontSize:13,color:"rgba(200,220,240,.4)"}}>Week of {weekRange} · Vikas Pandita, Global Head of Security Architecture</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:11,letterSpacing:2,color:"rgba(200,220,240,.35)",fontFamily:"var(--mono)",marginBottom:4}}>OVERALL RISK LEVEL</div>
          <div style={{fontSize:26,fontWeight:900,color:riskColor,fontFamily:"var(--mono)"}}>{riskLevel}</div>
          <div style={{fontSize:11,color:"rgba(200,220,240,.3)"}}>{criticals.length} critical · {wildExploits.length} exploited in wild</div>
        </div>
      </div>

      <div style={{background:"rgba(123,47,247,.06)",border:"1px solid rgba(123,47,247,.2)",borderRadius:8,padding:"20px 22px",marginBottom:16}}>
        <div style={{fontSize:11,letterSpacing:3,color:"rgba(123,47,247,.8)",marginBottom:10,fontFamily:"var(--mono)"}}>SITUATION OVERVIEW</div>
        <div style={{fontSize:14,color:"rgba(200,220,240,.75)",lineHeight:1.85}}>
          This week's threat intelligence from <strong style={{color:ACCENT}}>{advisories.length+exploits.length+news.length} sources</strong> identifies <strong style={{color:"#ff4444"}}>{criticals.length} critical vulnerabilities</strong>, with <strong style={{color:"#ff9944"}}>{wildExploits.length} actively exploited in the wild</strong>.{threatActors.length>0&&<> Active ransomware / APT campaigns confirmed: <strong style={{color:"#c084fc"}}>{threatActors.slice(0,3).join(", ")}</strong>.</>}{" "}<strong style={{color:"#00e676"}}>{meItems.length} advisories</strong> carry direct GCC / Middle East risk.{topSectors.length>0&&<> Highest-exposure sectors: <strong style={{color:ACCENT}}>{topSectors.slice(0,3).map(s=>s[0]).join(", ")}</strong>.</>}
        </div>
      </div>

      <div style={{background:"rgba(123,47,247,.06)",border:"1px solid rgba(123,47,247,.25)",borderRadius:8,padding:"20px 22px",marginBottom:16}}>
        <div style={{fontSize:11,letterSpacing:3,color:"rgba(123,47,247,.85)",marginBottom:10,fontFamily:"var(--mono)"}}>🤖 AI SECURITY &amp; GOVERNANCE</div>
        <div style={{fontSize:14,color:"rgba(200,220,240,.75)",lineHeight:1.85}}>
          GenAI risk should be tracked alongside traditional CVE exposure. Align assessments to the{" "}
          <a href="https://owasp.org/www-project-top-10-for-large-language-model-applications/" target="_blank" rel="noopener noreferrer" style={{color:ACCENT2}}>OWASP LLM Top 10</a>
          {" "}and <a href="https://atlas.mitre.org/" target="_blank" rel="noopener noreferrer" style={{color:ACCENT2}}>MITRE ATLAS</a>
          {" "}for threat modelling. Use the{" "}
          <a href="https://www.nist.gov/itl/ai-risk-management-framework" target="_blank" rel="noopener noreferrer" style={{color:ACCENT2}}>NIST AI RMF</a>
          {" "}for governance. Review real-world failures in the{" "}
          <a href="https://incidentdatabase.ai/" target="_blank" rel="noopener noreferrer" style={{color:ACCENT2}}>AI Incident Database</a>
          {" "}(e.g. prompt injection, training-data leaks, agent over-permissioning). Full curated toolkit:{" "}
          <a href="https://github.com/restuhaqza/awesome-ai-security" target="_blank" rel="noopener noreferrer" style={{color:ACCENT2}}>Awesome AI Security ↗</a>
          {" "}· also in GenAI → Standards &amp; Tools.
        </div>
      </div>

      <div style={{fontSize:11,letterSpacing:3,color:"rgba(200,0,0,.7)",marginBottom:10,fontFamily:"var(--mono)"}}>🔴 PATCH NOW — CRITICAL &amp; ACTIVELY EXPLOITED</div>
      {patchNow.length===0
        ?<div style={{fontSize:14,color:"rgba(200,220,240,.3)",marginBottom:16,padding:"14px",background:"rgba(255,255,255,.02)",borderRadius:6}}>No critical/exploited items this period.</div>
        :patchNow.map(a=><ActionRow key={a.id} item={a} label="PATCH NOW" labelColor="#ff4444" labelBg="rgba(200,0,0,.15)"/>)}

      <div style={{fontSize:11,letterSpacing:3,color:"rgba(220,100,0,.7)",marginBottom:10,fontFamily:"var(--mono)",marginTop:20}}>🟡 MONITOR — HIGH SEVERITY</div>
      {monitor.length===0
        ?<div style={{fontSize:14,color:"rgba(200,220,240,.3)",marginBottom:16,padding:"14px",background:"rgba(255,255,255,.02)",borderRadius:6}}>No high-severity items this period.</div>
        :monitor.map(a=><ActionRow key={a.id} item={a} label="MONITOR" labelColor="#ff9944" labelBg="rgba(220,100,0,.12)"/>)}

      {topSectors.length>0&&<>
        <div style={{fontSize:11,letterSpacing:3,color:"rgba(0,200,255,.6)",marginBottom:10,fontFamily:"var(--mono)",marginTop:20}}>🏭 SECTOR EXPOSURE THIS WEEK</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
          {topSectors.map(([sector,count])=>{
            const pct=Math.round((count/(topSectors[0][1]||1))*100);
            return(
              <div key={sector} style={{flex:1,minWidth:140,background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.07)",borderRadius:6,padding:"14px 16px"}}>
                <div style={{fontSize:13,fontWeight:700,color:"#ddeeff",marginBottom:8}}>{sector}</div>
                <div style={{height:4,background:"rgba(255,255,255,.06)",borderRadius:2,overflow:"hidden",marginBottom:6}}><div style={{width:`${pct}%`,height:"100%",background:`linear-gradient(90deg,${ACCENT}55,${ACCENT})`,borderRadius:2}}/></div>
                <div style={{fontSize:11,color:"rgba(200,220,240,.4)",fontFamily:"var(--mono)"}}>{count} advisories</div>
              </div>
            );
          })}
        </div>
      </>}

      {threatActors.length>0&&<>
        <div style={{fontSize:11,letterSpacing:3,color:"rgba(192,132,252,.7)",marginBottom:10,fontFamily:"var(--mono)",marginTop:4}}>🎯 ACTIVE THREAT ACTORS</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>{threatActors.map(ta=><span key={ta} style={{fontSize:13,color:"#c084fc",fontFamily:"var(--mono)",background:"rgba(123,47,247,.09)",padding:"7px 14px",border:"1px solid rgba(123,47,247,.25)",borderRadius:4}}>{ta}</span>)}</div>
      </>}

      {meItems.length>0&&<>
        <div style={{fontSize:11,letterSpacing:3,color:"rgba(0,200,100,.6)",marginBottom:10,fontFamily:"var(--mono)",marginTop:4}}>🌍 GCC / MIDDLE EAST ALERT</div>
        {meItems.map(a=><ActionRow key={a.id} item={a} label="GCC RISK" labelColor="#00e676" labelBg="rgba(0,200,100,.1)"/>)}
      </>}

      <div style={{fontSize:11,letterSpacing:3,color:"rgba(0,200,255,.5)",marginBottom:10,fontFamily:"var(--mono)",marginTop:20}}>📰 WATCH — EMERGING INTELLIGENCE</div>
      {watchList.map(a=><ActionRow key={a.id} item={a} label="WATCH" labelColor="#64b5f6" labelBg="rgba(25,118,210,.12)"/>)}

      <div style={{padding:"14px 16px",background:"rgba(0,200,255,.03)",border:"1px solid rgba(0,200,255,.08)",borderRadius:6,marginTop:16,fontSize:12,color:"rgba(200,220,240,.35)",lineHeight:1.7}}>
        📋 Auto-generated from {advisories.length+exploits.length+news.length} live sources · BCyberAware by Vikas Pandita (Global Head of Security Architecture · TOGAF 9.2 · IIM Kozhikode EPGP) · Sources refresh every 2 hours
      </div>
    </div>
  );
}

// ── GenAI Security View ───────────────────────────────────────────────────────
function GenAISecurityView({ advisories, exploits, news }) {
  const [aiTab,setAiTab]=useState("overview");
  const isAI=item=>{
    const text=(item.title+" "+item.summary).toLowerCase();
    return AI_KW.some(kw=>text.includes(kw));
  };
  const aiAdvisories=advisories.filter(isAI);
  const aiExploits=exploits.filter(isAI);
  const aiNews=news.filter(isAI);
  const totalAI=aiAdvisories.length+aiExploits.length+aiNews.length;

  return (
    <div style={{animation:"fadeIn .3s ease"}}>
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{fontSize:13,letterSpacing:4,color:ACCENT2,marginBottom:8,fontFamily:"var(--mono)"}}>🤖 GENAI SECURITY INTELLIGENCE</div>
        <div style={{fontSize:22,fontWeight:900,color:"#ddeeff",marginBottom:6}}>AI &amp; LLM Threat Landscape</div>
        <div style={{fontSize:14,color:"rgba(200,220,240,.4)"}}>Curated by Vikas Pandita · GenAI Security Specialist</div>
      </div>

      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <StatCard label="AI Advisories" value={aiAdvisories.length} color={ACCENT2}/>
        <StatCard label="AI Exploits"   value={aiExploits.length}   color="#ff4444"/>
        <StatCard label="AI News Items" value={aiNews.length}       color="#e91e63"/>
        <StatCard label="Total AI Items" value={totalAI}            color={ACCENT}/>
      </div>

      <div style={{display:"flex",gap:4,marginBottom:16,borderBottom:"1px solid rgba(255,255,255,.07)",overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
        {[["overview","📊 Overview"],["owasp","🔟 OWASP LLM Top 10"],["resources","📚 Standards & Tools"],["feed","📡 Live AI Feed"]].map(([id,lbl])=>(
          <button key={id} onClick={()=>setAiTab(id)} style={{padding:"10px 18px",background:"transparent",border:"none",borderBottom:aiTab===id?`3px solid ${ACCENT2}`:"3px solid transparent",color:aiTab===id?ACCENT2:"rgba(200,220,240,.45)",fontSize:14,cursor:"pointer",fontFamily:"var(--mono)",fontWeight:aiTab===id?700:400,whiteSpace:"nowrap"}}>{lbl}</button>
        ))}
      </div>

      {aiTab==="overview"&&(
        <div>
          <div style={{fontSize:11,letterSpacing:3,color:"rgba(123,47,247,.7)",marginBottom:12,fontFamily:"var(--mono)"}}>AI THREAT CATEGORIES</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10,marginBottom:20}}>
            {[
              {icon:"💉",name:"Prompt Injection",         desc:"Crafted inputs override LLM system instructions to bypass safety controls or exfiltrate confidential data",risk:"CRITICAL",color:"#ff4444",bg:"rgba(200,0,0,.08)"},
              {icon:"🎭",name:"Deepfakes & Synthetic Media",desc:"AI-generated fake audio/video used for fraud, social engineering, and large-scale disinformation campaigns",risk:"HIGH",   color:"#ff9944",bg:"rgba(220,100,0,.08)"},
              {icon:"🕵️",name:"AI-Powered Phishing",      desc:"LLMs generating highly personalised, grammatically perfect phishing at scale in any language",             risk:"HIGH",   color:"#ff9944",bg:"rgba(220,100,0,.08)"},
              {icon:"☠️",name:"Training Data Poisoning",   desc:"Corrupting datasets to embed backdoors or malicious biases into production AI models before deployment",   risk:"HIGH",   color:"#ff9944",bg:"rgba(220,100,0,.08)"},
              {icon:"🔓",name:"Data Exfiltration via LLM", desc:"Extracting sensitive PII or IP through crafted prompts against RAG systems and vector databases",          risk:"CRITICAL",color:"#ff4444",bg:"rgba(200,0,0,.08)"},
              {icon:"🤖",name:"Rogue AI Agents",           desc:"Agentic AI with excessive permissions taking unauthorised real-world actions without human oversight",       risk:"HIGH",   color:"#ff9944",bg:"rgba(220,100,0,.08)"},
              {icon:"🧬",name:"Model Theft",               desc:"Stealing proprietary AI models via systematic API extraction or direct model-weight exfiltration",          risk:"HIGH",   color:"#ff9944",bg:"rgba(220,100,0,.08)"},
              {icon:"💰",name:"AI Fraud & Scams",          desc:"Voice cloning and AI personas used for financial fraud, BEC, and executive impersonation at scale",         risk:"HIGH",   color:"#ff9944",bg:"rgba(220,100,0,.08)"},
            ].map(t=>(
              <div key={t.name} style={{background:t.bg,border:`1px solid ${t.color}22`,borderLeft:`3px solid ${t.color}`,borderRadius:6,padding:"16px"}}>
                <div style={{fontSize:22,marginBottom:6}}>{t.icon}</div>
                <div style={{fontSize:14,fontWeight:700,color:"#eef4ff",marginBottom:5}}>{t.name}</div>
                <div style={{fontSize:12,color:"rgba(200,220,240,.5)",lineHeight:1.6,marginBottom:8}}>{t.desc}</div>
                <span style={{fontSize:11,fontWeight:800,padding:"3px 10px",background:"rgba(0,0,0,.2)",border:`1px solid ${t.color}`,color:t.color,borderRadius:3,fontFamily:"var(--mono)"}}>{t.risk}</span>
              </div>
            ))}
          </div>

          <div style={{background:"rgba(0,166,81,.06)",border:"1px solid rgba(0,166,81,.2)",borderRadius:8,padding:"20px 22px",marginBottom:16}}>
            <div style={{fontSize:11,letterSpacing:3,color:"rgba(0,200,100,.7)",marginBottom:10,fontFamily:"var(--mono)"}}>🌍 AI RISK FOR GCC / MIDDLE EAST ORGANISATIONS</div>
            {[
              {threat:"AI-Enhanced BEC & Wire Fraud",        impact:"GCC banking sector facing AI-generated executive voice cloning targeting fraudulent wire transfer approvals"},
              {threat:"Deepfake Government Communications",  impact:"AI-forged official communications targeting GCC public sector — verify all digital correspondence and requests"},
              {threat:"Arabic-Language AI Phishing",         impact:"LLMs now produce fluent Arabic phishing — language quality is no longer a reliable detection indicator"},
              {threat:"Smart City & ICS AI Attacks",         impact:"AI-optimised attacks on Vision 2030 and UAE smart city infrastructure (SCADA + AI convergence risk)"},
            ].map(r=>(
              <div key={r.threat} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:"1px solid rgba(0,200,100,.08)"}}>
                <span style={{color:"#00e676",flexShrink:0}}>▸</span>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:"#00e676",marginBottom:3}}>{r.threat}</div>
                  <div style={{fontSize:13,color:"rgba(200,220,240,.5)",lineHeight:1.6}}>{r.impact}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {aiTab==="owasp"&&(
        <div>
          <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(0,200,255,.1)",borderRadius:8,padding:"16px 20px",marginBottom:16,fontSize:13,color:"rgba(200,220,240,.5)",lineHeight:1.7}}>
            The <strong style={{color:ACCENT}}>OWASP Top 10 for LLM Applications</strong> defines the most critical security risks in large language model deployments. As a GenAI Security specialist, these are the controls every AI system must address before going to production.
          </div>
          <div style={{display:"grid",gap:10}}>
            {OWASP_LLM.map(item=>{
              const s=SEV_S[item.risk]||SEV_S.LOW;
              return(
                <div key={item.id} style={{background:"rgba(5,8,15,.92)",border:`1px solid ${s.border}33`,borderLeft:`4px solid ${s.border}`,borderRadius:6,padding:"16px 18px"}}>
                  <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:8,flexWrap:"wrap"}}>
                    <span style={{fontSize:13,fontWeight:900,color:ACCENT2,fontFamily:"var(--mono)",minWidth:52}}>{item.id}</span>
                    <span style={{fontSize:15,fontWeight:700,color:"#eef4ff"}}>{item.name}</span>
                    <SevBadge sev={item.risk}/>
                  </div>
                  <div style={{fontSize:13,color:"rgba(200,220,240,.6)",lineHeight:1.75}}>{item.desc}</div>
                </div>
              );
            })}
          </div>
          <div style={{padding:"12px 16px",background:"rgba(123,47,247,.05)",border:"1px solid rgba(123,47,247,.15)",borderRadius:6,marginTop:14,fontSize:12,color:"rgba(200,220,240,.4)",lineHeight:1.7}}>
            Source: <a href="https://owasp.org/www-project-top-10-for-large-language-model-applications/" target="_blank" rel="noopener noreferrer" style={{color:ACCENT2}}>OWASP Top 10 for LLM Applications ↗</a> · Curated for GCC practitioners by Vikas Pandita
          </div>
        </div>
      )}

      {aiTab==="resources"&&(
        <div>
          <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(123,47,247,.2)",borderRadius:8,padding:"16px 20px",marginBottom:16,fontSize:13,color:"rgba(200,220,240,.55)",lineHeight:1.75}}>
            Curated from{" "}
            <a href="https://github.com/restuhaqza/awesome-ai-security" target="_blank" rel="noopener noreferrer" style={{color:ACCENT2,fontWeight:600}}>Awesome AI Security ↗</a>
            {" "}— frameworks for governance and open tools for LLM red teaming, guardrails, and incident research. Use across BCyberAware, Threatforge, and SAR projects.
          </div>
          <div style={{fontSize:11,letterSpacing:3,color:"rgba(123,47,247,.7)",marginBottom:12,fontFamily:"var(--mono)"}}>FRAMEWORKS &amp; STANDARDS</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10,marginBottom:20}}>
            {AI_SECURITY_FRAMEWORKS.map(r=>(
              <a key={r.name} href={r.url} target="_blank" rel="noopener noreferrer" style={{display:"block",background:"rgba(5,8,15,.92)",border:"1px solid rgba(123,47,247,.2)",borderLeft:`4px solid ${ACCENT2}`,borderRadius:6,padding:"14px 16px",textDecoration:"none"}}>
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
                  <span style={{fontSize:18}}>{r.flag}</span>
                  <span style={{fontSize:14,fontWeight:700,color:"#eef4ff"}}>{r.name}</span>
                  <span style={{fontSize:11,color:ACCENT2,marginLeft:"auto",fontFamily:"var(--mono)"}}>↗</span>
                </div>
                <div style={{fontSize:12,color:"rgba(200,220,240,.5)",lineHeight:1.65}}>{r.desc}</div>
              </a>
            ))}
          </div>
          <div style={{fontSize:11,letterSpacing:3,color:"rgba(0,200,255,.6)",marginBottom:12,fontFamily:"var(--mono)"}}>TOOLS &amp; RESEARCH</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10}}>
            {AI_SECURITY_TOOLS.map(r=>(
              <a key={r.name} href={r.url} target="_blank" rel="noopener noreferrer" style={{display:"block",background:"rgba(5,8,15,.92)",border:"1px solid rgba(0,200,255,.15)",borderLeft:`4px solid ${ACCENT}`,borderRadius:6,padding:"14px 16px",textDecoration:"none"}}>
                <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
                  <span style={{fontSize:18}}>{r.flag}</span>
                  <span style={{fontSize:14,fontWeight:700,color:"#eef4ff"}}>{r.name}</span>
                  <span style={{fontSize:11,color:ACCENT,marginLeft:"auto",fontFamily:"var(--mono)"}}>↗</span>
                </div>
                <div style={{fontSize:12,color:"rgba(200,220,240,.5)",lineHeight:1.65}}>{r.desc}</div>
              </a>
            ))}
          </div>
        </div>
      )}

      {aiTab==="feed"&&(
        <div>
          {totalAI===0
            ?<div style={{textAlign:"center",padding:"40px",color:"rgba(200,220,240,.3)",fontSize:14}}>No AI-specific items in current feed. Try ⚡ Force Latest to refresh.</div>
            :<>
              {aiAdvisories.length>0&&<><div style={{fontSize:11,letterSpacing:2,color:"rgba(0,200,255,.5)",marginBottom:10,fontFamily:"var(--mono)"}}>🏛️ AI-RELATED ADVISORIES ({aiAdvisories.length})</div>{aiAdvisories.map(a=><AdvisoryCard key={a.id} adv={a}/>)}</>}
              {aiExploits.length>0&&<><div style={{fontSize:11,letterSpacing:2,color:"rgba(200,0,0,.6)",marginBottom:10,fontFamily:"var(--mono)",marginTop:16}}>⚡ AI-RELATED EXPLOITS ({aiExploits.length})</div>{aiExploits.map(a=><AdvisoryCard key={a.id} adv={a}/>)}</>}
              {aiNews.length>0&&<><div style={{fontSize:11,letterSpacing:2,color:"rgba(233,30,99,.6)",marginBottom:10,fontFamily:"var(--mono)",marginTop:16}}>📰 AI SECURITY NEWS ({aiNews.length})</div>{aiNews.map(a=><AdvisoryCard key={a.id} adv={a}/>)}</>}
            </>
          }
        </div>
      )}
    </div>
  );
}

// ── Dark Web Early Warning ─────────────────────────────────────────────────────
function DarkWebView() {
  const DW_RED    = "#ff1744";
  const DW_PURPLE = "#7c4dff";
  const DW_ORANGE = "#ff6d00";

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [tab,     setTab]     = useState("victims");

  const load = useCallback(async (force = false) => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(force ? "/api/darkweb?bust=1" : "/api/darkweb", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const victims      = data?.ransomware_victims || [];
  const groups       = data?.ransomware_groups  || [];
  const breaches     = data?.data_breaches      || [];
  const c2s          = data?.c2_servers         || [];
  const activeGroups = groups.filter(g => (g.status || "").toLowerCase().includes("activ")).length;

  const DWCard = ({ left, children }) => (
    <div style={{background:"rgba(5,8,15,.92)",border:`1px solid ${left}33`,borderLeft:`4px solid ${left}`,borderRadius:6,padding:"16px 18px",marginBottom:10}}>
      {children}
    </div>
  );

  const Tag = ({ color, bg, border, children }) => (
    <span style={{fontSize:12,fontWeight:800,padding:"3px 10px",background:bg||`${color}22`,border:`1px solid ${border||color}`,color,borderRadius:3,fontFamily:"var(--mono)",letterSpacing:1}}>{children}</span>
  );

  if (loading) return (
    <div style={{animation:"fadeIn .3s ease",textAlign:"center",padding:"60px 20px"}}>
      <div style={{fontSize:14,color:DW_RED,fontFamily:"var(--mono)",letterSpacing:3,animation:"pulse 1.5s infinite"}}>⟳ SCANNING DARK WEB SOURCES…</div>
      <div style={{fontSize:12,color:"rgba(200,220,240,.3)",marginTop:10}}>ransomware.live · HaveIBeenPwned · Cybercrime Tracker</div>
    </div>
  );

  if (error) return (
    <div style={{padding:"18px 20px",background:"rgba(200,0,0,.1)",border:"1px solid rgba(200,0,0,.3)",borderRadius:6,fontSize:14,color:"#ff6666"}}>
      ⚠ Dark web feed unavailable: {error}
      <button onClick={()=>load(true)} style={{marginLeft:14,padding:"4px 12px",background:"rgba(200,0,0,.15)",border:"1px solid rgba(200,0,0,.4)",color:"#ff6666",fontSize:12,cursor:"pointer",fontFamily:"var(--mono)",borderRadius:4}}>Retry</button>
    </div>
  );

  return (
    <div style={{animation:"fadeIn .3s ease"}}>

      {/* Warning Banner */}
      <div style={{background:"rgba(139,0,0,.12)",border:"1px solid rgba(255,23,68,.25)",borderRadius:8,padding:"18px 22px",marginBottom:20,display:"flex",alignItems:"flex-start",gap:16,flexWrap:"wrap"}}>
        <span style={{fontSize:30,flexShrink:0,lineHeight:1}}>🕵️</span>
        <div style={{flex:1,minWidth:260}}>
          <div style={{fontSize:15,fontWeight:900,color:DW_RED,marginBottom:6,letterSpacing:1.5,fontFamily:"var(--mono)"}}>DARK WEB EARLY WARNING SYSTEM</div>
          <div style={{fontSize:13,color:"rgba(200,220,240,.55)",lineHeight:1.75}}>
            Open-source dark web intelligence: ransomware leak sites, public breach notifications, and C2 server tracking.
            {" "}Sources: <strong style={{color:"rgba(200,220,240,.8)"}}>ransomware.live</strong> · <strong style={{color:"rgba(200,220,240,.8)"}}>HaveIBeenPwned</strong> · <strong style={{color:"rgba(200,220,240,.8)"}}>Cybercrime Tracker</strong> · No personal data lookups.
          </div>
        </div>
        <button onClick={()=>load(true)} disabled={loading} style={{flexShrink:0,padding:"7px 16px",background:"rgba(255,23,68,.1)",border:"1px solid rgba(255,23,68,.35)",color:DW_RED,fontSize:12,cursor:"pointer",fontFamily:"var(--mono)",borderRadius:4,fontWeight:700,whiteSpace:"nowrap"}}>⚡ Force Latest</button>
      </div>

      {/* Stats */}
      <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <StatCard label="Ransomware Victims"  value={victims.length}  color={DW_RED}    sub="Recent (leak sites)"/>
        <StatCard label="Active Groups"       value={activeGroups}    color="#ff4444"   sub="Ransomware Gangs"/>
        <StatCard label="Known Data Breaches" value={breaches.length} color={DW_PURPLE} sub="via HaveIBeenPwned"/>
        <StatCard label="C2 Servers Tracked"  value={c2s.length}      color={DW_ORANGE} sub="Cybercrime Tracker"/>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:16,borderBottom:"1px solid rgba(255,255,255,.07)",flexWrap:"wrap"}}>
        {[
          ["victims", `🎯 Ransomware Victims (${victims.length})`],
          ["groups",  `💀 Active Groups (${groups.length})`],
          ["breaches",`🔓 Data Breaches (${breaches.length})`],
          ["c2",      `🕷️ C2 Servers (${c2s.length})`],
        ].map(([id,lbl])=>(
          <button key={id} onClick={()=>setTab(id)} style={{padding:"10px 18px",background:"transparent",border:"none",borderBottom:tab===id?`3px solid ${DW_RED}`:"3px solid transparent",color:tab===id?DW_RED:"rgba(200,220,240,.45)",fontSize:14,cursor:"pointer",fontFamily:"var(--mono)",fontWeight:tab===id?700:400,whiteSpace:"nowrap"}}>{lbl}</button>
        ))}
      </div>

      {/* Ransomware Victims */}
      {tab==="victims"&&(
        victims.length===0
          ?<div style={{textAlign:"center",padding:"40px",color:"rgba(200,220,240,.3)",fontSize:14}}>No victim data loaded. Try ⚡ Force Latest.</div>
          :victims.map((v,i)=>(
            <DWCard key={i} left="#c00000">
              <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:10}}>
                <Tag color="#ff4444" bg="rgba(200,0,0,.15)" border="#c00000">🎯 RANSOMWARE VICTIM</Tag>
                <span style={{fontSize:12,color:"#c084fc",fontFamily:"var(--mono)",background:"rgba(123,47,247,.09)",padding:"3px 10px",border:"1px solid rgba(123,47,247,.25)",borderRadius:3}}>{v.group}</span>
                {v.country&&<span style={{fontSize:12,color:"rgba(200,220,240,.45)",fontFamily:"var(--mono)",padding:"3px 8px",border:"1px solid rgba(255,255,255,.1)",borderRadius:3}}>{v.country}</span>}
                {v.sector&&<span style={{fontSize:12,color:"rgba(200,220,240,.35)"}}>{v.sector}</span>}
                <span style={{fontSize:11,color:"rgba(200,220,240,.3)",marginLeft:"auto",fontFamily:"var(--mono)"}}>{v.date?new Date(v.date).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):""}</span>
              </div>
              <div style={{fontSize:16,fontWeight:700,color:"#eef4ff",marginBottom:v.description?8:0}}>{v.victim}</div>
              {v.description&&<div style={{fontSize:13,color:"rgba(200,220,240,.5)",lineHeight:1.75}}>{v.description}</div>}
              {v.website&&<div style={{marginTop:12,paddingTop:10,borderTop:"1px solid rgba(255,255,255,.05)"}}><span style={{fontSize:12,color:ACCENT,fontFamily:"var(--mono)",background:"rgba(0,200,255,.07)",padding:"4px 12px",border:"1px solid rgba(0,200,255,.22)",borderRadius:3}}>🌐 {v.website}</span></div>}
            </DWCard>
          ))
      )}

      {/* Active Groups */}
      {tab==="groups"&&(
        groups.length===0
          ?<div style={{textAlign:"center",padding:"40px",color:"rgba(200,220,240,.3)",fontSize:14}}>No group data loaded. Try ⚡ Force Latest.</div>
          :<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10}}>
            {groups.map((g,i)=>{
              const isActive=(g.status||"").toLowerCase().includes("activ");
              return(
                <div key={i} style={{background:"rgba(5,8,15,.92)",border:`1px solid ${isActive?"rgba(255,23,68,.2)":"rgba(255,255,255,.07)"}`,borderLeft:`4px solid ${isActive?"#c00000":"#333"}`,borderRadius:6,padding:"16px 18px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,gap:8}}>
                    <div style={{fontSize:15,fontWeight:700,color:"#eef4ff"}}>{g.name}</div>
                    <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",background:isActive?"rgba(200,0,0,.15)":"rgba(255,255,255,.04)",border:`1px solid ${isActive?"#c00000":"rgba(255,255,255,.1)"}`,color:isActive?"#ff4444":"rgba(200,220,240,.35)",borderRadius:3,fontFamily:"var(--mono)",flexShrink:0,whiteSpace:"nowrap"}}>{isActive?"● ACTIVE":"◌ INACTIVE"}</span>
                  </div>
                  {g.victim_count>0&&<><div style={{fontSize:30,fontWeight:900,color:isActive?"#ff4444":"rgba(200,220,240,.3)",fontFamily:"var(--mono)",lineHeight:1}}>{g.victim_count}</div><div style={{fontSize:10,color:"rgba(200,220,240,.3)",letterSpacing:2,fontFamily:"var(--mono)",marginTop:2,marginBottom:8}}>KNOWN VICTIMS</div></>}
                  {g.last_seen&&<div style={{fontSize:12,color:"rgba(200,220,240,.3)",marginBottom:4}}>Last seen: {g.last_seen}</div>}
                  {g.description&&<div style={{fontSize:12,color:"rgba(200,220,240,.4)",lineHeight:1.65,marginTop:6}}>{g.description}</div>}
                  {g.locations?.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:8}}>{g.locations.slice(0,3).map(loc=><span key={loc} style={{fontSize:10,color:"rgba(200,220,240,.35)",fontFamily:"var(--mono)",padding:"2px 6px",border:"1px solid rgba(255,255,255,.07)",borderRadius:2}}>{loc}</span>)}</div>}
                </div>
              );
            })}
          </div>
      )}

      {/* Data Breaches */}
      {tab==="breaches"&&(
        breaches.length===0
          ?<div style={{textAlign:"center",padding:"40px",color:"rgba(200,220,240,.3)",fontSize:14}}>No breach data loaded. Try ⚡ Force Latest.</div>
          :breaches.map((b,i)=>(
            <DWCard key={i} left="#7c4dff">
              <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:10}}>
                <Tag color="#b39ddb" bg="rgba(124,77,255,.15)" border="#7c4dff">🔓 DATA BREACH</Tag>
                {b.is_verified&&<Tag color="#ff6666" bg="rgba(200,0,0,.1)" border="rgba(200,0,0,.35)">✓ VERIFIED</Tag>}
                {b.is_sensitive&&<Tag color="#ff9944" bg="rgba(255,100,0,.1)" border="rgba(255,100,0,.3)">⚠ SENSITIVE</Tag>}
                <span style={{fontSize:11,color:"rgba(200,220,240,.35)",marginLeft:"auto",fontFamily:"var(--mono)"}}>{b.breach_date}</span>
              </div>
              <div style={{fontSize:16,fontWeight:700,color:"#eef4ff",marginBottom:4}}>{b.title}</div>
              {b.domain&&<div style={{fontSize:13,color:"rgba(0,200,255,.6)",fontFamily:"var(--mono)",marginBottom:8}}>{b.domain}</div>}
              {b.description&&<div style={{fontSize:13,color:"rgba(200,220,240,.5)",lineHeight:1.75,marginBottom:10}}>{b.description}</div>}
              {b.data_classes?.length>0&&<div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>{b.data_classes.map(dc=><span key={dc} style={{fontSize:11,color:"#b39ddb",fontFamily:"var(--mono)",background:"rgba(124,77,255,.09)",padding:"3px 9px",border:"1px solid rgba(124,77,255,.2)",borderRadius:3}}>{dc}</span>)}</div>}
              {b.pwn_count>0&&<div style={{fontSize:13,color:"rgba(200,220,240,.4)",fontFamily:"var(--mono)",borderTop:"1px solid rgba(255,255,255,.05)",paddingTop:8}}><span style={{color:"#ff4444",fontWeight:700}}>{b.pwn_count.toLocaleString()}</span> accounts compromised</div>}
            </DWCard>
          ))
      )}

      {/* C2 Servers */}
      {tab==="c2"&&(
        c2s.length===0
          ?<div style={{textAlign:"center",padding:"40px",color:"rgba(200,220,240,.3)",fontSize:14}}>No C2 data loaded. Try ⚡ Force Latest.</div>
          :c2s.map((c,i)=>(
            <DWCard key={i} left="#e65100">
              <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:8}}>
                <Tag color="#ff9944" bg="rgba(255,109,0,.12)" border="#e65100">🕷️ C2 SERVER</Tag>
                <span style={{fontSize:11,color:"rgba(200,220,240,.3)",fontFamily:"var(--mono)"}}>{c.date?new Date(c.date).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):""}</span>
              </div>
              <div style={{fontSize:15,fontWeight:700,color:"#eef4ff",marginBottom:c.description?6:0}}>{c.title}</div>
              {c.description&&<div style={{fontSize:13,color:"rgba(200,220,240,.5)",lineHeight:1.75}}>{c.description}</div>}
            </DWCard>
          ))
      )}

      {/* Footer */}
      <div style={{marginTop:20,padding:"12px 16px",background:"rgba(255,23,68,.04)",border:"1px solid rgba(255,23,68,.1)",borderRadius:6,fontSize:12,color:"rgba(200,220,240,.35)",lineHeight:1.75}}>
        🕵️ Sources: <strong style={{color:"rgba(200,220,240,.5)"}}>ransomware.live</strong> (public API) · <strong style={{color:"rgba(200,220,240,.5)"}}>HaveIBeenPwned</strong> (public breach list — no personal lookups) · <strong style={{color:"rgba(200,220,240,.5)"}}>Cybercrime Tracker</strong> (C2 RSS) · Cache: 2 hours · For awareness and defence only.
        {data?.fetched_at_human&&<span style={{marginLeft:8}}>· {data.fetched_at_human}</span>}
      </div>
    </div>
  );
}

// ── AI Threat Analyst (Cloudflare Workers AI · free tier · streaming) ─────────
const CHAT_SUGGESTIONS=[
  "Summarise today's critical threats",
  "What is being exploited in the wild right now?",
  "Which advisories matter for GCC / Middle East?",
  "Explain prompt injection and how to defend against it",
  "What should a CISO patch first this week?",
];

function renderMd(text){
  const inline=(s,k)=>s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p,i)=>
    p.startsWith("**")?<strong key={k+"-"+i} style={{color:"#eef4ff"}}>{p.slice(2,-2)}</strong>
    :p.startsWith("`")?<code key={k+"-"+i} style={{fontFamily:"var(--mono)",background:"rgba(0,200,255,.08)",padding:"1px 5px",borderRadius:3,color:ACCENT}}>{p.slice(1,-1)}</code>
    :p);
  return text.split("\n").map((line,i)=>{
    const t=line.trim();
    if(!t) return <div key={i} style={{height:6}}/>;
    if(/^#{1,4}\s/.test(t)) return <div key={i} style={{fontWeight:800,color:ACCENT,marginTop:8,marginBottom:3,fontSize:13,letterSpacing:.5}}>{inline(t.replace(/^#+\s/,""),i)}</div>;
    if(/^(?:[-*•]|\d+[.)])\s/.test(t)) return <div key={i} style={{display:"flex",gap:8,paddingLeft:4,marginBottom:3}}><span style={{color:ACCENT2,flexShrink:0}}>▸</span><span>{inline(t.replace(/^(?:[-*•]|\d+[.)])\s/,""),i)}</span></div>;
    return <div key={i} style={{marginBottom:4}}>{inline(t,i)}</div>;
  });
}

function ThreatAnalystChat(){
  const [open,setOpen]=useState(false);
  const [msgs,setMsgs]=useState([{role:"assistant",content:"👋 I'm the **BCyberAware Threat Analyst** — an AI grounded in the live feed on this dashboard.\n\nAsk me about today's advisories, active exploits, threat actors, or any cybersecurity topic."}]);
  const [input,setInput]=useState("");
  const [busy,setBusy]=useState(false);
  const [unread,setUnread]=useState(false);
  const endRef=React.useRef(null);
  const abortRef=React.useRef(null);

  useEffect(()=>{ if(open) endRef.current?.scrollIntoView({behavior:"smooth"}); },[msgs,open]);
  useEffect(()=>{ const t=setTimeout(()=>{ if(!open) setUnread(true); },6000); return ()=>clearTimeout(t); },[]);

  const send=async(text)=>{
    const q=(text??input).trim();
    if(!q||busy) return;
    setInput("");
    const history=[...msgs.filter((m,i)=>i>0),{role:"user",content:q}];
    setMsgs(m=>[...m,{role:"user",content:q},{role:"assistant",content:"",streaming:true}]);
    setBusy(true);
    const ctrl=new AbortController(); abortRef.current=ctrl;
    try{
      const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:history.slice(-8)}),signal:ctrl.signal});
      if(!r.ok){
        let e="Assistant unavailable"; try{e=(await r.json()).error||e;}catch{}
        throw new Error(e);
      }
      const reader=r.body.getReader(); const dec=new TextDecoder(); let buf="",acc="";
      while(true){
        const {done,value}=await reader.read(); if(done) break;
        buf+=dec.decode(value,{stream:true});
        const lines=buf.split("\n"); buf=lines.pop();
        for(const ln of lines){
          const s=ln.trim(); if(!s.startsWith("data:")) continue;
          const payload=s.slice(5).trim(); if(payload==="[DONE]") continue;
          try{ const j=JSON.parse(payload); if(j.response){ acc+=j.response; setMsgs(m=>{const c=[...m]; c[c.length-1]={role:"assistant",content:acc,streaming:true}; return c;}); } }catch{}
        }
      }
      setMsgs(m=>{const c=[...m]; c[c.length-1]={role:"assistant",content:acc||"_(no response)_"}; return c;});
    }catch(e){
      if(e.name!=="AbortError") setMsgs(m=>{const c=[...m]; c[c.length-1]={role:"assistant",content:"⚠ "+e.message,error:true}; return c;});
    }
    setBusy(false);
  };

  const stop=()=>{ abortRef.current?.abort(); setBusy(false); };

  return (
    <>
      {/* Floating launcher */}
      {!open&&(
        <button onClick={()=>{setOpen(true);setUnread(false);}} aria-label="Open AI Threat Analyst" style={{position:"fixed",right:20,bottom:20,zIndex:90,display:"flex",alignItems:"center",gap:10,padding:"12px 18px",borderRadius:30,border:`1px solid rgba(0,200,255,.45)`,background:"linear-gradient(135deg,rgba(0,40,70,.95),rgba(40,10,80,.95))",color:"#eef4ff",cursor:"pointer",boxShadow:"0 8px 32px rgba(0,200,255,.25)",fontFamily:"var(--mono)",fontWeight:700,fontSize:13,letterSpacing:.5,backdropFilter:"blur(8px)"}}>
          <span style={{fontSize:18}}>🛡️</span> Ask Threat Analyst
          {unread&&<span style={{width:9,height:9,borderRadius:"50%",background:"#00e676",boxShadow:"0 0 8px #00e676",animation:"pulse 1.4s infinite"}}/>}
        </button>
      )}

      {/* Chat panel */}
      {open&&(
        <div className="chat-panel" role="dialog" aria-label="AI Threat Analyst" style={{position:"fixed",right:20,bottom:20,zIndex:90,width:400,maxWidth:"calc(100vw - 24px)",height:600,maxHeight:"calc(100vh - 40px)",display:"flex",flexDirection:"column",background:"rgba(6,10,20,.97)",border:"1px solid rgba(0,200,255,.3)",borderRadius:14,boxShadow:"0 16px 60px rgba(0,0,0,.6), 0 0 30px rgba(0,200,255,.12)",overflow:"hidden",animation:"fadeIn .25s ease",backdropFilter:"blur(12px)"}}>
          {/* Header */}
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:"linear-gradient(90deg,rgba(0,200,255,.12),rgba(123,47,247,.14))",borderBottom:"1px solid rgba(0,200,255,.18)"}}>
            <span style={{fontSize:22}}>🛡️</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:800,color:"#eef4ff",letterSpacing:.5}}>Threat Analyst <span style={{fontSize:9,padding:"2px 6px",marginLeft:4,borderRadius:3,background:"rgba(0,230,118,.12)",border:"1px solid rgba(0,230,118,.4)",color:"#00e676",fontFamily:"var(--mono)",letterSpacing:1,verticalAlign:"middle"}}>AI</span></div>
              <div style={{fontSize:10,color:"rgba(200,220,240,.45)",fontFamily:"var(--mono)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>Grounded in live feed · Cloudflare Workers AI</div>
            </div>
            <button onClick={()=>setMsgs(msgs.slice(0,1))} title="Clear conversation" aria-label="Clear conversation" style={{background:"transparent",border:"1px solid rgba(255,255,255,.1)",color:"rgba(200,220,240,.5)",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:12}}>↺</button>
            <button onClick={()=>setOpen(false)} aria-label="Close" style={{background:"transparent",border:"1px solid rgba(255,255,255,.1)",color:"rgba(200,220,240,.6)",borderRadius:6,padding:"4px 9px",cursor:"pointer",fontSize:14,lineHeight:1}}>✕</button>
          </div>

          {/* Messages */}
          <div style={{flex:1,overflowY:"auto",padding:"14px 14px 6px",display:"flex",flexDirection:"column",gap:10}}>
            {msgs.map((m,i)=>(
              <div key={i} style={{alignSelf:m.role==="user"?"flex-end":"flex-start",maxWidth:"88%"}}>
                <div style={{fontSize:13.5,lineHeight:1.6,padding:"10px 13px",borderRadius:m.role==="user"?"14px 14px 4px 14px":"14px 14px 14px 4px",background:m.role==="user"?"linear-gradient(135deg,rgba(0,200,255,.18),rgba(0,200,255,.08))":m.error?"rgba(200,0,0,.12)":"rgba(255,255,255,.04)",border:`1px solid ${m.role==="user"?"rgba(0,200,255,.35)":m.error?"rgba(200,0,0,.35)":"rgba(255,255,255,.08)"}`,color:m.error?"#ff8a80":"rgba(220,232,245,.92)",wordBreak:"break-word"}}>
                  {m.role==="assistant"?renderMd(m.content):m.content}
                  {m.streaming&&<span style={{display:"inline-block",width:7,height:14,background:ACCENT,marginLeft:3,verticalAlign:"text-bottom",animation:"pulse .8s infinite"}}/>}
                </div>
              </div>
            ))}
            {msgs.length===1&&(
              <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:4}}>
                <div style={{fontSize:10,letterSpacing:2,color:"rgba(200,220,240,.3)",fontFamily:"var(--mono)"}}>TRY ASKING</div>
                {CHAT_SUGGESTIONS.map(s=>(
                  <button key={s} onClick={()=>send(s)} style={{textAlign:"left",padding:"8px 12px",fontSize:12.5,background:"rgba(123,47,247,.08)",border:"1px solid rgba(123,47,247,.25)",color:"#d1c4e9",borderRadius:8,cursor:"pointer"}}>› {s}</button>
                ))}
              </div>
            )}
            <div ref={endRef}/>
          </div>

          {/* Composer */}
          <form onSubmit={e=>{e.preventDefault();send();}} style={{display:"flex",gap:8,padding:"10px 12px",borderTop:"1px solid rgba(255,255,255,.07)",background:"rgba(0,0,0,.3)"}}>
            <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Ask about a CVE, threat actor, or today's feed…" maxLength={1200} disabled={busy} aria-label="Message"
              style={{flex:1,padding:"10px 12px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(0,200,255,.2)",borderRadius:8,color:"#eef4ff",fontSize:13.5,outline:"none",fontFamily:"inherit"}}/>
            {busy
              ?<button type="button" onClick={stop} style={{padding:"0 14px",background:"rgba(200,0,0,.15)",border:"1px solid rgba(200,0,0,.4)",color:"#ff6666",borderRadius:8,cursor:"pointer",fontFamily:"var(--mono)",fontWeight:700,fontSize:12}}>■</button>
              :<button type="submit" disabled={!input.trim()} style={{padding:"0 16px",background:input.trim()?"linear-gradient(135deg,#00c8ff,#7b2ff7)":"rgba(255,255,255,.05)",border:"none",color:input.trim()?"#fff":"rgba(255,255,255,.25)",borderRadius:8,cursor:input.trim()?"pointer":"not-allowed",fontWeight:800,fontSize:14}}>➤</button>}
          </form>
          <div style={{padding:"5px 12px 8px",fontSize:10,color:"rgba(200,220,240,.28)",textAlign:"center",fontFamily:"var(--mono)"}}>AI can make mistakes — verify against the linked sources.</div>
        </div>
      )}
    </>
  );
}

function BCyberAwareDashboard() {
  const [advisories,setAdvisories] = useState([]);
  const [exploits,  setExploits]   = useState([]);
  const [news,      setNews]       = useState([]);
  const [breaking,  setBreaking]   = useState([]);
  const [social,    setSocial]     = useState([]);
  const [brief,     setBrief]      = useState(null);
  const [heatmap,   setHeatmap]    = useState([]);
  const [feedMeta,  setFeedMeta]   = useState(null);
  const [loading,   setLoading]    = useState(true);
  const [feedError, setFeedError]  = useState(null);
  const [filterSev, setFilterSev]  = useState("All");
  const [filterME,  setFilterME]   = useState(false);
  const [filterExp, setFilterExp]  = useState(false);
  const [view,      setView]       = useState("feed");
  const [feedTab,   setFeedTab]    = useState("advisories");

  const refreshFeed = useCallback(async(force=false)=>{
    setLoading(true); setFeedError(null);
    try {
      const data = await loadFeed(force);
      setAdvisories(data.advisories||[]);
      setExploits(data.exploits||[]);
      setNews(data.news||[]);
      setBreaking(data.breaking||[]);
      setSocial(data.social||[]);
      setHeatmap(data.heatmap||[]);
      setFeedMeta(data);
    } catch(e) { setFeedError("Could not reach live feed: "+e.message); }
    setLoading(false);
  },[]);

  useEffect(()=>{ refreshFeed(); },[]);

  // AI Situation Summary — generated server-side once per feed snapshot
  useEffect(()=>{
    if(!feedMeta) return;
    let cancelled=false;
    setBrief({loading:true});
    fetch(`${PROXY}?action=brief`,{cache:"no-store"}).then(r=>r.json()).then(d=>{ if(!cancelled) setBrief(d); }).catch(()=>{ if(!cancelled) setBrief(null); });
    return ()=>{cancelled=true;};
  },[feedMeta?.fetched_at]);

  const applyFilters = arr => arr
    .filter(a=>{
      if(filterSev!=="All"&&a.severity!==filterSev) return false;
      if(filterME&&a.middle_east_relevance!=="HIGH") return false;
      if(filterExp&&!a.exploit_in_wild)              return false;
      return true;
    })
    .sort((a,b)=>SEV_ORDER.indexOf(a.severity)-SEV_ORDER.indexOf(b.severity));

  const fAdvisories = applyFilters(advisories);
  const fExploits   = applyFilters(exploits);
  const allItems    = [...advisories,...exploits,...news,...social];
  const counts      = {CRITICAL:0,HIGH:0,MEDIUM:0,LOW:0};
  advisories.forEach(a=>{if(counts[a.severity]!==undefined)counts[a.severity]++;});

  const FLAGS={US:"🇺🇸",GB:"🇬🇧",CN:"🇨🇳",RU:"🇷🇺",IN:"🇮🇳",DE:"🇩🇪",AU:"🇦🇺",CA:"🇨🇦",FR:"🇫🇷",IR:"🇮🇷",KP:"🇰🇵",AE:"🇦🇪",SA:"🇸🇦",QA:"🇶🇦",KW:"🇰🇼",PK:"🇵🇰",UA:"🇺🇦",BR:"🇧🇷",JP:"🇯🇵",KR:"🇰🇷",NL:"🇳🇱",SG:"🇸🇬",TR:"🇹🇷",IL:"🇮🇱",ZA:"🇿🇦",NG:"🇳🇬",MX:"🇲🇽"};

  const navBtn=(v,l)=>(
    <button key={v} onClick={()=>setView(v)} style={{padding:"5px 10px",whiteSpace:"nowrap",background:view===v?"rgba(0,200,255,0.1)":"transparent",border:`1px solid ${view===v?"rgba(0,200,255,0.35)":"rgba(255,255,255,0.08)"}`,color:view===v?ACCENT:"rgba(200,220,240,0.45)",fontSize:12,letterSpacing:.5,cursor:"pointer",fontFamily:"var(--mono)",borderRadius:4,fontWeight:view===v?700:400}}>{l}</button>
  );

  const SOURCES_DATA=[
    {name:"CISA KEV",cat:"Advisory",flag:"🇺🇸",url:"https://www.cisa.gov/known-exploited-vulnerabilities-catalog",desc:"Actively exploited vulnerabilities — updated continuously by US CISA."},
    {name:"CISA Alerts",cat:"Advisory",flag:"🇺🇸",url:"https://www.cisa.gov/news-events/cybersecurity-advisories",desc:"Full US-CERT security alerts and advisories from the US government."},
    {name:"NVD / CVE.org",cat:"Advisory",flag:"🌐",url:"https://nvd.nist.gov",desc:"NIST National Vulnerability Database — critical CVEs published in the last 30 days."},
    {name:"CERT-In (India)",cat:"Advisory",flag:"🇮🇳",url:"https://www.cert-in.org.in",desc:"India's national CERT — enterprise software advisories."},
    {name:"NCSC UK",cat:"Advisory",flag:"🇬🇧",url:"https://www.ncsc.gov.uk",desc:"UK National Cyber Security Centre — official news, guidance and threat reports."},
    {name:"CERT-EU",cat:"Advisory",flag:"🇪🇺",url:"https://cert.europa.eu",desc:"EU institutions' CERT — security advisories for European enterprise software."},
    {name:"Microsoft Security",cat:"Advisory",flag:"🇺🇸",url:"https://www.microsoft.com/en-us/security/blog/",desc:"Microsoft Security blog — threat research, patches and nation-state tracking."},
    {name:"Exploit-DB",cat:"Exploit",flag:"⚡",url:"https://www.exploit-db.com",desc:"Public exploit database — proof-of-concept exploits for known vulnerabilities."},
    {name:"ZDI 0-Day Pipeline",cat:"Exploit",flag:"🧨",url:"https://www.zerodayinitiative.com/advisories/upcoming/",desc:"Trend Micro Zero Day Initiative — vulnerabilities awaiting vendor disclosure (pre-patch 0-days)."},
    {name:"The Hacker News",cat:"News",flag:"📰",url:"https://thehackernews.com",desc:"Leading cybersecurity news — APTs, data breaches, and vulnerabilities."},
    {name:"Bleeping Computer",cat:"News",flag:"📰",url:"https://www.bleepingcomputer.com",desc:"Breaking security news — ransomware, malware, and incident reports."},
    {name:"The Record",cat:"News",flag:"🎙️",url:"https://therecord.media",desc:"Recorded Future News — nation-state operations, ransomware and policy."},
    {name:"CyberScoop",cat:"News",flag:"📰",url:"https://cyberscoop.com",desc:"US government and enterprise cybersecurity journalism."},
    {name:"Security Affairs",cat:"News",flag:"📰",url:"https://securityaffairs.com",desc:"High-frequency global breach, APT and hacktivism coverage by Pierluigi Paganini."},
    {name:"HackRead",cat:"News",flag:"📰",url:"https://hackread.com",desc:"Global hacking news — breaches, dark web and cybercrime."},
    {name:"The Register Security",cat:"News",flag:"🇬🇧",url:"https://www.theregister.com/security/",desc:"UK tech press security desk — incidents, patches and industry analysis."},
    {name:"SANS ISC",cat:"News",flag:"🔍",url:"https://isc.sans.edu",desc:"SANS Internet Storm Center — daily threat intelligence and handler diaries."},
    {name:"SecurityWeek",cat:"News",flag:"📰",url:"https://www.securityweek.com",desc:"Enterprise security news covering vulnerabilities, threats and industry trends."},
    {name:"Krebs on Security",cat:"News",flag:"📰",url:"https://krebsonsecurity.com",desc:"In-depth security news and investigation by Brian Krebs."},
    {name:"Cisco Talos",cat:"News",flag:"🛡️",url:"https://blog.talosintelligence.com",desc:"Cisco Talos threat research — malware, campaigns, and enterprise threats."},
    {name:"Unit 42 (Palo Alto)",cat:"News",flag:"🔬",url:"https://unit42.paloaltonetworks.com",desc:"Palo Alto Networks threat research — APTs, ransomware gangs and cloud threats."},
    {name:"Check Point Research",cat:"News",flag:"🔬",url:"https://research.checkpoint.com",desc:"Check Point threat research — malware reverse engineering and campaign tracking."},
    {name:"Dark Reading",cat:"News",flag:"📰",url:"https://www.darkreading.com",desc:"Enterprise security news — vulnerabilities, cloud, and risk for global SOCs."},
    {name:"GBHackers",cat:"News",flag:"📰",url:"https://gbhackers.com",desc:"Daily hacking news — exploits, tools and vulnerability write-ups."},
    {name:"Google Project Zero",cat:"News",flag:"🔬",url:"https://googleprojectzero.blogspot.com",desc:"Elite vulnerability research — zero-days and exploit analysis."},
    {name:"Malwarebytes Labs",cat:"News",flag:"📰",url:"https://www.malwarebytes.com/blog",desc:"Malware trends, ransomware families, and threat actor activity."},
    {name:"Help Net Security",cat:"News",flag:"📰",url:"https://www.helpnetsecurity.com",desc:"Daily cybersecurity news for practitioners and CISOs."},
    {name:"Infosecurity Magazine",cat:"News",flag:"📰",url:"https://www.infosecurity-magazine.com",desc:"European and global infosec news — regulations, breaches, and defence."},
    {name:"Schneier on Security",cat:"News",flag:"📰",url:"https://www.schneier.com",desc:"Bruce Schneier — security analysis, cryptography and policy commentary."},
    {name:"Ars Technica Security",cat:"News",flag:"📰",url:"https://arstechnica.com/security/",desc:"In-depth technical security coverage (filtered from Ars feed)."},
    {name:"Telegram: DarkFeed",cat:"News",flag:"📡",url:"https://t.me/secharvester",desc:"Public Telegram threat intelligence channel — no login required."},
    {name:"The Hindu Tech",cat:"News",flag:"🇮🇳",url:"https://www.thehindu.com/sci-tech/technology/",desc:"India's most credible newspaper — cybersecurity filtered feed."},
    {name:"Economic Times IT",cat:"News",flag:"🇮🇳",url:"https://economictimes.indiatimes.com/tech",desc:"India's leading business newspaper — covers RBI cyber alerts, DPDP Act, MeitY."},
    {name:"infosec.exchange (Mastodon)",cat:"Social",flag:"🐘",url:"https://infosec.exchange",desc:"The infosec community's Mastodon home — public timeline, keyword-filtered for security relevance."},
    {name:"Mastodon #cybersecurity",cat:"Social",flag:"🐘",url:"https://mastodon.social/tags/cybersecurity",desc:"Federated #cybersecurity hashtag stream from mastodon.social."},
    {name:"Bluesky",cat:"Social",flag:"🦋",url:"https://bsky.app/search?q=cybersecurity",desc:"Latest cybersecurity posts via Bluesky's public AppView API."},
    {name:"Hacker News (YC)",cat:"Social",flag:"🟠",url:"https://news.ycombinator.com",desc:"Security stories trending on Hacker News (Algolia API, ≥3 points)."},
    {name:"Reddit r/netsec",cat:"Social",flag:"👽",url:"https://www.reddit.com/r/netsec/",desc:"Technical information-security community — research, write-ups and tooling."},
    {name:"Awesome AI Security",cat:"AI Security",flag:"⭐",url:"https://github.com/restuhaqza/awesome-ai-security",desc:"Curated master index — frameworks, LLM tools, papers, benchmarks, and AI incident research."},
    {name:"AI Incident Database",cat:"AI Security",flag:"📊",url:"https://incidentdatabase.ai/",desc:"Real-world AI system failures and misuse cases for executive briefings."},
    {name:"MITRE ATLAS",cat:"AI Security",flag:"🎯",url:"https://atlas.mitre.org/",desc:"Adversarial threat landscape for AI — tactics and techniques knowledge base."},
    {name:"NIST AI RMF",cat:"AI Security",flag:"🇺🇸",url:"https://www.nist.gov/itl/ai-risk-management-framework",desc:"US AI risk management framework for governance and compliance."},
    {name:"OWASP LLM Top 10",cat:"AI Security",flag:"🔟",url:"https://owasp.org/www-project-top-10-for-large-language-model-applications/",desc:"Top 10 critical risks for LLM applications — also built into GenAI tab."},
  ];
  const healthByName={};
  (feedMeta?.source_health||[]).forEach(h=>{healthByName[h.name]=h;});

  return (
    <div style={{minHeight:"100vh",background:"#05080f"}}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes shimmer{0%{left:-60%}100%{left:120%}}
        @keyframes glow{0%,100%{opacity:.7}50%{opacity:1}}
        @keyframes tickerScroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        .ticker-track:hover{animation-play-state:paused}
        @media(max-width:520px){.chat-panel{right:0 !important;bottom:0 !important;width:100vw !important;max-width:100vw !important;height:100vh !important;max-height:100vh !important;border-radius:0 !important}}
        button:hover{opacity:.85}
      `}</style>

      {/* ── Top Bar ── */}
      <div style={{background:"rgba(0,0,0,.7)",borderBottom:"1px solid rgba(0,200,255,.1)",position:"sticky",top:0,zIndex:50,backdropFilter:"blur(8px)"}}>
        <div className="topbar" style={{maxWidth:1400,margin:"0 auto",padding:"8px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",minHeight:58,gap:10,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
            <img src="logo.svg" alt="BCyberAware Logo" style={{width:36,height:36,objectFit:"contain"}} />
            <div>
              <div style={{fontSize:15,fontWeight:900,color:ACCENT,letterSpacing:1.5,lineHeight:1.1,fontFamily:"var(--display)"}}>BCyberAware</div>
              <div style={{fontSize:9,color:"rgba(200,220,240,.4)",letterSpacing:1}}>by Vikas Pandita</div>
            </div>
          </div>
          <nav className="topnav" aria-label="Main navigation" style={{display:"flex",gap:4,flex:"1 1 auto",overflowX:"auto",WebkitOverflowScrolling:"touch",padding:"4px 0",justifyContent:"center"}}>
            {[["feed","▦ Live Feed"],["heatmap","🌍 Heatmap"],["ciso","📋 CISO Brief"],["genai","🤖 GenAI"],["darkweb","🕵️ Dark Web"],["sources","◎ Sources"],["demo","▶ Demo"],["about","◉ About"]].map(([v,l])=>navBtn(v,l))}
          </nav>
          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            {loading?(
              <span style={{fontSize:11,color:ACCENT,animation:"pulse 1.5s infinite",fontFamily:"var(--mono)",whiteSpace:"nowrap"}}>⟳ Fetching…</span>
            ):(
              feedMeta&&<span className="feed-meta" style={{fontSize:10,color:"rgba(200,220,240,.28)",fontFamily:"var(--mono)",whiteSpace:"nowrap"}}>{feedMeta.from_cache?"⚡":"🔄"} {feedMeta.fetched_at_human}</span>
            )}
            <button onClick={()=>refreshFeed(false)} disabled={loading} style={{padding:"5px 12px",background:"transparent",border:`1px solid rgba(0,200,255,.3)`,color:ACCENT,fontSize:12,cursor:loading?"not-allowed":"pointer",fontFamily:"var(--mono)",opacity:loading?.4:1,borderRadius:4,fontWeight:600,whiteSpace:"nowrap"}}>⟳ Refresh</button>
            <button onClick={()=>refreshFeed(true)} disabled={loading} style={{padding:"5px 12px",background:"rgba(255,100,0,.08)",border:`1px solid rgba(255,100,0,.35)`,color:"#ff9944",fontSize:12,cursor:loading?"not-allowed":"pointer",fontFamily:"var(--mono)",opacity:loading?.4:1,borderRadius:4,fontWeight:600,whiteSpace:"nowrap"}}>⚡ Force Latest</button>
          </div>
        </div>
      </div>

      {/* ── Breaking News Ticker ── */}
      <BreakingTicker items={breaking}/>

      <div style={{maxWidth:1150,margin:"0 auto",padding:"22px 20px"}}>

        {/* ══ LIVE FEED ══ */}
        {view==="feed"&&(
          <div style={{animation:"fadeIn .3s ease"}}>
            <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
              <StatCard label="Total Items"   value={allItems.length}   color={ACCENT}/>
              <StatCard label="Fresh (24h)"   value={allItems.filter(a=>a.ts&&(Date.now()-a.ts)<24*60*60*1000).length} color="#00e5ff" sub="Last 24 hours"/>
              <StatCard label="Critical"      value={counts.CRITICAL}   color="#ff4444"/>
              <StatCard label="Exploits"      value={exploits.length}   color="#ff4444" sub="Incl. 0-day pipeline"/>
              <StatCard label="Security News" value={news.length}       color="#e91e63"/>
              <StatCard label="GCC High Risk" value={[...advisories,...exploits].filter(a=>a.middle_east_relevance==="HIGH").length} color="#00e676" sub="Middle East"/>
              {feedMeta?.sources_live!=null&&<StatCard label="Sources Live" value={`${feedMeta.sources_live}/${feedMeta.sources_total}`} color="#00e676" sub="Real telemetry"/>}
            </div>
            {loading&&(
              <div style={{height:3,background:"rgba(0,200,255,.07)",overflow:"hidden",position:"relative",borderRadius:2,marginBottom:16}}>
                <div style={{position:"absolute",height:"100%",width:"55%",background:`linear-gradient(90deg,transparent,${ACCENT},transparent)`,animation:"shimmer 1.4s infinite"}}/>
              </div>
            )}
            {feedError&&<div style={{padding:"14px 18px",background:"rgba(200,0,0,.1)",border:"1px solid rgba(200,0,0,.3)",borderRadius:6,marginBottom:16,fontSize:14,color:"#ff6666"}}>⚠ {feedError}</div>}
            <AIBriefCard brief={brief}/>
            <div style={{display:"flex",gap:4,marginBottom:16,borderBottom:"1px solid rgba(255,255,255,.07)",overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
              {[["advisories",`🏛️ Advisories (${advisories.length})`],["exploits",`⚡ Exploits (${exploits.length})`],["news",`📰 Security News (${news.length})`],["social",`💬 Social Intel (${social.length})`]].map(([id,lbl])=>(
                <button key={id} onClick={()=>setFeedTab(id)} style={{padding:"10px 18px",background:"transparent",border:"none",borderBottom:feedTab===id?`3px solid ${ACCENT}`:"3px solid transparent",color:feedTab===id?ACCENT:"rgba(200,220,240,.45)",fontSize:14,letterSpacing:.5,cursor:"pointer",fontFamily:"var(--mono)",fontWeight:feedTab===id?700:400,whiteSpace:"nowrap"}}>{lbl}</button>
              ))}
            </div>
            {feedTab!=="news"&&feedTab!=="social"&&(
              <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:16,alignItems:"center"}}>
                <span style={{fontSize:12,color:"rgba(200,220,240,.3)",letterSpacing:1.5,fontFamily:"var(--mono)"}}>FILTER:</span>
                {["All","CRITICAL","HIGH","MEDIUM","LOW"].map(s=>{
                  const ss=SEV_S[s];
                  return <button key={s} onClick={()=>setFilterSev(s)} style={{padding:"5px 14px",fontSize:13,cursor:"pointer",fontFamily:"var(--mono)",background:filterSev===s?(ss?.bg||"rgba(0,200,255,.09)"):"transparent",border:`1px solid ${filterSev===s?(ss?.border||ACCENT):"rgba(255,255,255,.1)"}`,color:filterSev===s?(ss?.text||ACCENT):"rgba(200,220,240,.45)",borderRadius:4,fontWeight:filterSev===s?700:400}}>{s}</button>;
                })}
                <div style={{width:1,height:18,background:"rgba(255,255,255,.08)"}}/>
                <button onClick={()=>setFilterME(!filterME)} style={{padding:"5px 14px",fontSize:13,cursor:"pointer",fontFamily:"var(--mono)",background:filterME?"rgba(0,166,81,.12)":"transparent",border:`1px solid ${filterME?"#00a651":"rgba(255,255,255,.1)"}`,color:filterME?"#00e676":"rgba(200,220,240,.45)",borderRadius:4,fontWeight:filterME?700:400}}>🌍 GCC / Middle East</button>
                <button onClick={()=>setFilterExp(!filterExp)} style={{padding:"5px 14px",fontSize:13,cursor:"pointer",fontFamily:"var(--mono)",background:filterExp?"rgba(200,0,0,.12)":"transparent",border:`1px solid ${filterExp?"#c00000":"rgba(255,255,255,.1)"}`,color:filterExp?"#ff4444":"rgba(200,220,240,.45)",borderRadius:4,fontWeight:filterExp?700:400}}>⚡ Exploit in Wild</button>
              </div>
            )}
            {feedTab==="advisories"&&fAdvisories.map(a=><AdvisoryCard key={a.id} adv={a}/>)}
            {feedTab==="exploits"  &&fExploits.map(a=><AdvisoryCard key={a.id} adv={a}/>)}
            {feedTab==="news"      &&news.map(a=><AdvisoryCard key={a.id} adv={a}/>)}
            {feedTab==="social"    &&(
              <>
                <div style={{padding:"12px 16px",background:"rgba(99,100,255,.06)",border:"1px solid rgba(99,100,255,.2)",borderRadius:6,marginBottom:14,fontSize:12.5,color:"rgba(200,220,240,.55)",lineHeight:1.7}}>
                  💬 What the security community is talking about right now — infosec.exchange (Mastodon), Bluesky, Hacker News and r/netsec. Keyword-filtered for security relevance · community posts, not verified intelligence.
                </div>
                {social.length===0
                  ?<div style={{textAlign:"center",padding:"40px",color:"rgba(200,220,240,.3)",fontSize:14}}>No social posts loaded yet.</div>
                  :social.map(p=><SocialCard key={p.id} post={p}/>)}
              </>
            )}
          </div>
        )}

        {/* ══ HEATMAP ══ */}
        {view==="heatmap"&&(
          <div style={{animation:"fadeIn .3s ease"}}>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{fontSize:13,letterSpacing:4,color:ACCENT,marginBottom:8,fontFamily:"var(--mono)"}}>🌍 GLOBAL THREAT HEATMAP</div>
              <div style={{fontSize:14,color:"rgba(200,220,240,.45)",marginBottom:4}}>Countries ranked by threat activity · Refreshed every 2 hours</div>
              <div style={{fontSize:12,color:"rgba(200,220,240,.25)"}}>CRITICAL=4pts · HIGH=3pts · MEDIUM=2pts · LOW=1pt</div>
            </div>
            <div style={{background:"rgba(5,8,15,.97)",border:"1px solid rgba(0,200,255,.15)",borderRadius:8,padding:"20px",marginBottom:16,overflowX:"auto"}}>
              <div style={{fontSize:11,letterSpacing:2,color:"rgba(0,200,255,.5)",marginBottom:14,fontFamily:"var(--mono)"}}>WORLD THREAT MAP</div>
              <svg viewBox="0 0 900 440" style={{width:"100%",minWidth:600}} xmlns="http://www.w3.org/2000/svg">
                <rect width="900" height="440" fill="#060c18" rx="6"/>
                {[110,220,330,440].map(y=><line key={y} x1="0" y1={y} x2="900" y2={y} stroke="rgba(0,200,255,.04)" strokeWidth="1"/>)}
                {[180,360,540,720].map(x=><line key={x} x1={x} y1="0" x2={x} y2="440" stroke="rgba(0,200,255,.04)" strokeWidth="1"/>)}
                {[
                  {code:"US",x:100,y:140,w:140,h:85},{code:"CA",x:100,y:72,w:140,h:65},{code:"MX",x:115,y:228,w:85,h:52},
                  {code:"BR",x:190,y:285,w:95,h:85},{code:"GB",x:375,y:108,w:48,h:42},{code:"DE",x:422,y:108,w:48,h:42},
                  {code:"FR",x:390,y:148,w:48,h:40},{code:"NL",x:422,y:93,w:32,h:18},{code:"UA",x:468,y:112,w:58,h:42},
                  {code:"SE",x:438,y:72,w:36,h:40},{code:"IT",x:428,y:150,w:36,h:50},{code:"ES",x:378,y:150,w:44,h:40},
                  {code:"RU",x:478,y:62,w:185,h:92},{code:"TR",x:478,y:156,w:58,h:36},{code:"IR",x:528,y:156,w:58,h:48},
                  {code:"AE",x:555,y:212,w:36,h:26},{code:"SA",x:502,y:196,w:62,h:52},{code:"IL",x:490,y:174,w:26,h:26},
                  {code:"QA",x:547,y:212,w:22,h:20},{code:"KW",x:528,y:192,w:24,h:20},{code:"NG",x:405,y:252,w:52,h:48},
                  {code:"ZA",x:428,y:332,w:58,h:52},{code:"PK",x:588,y:158,w:48,h:48},{code:"IN",x:628,y:174,w:72,h:72},
                  {code:"CN",x:658,y:118,w:102,h:82},{code:"KP",x:753,y:126,w:32,h:32},{code:"KR",x:758,y:156,w:30,h:30},
                  {code:"JP",x:788,y:133,w:42,h:58},{code:"SG",x:708,y:267,w:22,h:20},{code:"AU",x:728,y:302,w:115,h:82},
                ].map(country=>{
                  const hm=heatmap.find(h=>h.code===country.code);
                  const max=heatmap[0]?.score||1;
                  const pct=hm?hm.score/max:0;
                  const s=hm?(SEV_S[hm.level]||SEV_S.LOW):null;
                  const fill=hm?(hm.level==="CRITICAL"?`rgba(200,0,0,${.4+pct*.5})`:hm.level==="HIGH"?`rgba(220,100,0,${.35+pct*.4})`:hm.level==="MEDIUM"?`rgba(200,170,0,${.3+pct*.35})`:`rgba(0,140,70,${.25+pct*.3})`):"rgba(255,255,255,.04)";
                  const stroke=hm?(s?.border||"#444"):"rgba(0,200,255,.08)";
                  const isTop3=hm&&heatmap.slice(0,3).some(h=>h.code===country.code);
                  return(
                    <g key={country.code}>
                      <rect x={country.x} y={country.y} width={country.w} height={country.h} fill={fill} stroke={stroke} strokeWidth={isTop3?2.5:1} rx="4" style={{filter:isTop3?`drop-shadow(0 0 10px ${stroke})`:"none"}}/>
                      {isTop3&&<rect x={country.x} y={country.y} width={country.w} height={country.h} fill="none" stroke={stroke} strokeWidth="2" rx="4" opacity="0.4"><animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite"/></rect>}
                      <text x={country.x+country.w/2} y={country.y+country.h/2-(hm?7:0)} textAnchor="middle" fontSize={country.w>80?11:country.w>45?10:9} fill={hm?"#fff":"rgba(200,220,240,.25)"} fontWeight="700" fontFamily="monospace">{country.code}</text>
                      {hm&&<text x={country.x+country.w/2} y={country.y+country.h/2+11} textAnchor="middle" fontSize="9" fill={s?.text||"#fff"} fontWeight="700">{hm.score}pt</text>}
                    </g>
                  );
                })}
                {[{label:"CRITICAL",color:"rgba(200,0,0,.7)",border:"#c00000"},{label:"HIGH",color:"rgba(220,100,0,.6)",border:"#dd6600"},{label:"MEDIUM",color:"rgba(200,170,0,.5)",border:"#c8a000"},{label:"LOW",color:"rgba(0,140,70,.4)",border:"#008c46"},{label:"NO DATA",color:"rgba(255,255,255,.04)",border:"rgba(0,200,255,.1)"}].map((l,i)=>(
                  <g key={l.label} transform={`translate(${18+i*165},408)`}>
                    <rect width="14" height="14" fill={l.color} stroke={l.border} strokeWidth="1" rx="2"/>
                    <text x="20" y="11" fontSize="11" fill="rgba(200,220,240,.5)" fontFamily="monospace">{l.label}</text>
                  </g>
                ))}
              </svg>
            </div>
            <div style={{background:"rgba(5,8,15,.95)",border:"1px solid rgba(0,200,255,.12)",borderRadius:8,padding:"20px",marginBottom:16}}>
              <div style={{fontSize:11,letterSpacing:2,color:"rgba(0,200,255,.5)",marginBottom:16,fontFamily:"var(--mono)"}}>TOP 15 COUNTRIES BY THREAT SCORE</div>
              {heatmap.length===0?<div style={{textAlign:"center",padding:"30px",color:"rgba(200,220,240,.3)",fontSize:14}}>Loading… click ⚡ Force Latest</div>:(
                <div style={{display:"grid",gap:9}}>
                  {heatmap.slice(0,15).map((c,i)=>{
                    const s=SEV_S[c.level]||SEV_S.LOW;
                    const pct=Math.round((c.score/(heatmap[0]?.score||1))*100);
                    return(
                      <div key={c.code} style={{display:"flex",alignItems:"center",gap:12}}>
                        <div style={{fontSize:13,fontWeight:900,fontFamily:"var(--mono)",color:i<3?s.text:"rgba(200,220,240,.35)",minWidth:24,textAlign:"right"}}>{String(i+1).padStart(2,"0")}</div>
                        <div style={{display:"flex",alignItems:"center",gap:7,minWidth:165}}>
                          <span style={{fontSize:18}}>{FLAGS[c.code]||"🌐"}</span>
                          <span style={{fontSize:13,color:"#ddeeff",fontWeight:600}}>{c.name}</span>
                        </div>
                        <div style={{flex:1,height:26,background:"rgba(255,255,255,.04)",borderRadius:3,overflow:"hidden",position:"relative"}}>
                          <div style={{width:`${pct}%`,height:"100%",background:`linear-gradient(90deg,${s.border}55,${s.border})`,borderRadius:3,minWidth:4,boxShadow:i<3?`0 0 8px ${s.border}88`:"none"}}/>
                          <div style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",fontSize:11,color:"rgba(200,220,240,.5)",fontFamily:"var(--mono)"}}>{c.score}pts</div>
                        </div>
                        <span style={{fontSize:10,padding:"3px 10px",background:s.bg,border:`1px solid ${s.border}`,color:s.text,fontFamily:"var(--mono)",borderRadius:2,fontWeight:700,minWidth:72,textAlign:"center"}}>{c.level}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div style={{fontSize:11,letterSpacing:2,color:"rgba(0,200,255,.5)",marginBottom:12,fontFamily:"var(--mono)"}}>REGIONAL THREAT SUMMARY</div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:16}}>
              {[
                {region:"🌍 Middle East / GCC",codes:["AE","SA","QA","KW","BH","OM","IQ","IR"],color:"#00e676",bg:"rgba(0,200,100,.08)",border:"rgba(0,200,100,.2)"},
                {region:"🌏 Asia Pacific",codes:["IN","CN","JP","KR","AU","SG","PK"],color:ACCENT,bg:"rgba(0,200,255,.06)",border:"rgba(0,200,255,.18)"},
                {region:"🌎 Americas",codes:["US","CA","BR","MX"],color:"#ff9944",bg:"rgba(220,100,0,.08)",border:"rgba(220,100,0,.2)"},
                {region:"🌍 Europe",codes:["GB","DE","FR","NL","IT","ES","SE","UA"],color:"#c084fc",bg:"rgba(123,47,247,.08)",border:"rgba(123,47,247,.2)"},
                {region:"⚠️ Threat Actors",codes:["RU","CN","IR","KP"],color:"#ff4444",bg:"rgba(200,0,0,.1)",border:"rgba(200,0,0,.25)"},
              ].map(r=>{
                const total=heatmap.filter(h=>r.codes.includes(h.code)).reduce((s,h)=>s+h.score,0);
                const topC=heatmap.find(h=>r.codes.includes(h.code));
                return(
                  <div key={r.region} style={{flex:1,minWidth:150,background:r.bg,border:`1px solid ${r.border}`,borderRadius:6,padding:"14px 16px"}}>
                    <div style={{fontSize:13,fontWeight:700,color:r.color,marginBottom:6}}>{r.region}</div>
                    <div style={{fontSize:30,fontWeight:900,color:r.color,fontFamily:"var(--mono)",lineHeight:1,marginBottom:4}}>{total}</div>
                    <div style={{fontSize:11,color:"rgba(200,220,240,.35)"}}>threat score</div>
                    {topC&&<div style={{fontSize:11,color:"rgba(200,220,240,.3)",marginTop:5}}>Top: {topC.name}</div>}
                  </div>
                );
              })}
            </div>
            <div style={{padding:"12px 16px",background:"rgba(0,200,255,.04)",border:"1px solid rgba(0,200,255,.1)",borderRadius:6,fontSize:12,color:"rgba(200,220,240,.4)",lineHeight:1.7}}>
              ℹ️ Scores derived from advisory geographic metadata — not real-time attack traffic. Refreshes every 2 hours.
            </div>
          </div>
        )}

        {/* ══ SOURCES ══ */}
        {view==="sources"&&(
          <div style={{maxWidth:780,margin:"0 auto",animation:"fadeIn .3s ease"}}>
            <div style={{textAlign:"center",marginBottom:24}}>
              <div style={{fontSize:13,letterSpacing:4,color:ACCENT,marginBottom:8,fontFamily:"var(--mono)"}}>INTELLIGENCE SOURCES · LIVE TELEMETRY</div>
              <div style={{fontSize:15,color:"rgba(200,220,240,.4)"}}>
                {feedMeta?.sources_live!=null
                  ?<><strong style={{color:"#00e676"}}>{feedMeta.sources_live}</strong> of <strong style={{color:ACCENT}}>{feedMeta.sources_total}</strong> feeds responding this cycle · per-source latency measured on every refresh</>
                  :"Live RSS feeds · AI Security references · refreshed every 2 hours"}
              </div>
            </div>
            {["Advisory","Exploit","News","Social","AI Security"].map(cat=>(
              <div key={cat} style={{marginBottom:28}}>
                <div style={{fontSize:13,letterSpacing:2,color:"rgba(0,200,255,.6)",marginBottom:12,fontFamily:"var(--mono)",fontWeight:700,borderBottom:"1px solid rgba(255,255,255,.06)",paddingBottom:8}}>
                  {cat==="Advisory"?"🏛️":cat==="Exploit"?"⚡":cat==="AI Security"?"🤖":cat==="Social"?"💬":"📰"} {cat.toUpperCase()} SOURCES
                </div>
                {SOURCES_DATA.filter(s=>s.cat===cat).map(src=>{
                  const h=healthByName[src.name];
                  const isRef=src.cat==="AI Security";
                  const status=isRef?"ref":h?(h.ok?"live":"down"):"unknown";
                  const badge=status==="live"?{bg:"rgba(0,150,70,.12)",border:"#008c46",color:"#00e676",label:"● LIVE"}
                    :status==="down"?{bg:"rgba(200,0,0,.12)",border:"#c00000",color:"#ff4444",label:"● DOWN"}
                    :status==="ref"?{bg:"rgba(123,47,247,.1)",border:"#7b2ff7",color:"#c084fc",label:"◆ REFERENCE"}
                    :{bg:"rgba(200,170,0,.1)",border:"#c8a000",color:"#ffd700",label:"◌ PENDING"};
                  return (
                    <div key={src.name} style={{background:"rgba(255,255,255,.025)",border:`1px solid ${status==="down"?"rgba(200,0,0,.2)":"rgba(255,255,255,.07)"}`,borderRadius:6,padding:"16px 18px",marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:14}}>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:7,flexWrap:"wrap"}}>
                            <span style={{fontSize:20}}>{src.flag}</span>
                            <span style={{fontSize:15,fontWeight:700,color:"#ddeeff"}}>{src.name}</span>
                            <span style={{fontSize:11,padding:"3px 10px",letterSpacing:1,fontFamily:"var(--mono)",borderRadius:3,background:badge.bg,border:`1px solid ${badge.border}`,color:badge.color,fontWeight:700}}>{badge.label}</span>
                            {h&&h.ok&&<span style={{fontSize:11,color:"rgba(200,220,240,.35)",fontFamily:"var(--mono)"}}>{h.items} items · {h.ms}ms</span>}
                          </div>
                          <div style={{fontSize:13,color:"rgba(200,220,240,.5)",lineHeight:1.75}}>{src.desc}</div>
                        </div>
                        <a href={src.url} target="_blank" rel="noopener noreferrer" style={{fontSize:13,color:ACCENT,fontFamily:"var(--mono)",border:`1px solid rgba(0,200,255,.25)`,padding:"7px 14px",borderRadius:4,whiteSpace:"nowrap",flexShrink:0,fontWeight:600}}>VISIT ↗</a>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* ══ DEMO ══ */}
        {view==="demo"&&(
          <div style={{maxWidth:820,margin:"0 auto",animation:"fadeIn .3s ease"}}>
            <div style={{textAlign:"center",marginBottom:24}}>
              <div style={{fontSize:13,letterSpacing:4,color:ACCENT,marginBottom:8,fontFamily:"var(--mono)"}}>▶ DEMO VIDEO</div>
              <div style={{fontSize:16,fontWeight:700,color:"#ddeeff",marginBottom:6}}>See BCyberAware in Action</div>
            </div>
            <div style={{position:"relative",paddingBottom:"56.25%",height:0,borderRadius:10,overflow:"hidden",border:`1px solid rgba(0,200,255,.2)`,boxShadow:`0 0 40px rgba(0,200,255,.1)`,marginBottom:20,background:"#000"}}>
              <iframe src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?rel=0&modestbranding=1`} title="BCyberAware Demo" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{position:"absolute",top:0,left:0,width:"100%",height:"100%"}}/>
            </div>
            <div style={{background:"rgba(255,0,0,.07)",border:"1px solid rgba(255,0,0,.2)",borderRadius:8,padding:"18px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:14}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:"#ddeeff",marginBottom:4}}>🎬 BCyberAware YouTube Channel</div>
                <div style={{fontSize:13,color:"rgba(200,220,240,.45)"}}>Cybersecurity tutorials and threat walkthroughs by Vikas Pandita</div>
              </div>
              <a href={YOUTUBE_CHANNEL} target="_blank" rel="noopener noreferrer" style={{display:"inline-flex",alignItems:"center",gap:8,fontSize:14,color:"#fff",fontWeight:700,background:"#ff0000",padding:"10px 20px",borderRadius:6,whiteSpace:"nowrap"}}>▶ Subscribe</a>
            </div>
          </div>
        )}

        {/* ══ ABOUT ══ */}
        {view==="about"&&(
          <div style={{maxWidth:680,margin:"0 auto",animation:"fadeIn .3s ease"}}>
            <div style={{textAlign:"center",marginBottom:30}}>
              <img src="logo.svg" alt="BCyberAware Logo" style={{width:90,height:90,objectFit:"contain",margin:"0 auto 16px",display:"block"}} />
              <div style={{fontSize:26,fontWeight:900,color:"#ddeeff",letterSpacing:2,marginBottom:7,fontFamily:"var(--display)"}}>BCyberAware</div>
              <div style={{fontSize:13,color:"rgba(200,220,240,.35)",letterSpacing:2}}>SECURITY INTELLIGENCE FOR THE MODERN ENTERPRISE</div>
            </div>
            <div style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(0,200,255,.12)",borderRadius:6,padding:"22px 24px",marginBottom:12}}>
              <div style={{fontSize:12,letterSpacing:3,color:"rgba(0,200,255,.55)",marginBottom:12,fontFamily:"var(--mono)",fontWeight:700}}>AUTHOR</div>
              <div style={{fontSize:20,fontWeight:800,color:"#ddeeff",marginBottom:5}}>Vikas Pandita</div>
              <div style={{fontSize:14,color:"rgba(200,220,240,.5)",marginBottom:16}}>Global Head of Security Architecture · AI Researcher · Blogger</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {["TOGAF 9.2","IIM Kozhikode EPGP","14+ Years Experience","Big 4 Consulting","IOC Security Architect","GenAI Security"].map(b=>(
                  <span key={b} style={{fontSize:12,color:ACCENT,fontFamily:"var(--mono)",background:"rgba(0,200,255,.07)",padding:"5px 12px",border:`1px solid rgba(0,200,255,.2)`,borderRadius:4}}>{b}</span>
                ))}
              </div>
            </div>
            <div style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(0,200,255,.12)",borderRadius:6,padding:"22px 24px"}}>
              <div style={{fontSize:12,letterSpacing:3,color:"rgba(0,200,255,.55)",marginBottom:12,fontFamily:"var(--mono)",fontWeight:700}}>PLATFORM CAPABILITIES</div>
              {["🛡️ AI Threat Analyst — chat assistant grounded in the live feed (Cloudflare Workers AI)","🤖 AI Situation Summary — executive brief regenerated with every feed refresh","💬 Social Intel — infosec.exchange, Bluesky, Hacker News, r/netsec","35+ live intelligence sources with real-time health telemetry","🔴 Breaking-news ticker — incident-grade stories from the last 48 hours","ZDI 0-Day Pipeline — vulnerabilities awaiting vendor disclosure","GenAI tab — OWASP LLM Top 10, Standards & Tools (Awesome AI Security)","CISO Brief — AI governance links (NIST AI RMF, MITRE ATLAS, AI Incident Database)","CISA KEV · NVD · CERT-In · NCSC UK · CERT-EU · Microsoft Security","The Record · Unit 42 · Check Point Research · Talos · Project Zero · Krebs","GCC / Middle East relevance scoring per advisory","Global threat heatmap — country-level risk visualisation","Source verification link on every advisory card · auto-refresh every 2 hours"].map((f,i)=>(
                <div key={i} style={{fontSize:14,color:"rgba(200,220,240,.55)",padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,.05)",display:"flex",gap:10,lineHeight:1.5}}>
                  <span style={{color:ACCENT,flexShrink:0}}>▸</span>{f}
                </div>
              ))}
              <div style={{marginTop:16,fontSize:12,color:"rgba(200,220,240,.25)",fontFamily:"var(--mono)"}}>Open source · MIT Licence · Contributions welcome on GitHub</div>
            </div>
          </div>
        )}

        {/* ══ CISO BRIEF ══ */}
        {view==="ciso"&&<CISOBriefView advisories={advisories} exploits={exploits} news={news}/>}

        {/* ══ GENAI SECURITY ══ */}
        {view==="genai"&&<GenAISecurityView advisories={advisories} exploits={exploits} news={news}/>}

        {/* ══ DARK WEB EARLY WARNING ══ */}
        {view==="darkweb"&&<DarkWebView/>}

      </div>

      {/* AI Threat Analyst (floating) */}
      <ThreatAnalystChat/>

      {/* Footer */}
      <div style={{borderTop:"1px solid rgba(255,255,255,.05)",marginTop:32,padding:"18px 24px",textAlign:"center"}}>
        <div style={{fontSize:12,color:"rgba(200,220,240,.2)",letterSpacing:1,marginBottom:10}}>
          BCyberAware · Vikas Pandita · {new Date().getFullYear()} · MIT Licence · 30+ live sources · CISA · NVD · ZDI · The Record · Unit 42 · Check Point · Talos · Project Zero · Krebs · +20 more
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<BCyberAwareDashboard/>);
