/**
 * Industry tagging for threat items.
 *
 * Each item is matched against keyword patterns per industry. An item can belong
 * to several industries; one that matches none is "cross-industry" (Microsoft,
 * VPNs, browsers...), which matters to every organisation.
 *
 * Used for Telegram hashtags (#Healthcare), personal industry alerts and the
 * "industry watch" in the morning brief.
 */

export const SECTORS = [
  { id: "finance", name: "Banking & Finance", tag: "Finance", emoji: "🏦",
    re: /\bbank(s|ing)?\b|fintech|payment|\bswift\b|\batm\b|credit card|card ?holder|\bpci\b|trading|brokerage|stock exchange|crypto(currency)?|wallet|insurance|\bupi\b|\brbi\b|\bsebi\b|core banking|temenos|finastra|fiserv|\bfis\b|loan|lending|finacle|flexcube|jack henry|mambu|diebold|\bncr\b|hyosung|murex|calypso|bloomberg terminal/i },
  { id: "health", name: "Healthcare & Pharma", tag: "Healthcare", emoji: "🏥",
    re: /hospital|health ?care|\bhealth\b|medical|patient|pharma|clinic|\bhl7\b|dicom|\bpacs\b|\behr\b|\bemr\b|epic systems|monai|medtronic|biomedical|life ?sciences|laborator(y|ies)|\bhipaa\b|infusion pump|radiology|cerner|oracle health|meditech|allscripts|ge healthcare|philips (intellispace|healthcare)|siemens healthineers|baxter|b\. braun|orthanc|openemr/i },
  { id: "gov", name: "Government & Defence", tag: "Government", emoji: "🏛️",
    re: /government|ministry|municipal|federal|\bstate agenc|public sector|defen[cs]e|military|armed forces|election|parliament|embassy|diplomat|nciipc|law enforcement|police|e-?governance|citizen portal/i },
  { id: "energy", name: "Energy, Oil & Utilities", tag: "Energy", emoji: "⚡",
    re: /\benergy\b|power (grid|plant|station)|\bgrid\b|utilit(y|ies)|\boil\b|\bgas\b|pipeline|nuclear|solar|wind farm|electric(ity| utility)|water (treatment|utility|supply)|substation|\bscada\b|\bics\b|\bplc\b|\bhmi\b|modbus|dnp3|iec 61850|ge vernova|aveva|\bosisoft\b|hitachi energy|schweitzer|\bsel-\d|moxa|smart meter|ev charg|inverter/i },
  { id: "manufacturing", name: "Manufacturing & OT", tag: "Manufacturing", emoji: "🏭",
    re: /manufactur|factory|industrial|\bot\b|operational technology|automotive|robot|siemens|rockwell|schneider electric|mitsubishi electric|\babb\b|honeywell|yokogawa|omron|\bplc\b|\bscada\b|semiconductor|codesys|wago|phoenix contact|beckhoff|delta electronics|unitronics|\bhmi\b|\bmes\b|ptc kepware|ignition/i },
  { id: "telecom", name: "Telecom & ISPs", tag: "Telecom", emoji: "📡",
    re: /telecom|telco|carrier|\b5g\b|\blte\b|\bisp\b|mobile network|\bss7\b|diameter|ericsson|nokia|huawei|\bzte\b|\bsim\b swap|cpe\b|broadband|salt typhoon|broadworks|openwave|freeswitch|asterisk|\bvoip\b|\bsip\b|\bims\b|\bsbc\b|session border|ribbon|metaswitch|mitel|avaya|kamailio|\bsms\b gateway|ivr/i },
  { id: "retail", name: "Retail & E-commerce", tag: "Retail", emoji: "🛒",
    re: /retail|e-?commerce|magento|adobe commerce|woocommerce|shopify|prestashop|point[- ]of[- ]sale|\bpos\b|skimm|loyalty|online store|checkout|supermarket|grocery|hospitality|hotel|restaurant|fast[- ]food|food (chain|delivery|service)|quick[- ]service|mcdonald'?s|starbucks|burger|pizza|coffee chain/i },
  { id: "education", name: "Education", tag: "Education", emoji: "🎓",
    re: /universit(y|ies)|school|education|student|college|campus|moodle|canvas lms|blackboard|powerschool|edtech/i },
  { id: "transport", name: "Transport & Logistics", tag: "Transport", emoji: "🚢",
    re: /logistics|shipping|\bport\b authority|maritime|vessel|aviation|airport|airline|\brail(way)?\b|transport|freight|supply chain attack on carriers|fleet/i },
  { id: "tech", name: "Tech, Cloud & SaaS", tag: "TechSaaS", emoji: "☁️",
    re: /\baws\b|amazon web services|azure|\bgcp\b|google cloud|kubernetes|\bk8s\b|docker|container|\bsaas\b|okta|salesforce|github|gitlab|\bnpm\b|pypi|crates\.io|open[- ]source package|supply[- ]chain|\bci\/cd\b|jenkins|atlassian|jira|confluence|snowflake/i },
  { id: "ai", name: "AI & Machine Learning", tag: "AISecurity", emoji: "🤖",
    re: /\bllm\b|\bai\b model|artificial intelligence|openai|chatgpt|\bgpt-?\d|copilot|langchain|llamaindex|ollama|hugging ?face|\bmcp\b server|model context protocol|prompt injection|agentic|\bai agent|deepfake|claude|gemini|mistral|gpustack|vllm|comfyui|triton inference|mlflow|\bray\b cluster|open ?webui|litellm|anythingllm|flowise|langflow|\bgpu\b server|model serving/i },
];

export const CROSS = { id: "cross", name: "Cross-industry (Microsoft, VPNs, browsers…)", tag: "AllIndustries", emoji: "🌐" };
export const ALL_CHOICES = [...SECTORS, CROSS];
export const byId = id => ALL_CHOICES.find(s => s.id === id) || null;

const textOf = a => [
  a.title, a.summary, a.threat_actor,
  ...(a.affected_products || []),
  a.action?.affected,
].filter(Boolean).join(" ");

/** Industry ids for one item; ["cross"] when no specific industry matches. */
export function sectorsOf(a) {
  if (!a) return [];
  if (Array.isArray(a._sectors)) return a._sectors;
  const t = textOf(a);
  const hits = SECTORS.filter(s => s.re.test(t)).map(s => s.id);
  const out = hits.length ? hits.slice(0, 3) : ["cross"];
  try { Object.defineProperty(a, "_sectors", { value: out, enumerable: false }); } catch {}
  return out;
}

/** Telegram hashtags for an item: industry tags plus what kind of threat it is. */
export function hashtagsOf(a) {
  const tags = [];
  if (a.priority?.label === "ACT NOW") tags.push("ActNow");
  if (a.kev) tags.push("KEV");
  else if (a.exploit_in_wild) tags.push("ExploitedInTheWild");
  if (/zero[- ]?day|0-day/i.test(`${a.title} ${a.summary}`)) tags.push("ZeroDay");
  if (/ransomware/i.test(`${a.title} ${a.summary} ${a.threat_actor || ""}`)) tags.push("Ransomware");
  for (const id of sectorsOf(a)) tags.push(byId(id).tag);
  return [...new Set(tags)].map(t => "#" + t);
}

/** Does an item match a subscriber's chosen industries? */
export const matches = (a, chosen) => sectorsOf(a).some(id => chosen.includes(id));
