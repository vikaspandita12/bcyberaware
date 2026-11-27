// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import { classifyNews, formatNewsAlert, pickRoundup, incidentNews } from "../functions/_shared/news-alerts.js";
import { publishToTelegram, sameStory } from "../functions/_shared/telegram-core.js";
import { sectorsOf } from "../functions/_shared/sectors.js";

class KV { constructor() { this.m = new Map(); } async get(k) { const v = this.m.get(k); return v == null ? null : JSON.parse(v); } async put(k, v) { this.m.set(k, v); } }
const env = { TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_CHANNEL: "@bcyberaware" };
const at = (d, h, m) => Date.UTC(2026, 10, d, h, m);
function fakeTg() {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const method = url.split("/").pop(); const body = init?.body ? JSON.parse(init.body) : {};
    calls.push({ method, body });
    if (method === "getMe") return new Response(JSON.stringify({ ok: true, result: { id: 9, username: "bcyberaware_alerts_bot" } }));
    return new Response(JSON.stringify({ ok: true, result: true }));
  };
  return { calls, fetchImpl, posts: () => calls.filter(c => c.method === "sendMessage" && c.body.chat_id === "@bcyberaware").map(c => c.body) };
}
const news = (id, title, ts, over = {}) => ({ id, title, summary: title + ". More details inside.", source: "BleepingComputer", source_url: "https://example.com/" + id, category: "news", ts, sources_count: 1, priority: { score: 9, label: "MONITOR", reasons: [] }, ...over });

test("breaches, ransomware, cyberattacks and exploited zero-days are recognised", () => {
  const k = t => classifyNews(news("x", t, 0))?.kind || null;
  assert.equal(k("McDonald's Amazon servers attacked, hackers say they stole customer data"), "breach");
  assert.equal(k("Vanderbilt University reels following ransomware attack claimed by BYOD group"), "ransomware");
  assert.equal(k("Poland shuts down government services platform ePUAP following cyberattack"), "attack");
  assert.equal(k("Chrome zero-day exploited in the wild, patch now"), "zeroday");
  assert.equal(k("SAP NetWeaver flaw actively exploited to breach enterprises"), "zeroday");
});

test("funding, research, guidance and chatter are not treated as breaking news", () => {
  const k = (t, o) => classifyNews(news("x", t, 0, o));
  assert.equal(k("Dreeze Emerges From Stealth With $33M to Rebuild Cloud Apps After Cyberattacks"), null);
  assert.equal(k("Researchers Uncover 45 AI Hacking Frameworks"), null);
  assert.equal(k("Britain, France set out first guidelines for commercial hacking firms"), null);
  assert.equal(k("Who hacked fridges in France?", { source: "Telegram: DarkFeed" }), null);
  assert.equal(k("Big breach at bank", { category: "social", source: "Reddit r/netsec" }), null);
});

test("a McDonald's-style story is tagged Retail and formatted with what to do", () => {
  const a = news("mcd", "McDonald's Amazon servers attacked, hackers say they stole customer data", 0, { also: [{ source: "The Record" }, { source: "TechCrunch" }, { source: "BleepingComputer" }], sources_count: 4 });
  assert.ok(sectorsOf(a).includes("retail"));
  const t = formatNewsAlert({ ...a, _kind: classifyNews(a) });
  assert.match(t, /🔓 <b>DATA BREACH<\/b>/);
  assert.match(t, /Retail/);
  assert.match(t, /Reported by:<\/b> <a href="https:\/\/example.com\/mcd">BleepingComputer<\/a> \+ The Record, TechCrunch \(\+1 more\)/);
  assert.match(t, /What to do:<\/b> If you use or supply this organisation/);
  assert.match(t, /#DataBreach #Retail #News/);
  assert.ok(t.length < 4096);
});

test("same incident from two outlets is recognised as one story", () => {
  assert.ok(sameStory("Notion AI Data Breach Exposes Customer Chat Transcripts After Fireworks AI Cyberattack", "Fireworks AI Confirms Wider Breach Affecting Customer Datasets and Notion AI Chats"));
  assert.ok(!sameStory("McDonald's servers attacked, hackers stole customer data", "Vanderbilt University ransomware attack claimed by BYOD"));
});

test("breaking news: one post at a time, 40 minutes apart, never the same story twice", async () => {
  const kv = new KV(), tg = fakeTg(); const t0 = at(27, 1, 0);
  await publishToTelegram(env, { advisories: [], exploits: [], news: [] }, kv, t0, { fetchImpl: tg.fetchImpl }); // channel baseline
  const d = { advisories: [], exploits: [], news: [
    news("a", "Retail giant hit by ransomware attack claimed by Akira", t0, { sources_count: 3 }),
    news("b", "Hackers stole data of 2 million customers from telecom operator", t0, { sources_count: 2 }),
    news("c", "Hospital chain says hackers stole patient records", t0),
  ] };
  const r1 = await publishToTelegram(env, d, kv, t0 + 5 * 60e3, { fetchImpl: tg.fetchImpl });
  assert.equal(r1.news, 1);
  assert.match(tg.posts().at(-1).text, /Retail giant hit by ransomware/, "best-corroborated story first");
  const kb = tg.posts().at(-1).reply_markup.inline_keyboard;
  assert.equal(kb[0][0].text, "📰 Read the story"); assert.equal(kb[0][0].url, "https://example.com/a");
  const r2 = await publishToTelegram(env, d, kv, t0 + 10 * 60e3, { fetchImpl: tg.fetchImpl });
  assert.equal(r2.news, undefined, "waits 40 minutes between stories");
  const r3 = await publishToTelegram(env, d, kv, t0 + 50 * 60e3, { fetchImpl: tg.fetchImpl });
  assert.equal(r3.news, 1); assert.match(tg.posts().at(-1).text, /telecom operator/);
  // the same ransomware incident, reported by another outlet, is not posted again
  d.news.push(news("a2", "Akira ransomware claims retail giant, confirms attack", t0 + 60 * 60e3, { sources_count: 5, source: "The Record" }));
  const r4 = await publishToTelegram(env, d, kv, t0 + 95 * 60e3, { fetchImpl: tg.fetchImpl });
  assert.equal(r4.news, 1); assert.match(tg.posts().at(-1).text, /Hospital chain/);
  const r5 = await publishToTelegram(env, d, kv, t0 + 140 * 60e3, { fetchImpl: tg.fetchImpl });
  assert.equal(r5.news, undefined, "nothing new: nothing posted");
  assert.equal(tg.posts().filter(p => /#News/.test(p.text)).length, 3);
});

test("at most 10 breaking stories a day", async () => {
  const kv = new KV(), tg = fakeTg(); const t0 = at(27, 0, 5);
  await publishToTelegram(env, { advisories: [], exploits: [], news: [] }, kv, t0, { fetchImpl: tg.fetchImpl });
  const towns = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliet", "Kilo", "Lima", "Mike", "November"];
  const d = { advisories: [], exploits: [], news: towns.map((t, i) => news("n" + i, `${t}ville council hit by ransomware attack`, t0)) };
  for (let i = 1; i <= 14; i++) await publishToTelegram(env, d, kv, t0 + i * 41 * 60e3, { fetchImpl: tg.fetchImpl });
  assert.equal(tg.posts().filter(p => /#News/.test(p.text)).length, 10);
});

test("breaking news goes by direct message to subscribers of that industry only", async () => {
  const kv = new KV(), tg = fakeTg(); const t0 = at(27, 1, 0);
  await publishToTelegram(env, { advisories: [], exploits: [], news: [] }, kv, t0, { fetchImpl: tg.fetchImpl });
  await kv.put("telegram:subs:v1", JSON.stringify({ 1: { s: ["retail"] }, 2: { s: ["finance"] }, 3: { s: ["cross"] } }));
  const d = { advisories: [], exploits: [], news: [news("m", "McDonald's servers attacked, hackers say they stole customer data", t0)] };
  await publishToTelegram(env, d, kv, t0 + 5 * 60e3, { fetchImpl: tg.fetchImpl });
  const dms = tg.calls.filter(c => c.method === "sendMessage" && c.body.chat_id !== "@bcyberaware").map(c => c.body.chat_id);
  assert.deepEqual(dms, ["1"]);
});

test("'Today in cyber' roundup goes out once a day at 18:30 IST, incidents first", async () => {
  const kv = new KV(), tg = fakeTg(); const t0 = at(27, 6, 0);
  await publishToTelegram(env, { advisories: [], exploits: [], news: [] }, kv, t0, { fetchImpl: tg.fetchImpl });
  const n = at(27, 12, 0);
  const d = { advisories: [], exploits: [], news: [
    news("p1", "New phishing kit targets Microsoft 365 users", n), news("p2", "CISA adds guidance for OT asset owners", n),
    news("p3", "Retailer confirms data breach affecting 3 million customers", n), news("p4", "Patch now: Chrome zero-day exploited in the wild", n),
  ] };
  await publishToTelegram(env, d, kv, at(27, 12, 55), { fetchImpl: tg.fetchImpl });
  assert.ok(!tg.posts().some(p => /Today in cyber/.test(p.text)), "not before 18:30 IST");
  const r = await publishToTelegram(env, d, kv, at(27, 13, 0), { fetchImpl: tg.fetchImpl });
  assert.equal(r.roundup, true);
  const roundup = tg.posts().find(p => /Today in cyber · 27 Nov 2026/.test(p.text)).text;
  assert.ok(roundup.indexOf("Retailer confirms data breach") < roundup.indexOf("phishing kit"), "incidents first");
  assert.match(roundup, /<a href="https:\/\/example.com\/p3">/);
  await publishToTelegram(env, d, kv, at(27, 13, 30), { fetchImpl: tg.fetchImpl });
  assert.equal(tg.posts().filter(p => /Today in cyber/.test(p.text)).length, 1, "once a day");
});

test("old stories (over 12 hours) are not posted as breaking", () => {
  const now = at(27, 12, 0);
  const d = { news: [news("old", "Bank confirms data breach of customer records", now - 13 * 3600e3)] };
  assert.equal(incidentNews(d, now, 12 * 3600e3).length, 0);
  assert.equal(pickRoundup(d, now).length, 1, "still in the daily roundup (24 hours)");
});
