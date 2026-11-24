// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { prepareStories, scoreAndAdvise } from "../functions/_shared/intel-core.js";
import { sectorsOf, hashtagsOf } from "../functions/_shared/sectors.js";
import {
  publishToTelegram, handleTelegramWebhook, webhookSecret, formatAlert, alertButtons,
  formatDigest, pickDigest, formatCve, industryKeyboard,
} from "../functions/_shared/telegram-core.js";

const sample = JSON.parse(fs.readFileSync(new URL("./fixtures/live-sample.json", import.meta.url), "utf8"));
function feed(now) {
  const d = JSON.parse(JSON.stringify({ advisories: sample.advisories, exploits: sample.exploits, news: sample.news }));
  const shift = now - sample.fetched_at;
  for (const k of ["advisories", "exploits", "news"]) for (const a of d[k]) if (a.ts) a.ts += shift;
  const out = prepareStories(d); scoreAndAdvise({ ...out, now }); return out;
}
class KV { constructor() { this.m = new Map(); } async get(k) { const v = this.m.get(k); return v == null ? null : JSON.parse(v); } async put(k, v) { this.m.set(k, v); } }
const env = { TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_CHANNEL: "@bcyberaware" };
const at = (dd, h, m) => Date.UTC(2026, 10, dd, h, m); // Nov 2026; the 27th is a Friday

// A fake Telegram that accepts every method and records what was sent
function fakeTg({ blocked = new Set() } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const method = url.split("/").pop();
    const body = init?.body ? JSON.parse(init.body) : {};
    calls.push({ method, body });
    if (method === "getMe") return new Response(JSON.stringify({ ok: true, result: { id: 9, username: "BCyberAwareBot" } }));
    if (method === "sendMessage" && blocked.has(String(body.chat_id))) return new Response(JSON.stringify({ ok: false, description: "Forbidden: bot was blocked by the user" }), { status: 403 });
    if (method === "getUpdates") return new Response(JSON.stringify({ ok: true, result: [] }));
    return new Response(JSON.stringify({ ok: true, result: true }));
  };
  const sent = () => calls.filter(c => c.method === "sendMessage").map(c => c.body);
  return { calls, sent, fetchImpl };
}

const item = (over) => ({ id: "x1", title: "Path traversal in MONAI Label medical imaging server", summary: "Hospitals using MONAI Label…", source: "CISA KEV", cve_ids: ["CVE-2026-1111"], ts: at(23, 1, 0), kev: true, patch_available: true,
  priority: { score: 77, label: "ACT NOW", reasons: ["On CISA's Known Exploited Vulnerabilities list"] }, action: { do_now: "Patch now", deadline: "26 Nov 2026", affected: "Project MONAI Label" }, ...over });

test("items are tagged by industry, generic ones as cross-industry", () => {
  assert.deepEqual(sectorsOf(item()), ["health"]);
  assert.deepEqual(sectorsOf({ title: "Microsoft Windows SMB elevation of privilege" }), ["cross"]);
  assert.ok(sectorsOf({ title: "Siemens SCADA PLC flaw hits power grid operators" }).includes("energy"));
  assert.deepEqual(hashtagsOf(item()), ["#ActNow", "#KEV", "#Healthcare"]);
});

test("alert shows industries, hashtags, a score bar and buttons", () => {
  const a = item();
  const t = formatAlert(a);
  assert.match(t, /▰▰▰▰▰▰▰▰▱▱/);
  assert.match(t, /Industries:<\/b> 🏥 Healthcare &amp; Pharma/);
  assert.match(t, /#Healthcare/);
  assert.match(t, /On CISA KEV/);
  const kb = alertButtons(a, "BCyberAwareBot").inline_keyboard;
  assert.equal(kb[0][1].url, "https://nvd.nist.gov/vuln/detail/CVE-2026-1111");
  assert.equal(kb[1][0].url, "https://t.me/BCyberAwareBot?start=industries");
});

test("morning brief adds an industry watch and this week's CISA deadlines", () => {
  const now = at(24, 4, 0);
  const d = { advisories: [item({ ts: now - 3600e3 })], exploits: [], news: [] };
  const t = formatDigest(pickDigest(d), now, { payload: d, botUsername: "BCyberAwareBot" });
  assert.match(t, /Industry watch/); assert.match(t, /Healthcare &amp; Pharma: <b>1<\/b>/);
  assert.match(t, /patch deadlines this week/); assert.match(t, /26 Nov 2026/);
  assert.match(t, /Get personal alerts/);
  assert.ok(t.length < 4096);
});

test("first run sets up instant replies (webhook) and the command menu", async () => {
  const kv = new KV(), tg = fakeTg(), now = at(23, 2, 0);
  const r = await publishToTelegram(env, feed(now), kv, now, { fetchImpl: tg.fetchImpl });
  assert.equal(r.webhook, "set");
  const hook = tg.calls.find(c => c.method === "setWebhook").body;
  assert.equal(hook.url, "https://advisory.bcyberaware.co.in/api/telegram");
  assert.equal(hook.secret_token, await webhookSecret(env));
  assert.ok(tg.calls.some(c => c.method === "setMyCommands"));
  assert.ok(!tg.calls.some(c => c.method === "getUpdates"), "no polling once the webhook is set");
  tg.calls.length = 0;
  await publishToTelegram(env, feed(now), kv, now + 300e3, { fetchImpl: tg.fetchImpl });
  assert.ok(!tg.calls.some(c => c.method === "setWebhook"), "set up only once");
});

async function hook(kv, update, tg, { secret, now = at(23, 10, 0), payload } = {}) {
  const req = new Request("https://advisory.bcyberaware.co.in/api/telegram", {
    method: "POST", body: JSON.stringify(update),
    headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": secret ?? await webhookSecret(env) },
  });
  return handleTelegramWebhook(req, { ...env, FEED_KV: kv }, { fetchImpl: tg.fetchImpl, now, loadPayload: async () => payload });
}
const msg = (id, text) => ({ update_id: id, message: { message_id: id, chat: { id: 555, type: "private" }, from: { id: 555 }, text } });
const tap = (id, data) => ({ update_id: id, callback_query: { id: "cb" + id, data, from: { id: 555 }, message: { message_id: 50, chat: { id: 555, type: "private" } } } });

test("webhook rejects calls without the secret", async () => {
  const kv = new KV(), tg = fakeTg();
  const r = await hook(kv, msg(1, "/start"), tg, { secret: "wrong" });
  assert.equal(r.status, 403);
  assert.equal(tg.calls.length, 0);
});

test("/start shows the picker; taps toggle industries; Done saves and sends a brief", async () => {
  const kv = new KV(), tg = fakeTg(), now = at(23, 10, 0);
  const payload = { advisories: [item({ ts: now - 3600e3 })], exploits: [], news: [] };
  await hook(kv, msg(1, "/start"), tg, { payload });
  const pick = tg.sent()[0];
  assert.match(pick.text, /Welcome to BCyberAware alerts/);
  assert.ok(pick.reply_markup.inline_keyboard.flat().some(b => b.callback_data === "t:health"));

  await hook(kv, tap(2, "t:health"), tg, { payload });
  assert.deepEqual((await kv.get("telegram:subs:v1"))["555"].s, ["health"]);
  const edit = tg.calls.find(c => c.method === "editMessageReplyMarkup").body;
  assert.ok(edit.reply_markup.inline_keyboard.flat().some(b => b.text.startsWith("✅ 🏥")));

  tg.calls.length = 0;
  await hook(kv, tap(3, "done"), tg, { payload, now });
  const texts = tg.sent().map(m => m.text).join("\n---\n");
  assert.match(texts, /Saved/); assert.match(texts, /Your industry brief/); assert.match(texts, /MONAI/);
});

test("/cve looks up a CVE, plain CVE text works too, /stop unsubscribes", async () => {
  const kv = new KV(), tg = fakeTg();
  const payload = { advisories: [item()], exploits: [], news: [] };
  await hook(kv, msg(1, "/cve CVE-2026-1111"), tg, { payload });
  assert.match(tg.sent()[0].text, /CVE-2026-1111<\/b> · <b>77\/100 ACT NOW/);
  await hook(kv, msg(2, "what about cve-2026-9999?"), tg, { payload });
  assert.match(tg.sent()[1].text, /Not in BCyberAware's live feed/);
  await kv.put("telegram:subs:v1", JSON.stringify({ 555: { s: ["health"] } }));
  await hook(kv, msg(3, "/stop"), tg, { payload });
  assert.deepEqual(await kv.get("telegram:subs:v1"), {});
});

test("a new ACT NOW alert also goes by direct message to matching subscribers only", async () => {
  const kv = new KV(), tg = fakeTg(), now = at(23, 2, 0);
  await publishToTelegram(env, { advisories: [], exploits: [], news: [] }, kv, now, { fetchImpl: tg.fetchImpl }); // baseline
  await kv.put("telegram:subs:v1", JSON.stringify({ 1: { s: ["health"] }, 2: { s: ["finance"] }, 3: { s: ["health", "cross"] } }));
  tg.calls.length = 0;
  const d = { advisories: [item({ ts: now })], exploits: [], news: [] };
  const r = await publishToTelegram(env, d, kv, now + 300e3, { fetchImpl: tg.fetchImpl });
  assert.equal(r.alerts, 1);
  const dms = tg.sent().filter(m => m.chat_id !== "@bcyberaware");
  assert.deepEqual(dms.map(m => m.chat_id).sort(), ["1", "3"]);
  assert.match(dms[0].text, /For your industry:<\/b> 🏥 Healthcare/);
  assert.deepEqual(await kv.get("telegram:outbox:v1"), []);
});

test("users who block the bot are dropped; the outbox survives rate limits", async () => {
  const kv = new KV(), tg = fakeTg({ blocked: new Set(["1"]) }), now = at(23, 2, 0);
  await publishToTelegram(env, { advisories: [], exploits: [], news: [] }, kv, now, { fetchImpl: tg.fetchImpl });
  await kv.put("telegram:subs:v1", JSON.stringify({ 1: { s: ["health"] }, 3: { s: ["health"] } }));
  await publishToTelegram(env, { advisories: [item({ ts: now })], exploits: [], news: [] }, kv, now + 300e3, { fetchImpl: tg.fetchImpl });
  assert.deepEqual(Object.keys(await kv.get("telegram:subs:v1")), ["3"]);
  assert.deepEqual(await kv.get("telegram:outbox:v1"), []);
});

test("personal morning briefs are queued for every subscriber at 09:00 IST", async () => {
  const kv = new KV(), tg = fakeTg();
  await publishToTelegram(env, { advisories: [], exploits: [], news: [] }, kv, at(23, 2, 0), { fetchImpl: tg.fetchImpl });
  await kv.put("telegram:subs:v1", JSON.stringify({ 7: { s: ["finance"] } }));
  tg.calls.length = 0;
  const now = at(23, 3, 31);
  const r = await publishToTelegram(env, { advisories: [item({ id: "old", ts: now - 9 * 86400e3 }), item({ id: "b", cve_ids: ["CVE-2026-2"], ts: now, priority: { score: 60, label: "PATCH SOON", reasons: ["x"] } })], exploits: [], news: [] }, kv, now, { fetchImpl: tg.fetchImpl });
  assert.equal(r.digest, true);
  const dm = tg.sent().find(m => m.chat_id === "7");
  assert.match(dm.text, /Your industry brief/); assert.match(dm.text, /Nothing urgent for your industries/);
});

test("Friday pulse poll is posted once a week at 18:00 IST", async () => {
  const kv = new KV(), tg = fakeTg();
  const d = { advisories: [item(), item({ id: "y", cve_ids: ["CVE-2026-3"], title: "Fortinet VPN zero-day" })], exploits: [], news: [] };
  await publishToTelegram(env, d, kv, at(27, 2, 0), { fetchImpl: tg.fetchImpl });
  await publishToTelegram(env, d, kv, at(27, 12, 35), { fetchImpl: tg.fetchImpl });
  await publishToTelegram(env, d, kv, at(27, 12, 40), { fetchImpl: tg.fetchImpl });
  const polls = tg.calls.filter(c => c.method === "sendPoll");
  assert.equal(polls.length, 1);
  assert.equal(polls[0].body.options.at(-1).text, "None of these affect us");
});

test("industry picker fits Telegram's limits", () => {
  const kb = industryKeyboard(["health"]).inline_keyboard.flat();
  assert.ok(kb.every(b => Buffer.byteLength(b.callback_data) <= 64));
  assert.ok(kb.length <= 100);
});

test("CVE lookup of a real item from the live sample", () => {
  const d = feed(at(23, 10, 0));
  const cve = [...d.advisories, ...d.exploits].flatMap(a => a.cve_ids || [])[0];
  assert.match(formatCve(d, cve), new RegExp(cve));
});
