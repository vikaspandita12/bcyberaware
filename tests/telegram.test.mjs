// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { prepareStories, scoreAndAdvise } from "../functions/_shared/intel-core.js";
import { publishToTelegram, formatAlert, formatDigest, pickDigest, channelUrl, telegramConfigured } from "../functions/_shared/telegram-core.js";

const sample = JSON.parse(fs.readFileSync(new URL("./fixtures/live-sample.json", import.meta.url), "utf8"));
function feed(now) {
  const d = JSON.parse(JSON.stringify({ advisories: sample.advisories, exploits: sample.exploits, news: sample.news }));
  const shift = now - sample.fetched_at; // make the sample "today"
  for (const k of ["advisories", "exploits", "news"]) for (const a of d[k]) if (a.ts) a.ts += shift;
  const out = prepareStories(d); scoreAndAdvise({ ...out, now }); return out;
}
class KV { constructor() { this.m = new Map(); } async get(k) { const v = this.m.get(k); return v == null ? null : JSON.parse(v); } async put(k, v) { this.m.set(k, v); } }
const env = { TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_CHANNEL: "@bcyberaware" };
function fakeTelegram(fail) {
  const sent = [];
  const fetchImpl = async (url, init) => {
    if (url.includes("/getUpdates")) return new Response(JSON.stringify({ ok: true, result: [] }), { status: 200 });
    assert.ok(url.startsWith("https://api.telegram.org/bot123:abc/sendMessage"));
    const body = JSON.parse(init.body); sent.push(body);
    if (fail) return new Response(JSON.stringify({ ok: false, description: "Forbidden: bot is not a member of the channel chat" }), { status: 403 });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  return { sent, fetchImpl };
}
const at = (h, m) => Date.UTC(2026, 10, 21, h, m);

test("does nothing until both secrets are set", async () => {
  const kv = new KV(), t = fakeTelegram();
  const r = await publishToTelegram({ TELEGRAM_BOT_TOKEN: "x" }, feed(at(10, 0)), kv, at(10, 0), { fetchImpl: t.fetchImpl });
  assert.equal(r.configured, false); assert.equal(t.sent.length, 0); assert.equal(kv.m.size, 0);
  assert.equal(telegramConfigured(env), true);
  assert.equal(channelUrl(env), "https://t.me/bcyberaware");
  assert.equal(channelUrl({ TELEGRAM_CHANNEL: "-1001234" }), null);
});

test("first run records current alerts silently instead of flooding the channel", async () => {
  const kv = new KV(), t = fakeTelegram();
  const r = await publishToTelegram(env, feed(at(2, 0)), kv, at(2, 0), { fetchImpl: t.fetchImpl });
  assert.equal(r.alerts, 0); assert.equal(r.digest, false); assert.equal(t.sent.length, 0);
  assert.ok(kv.m.get("telegram:state:v1"));
  const again = await publishToTelegram(env, feed(at(2, 5)), kv, at(2, 5), { fetchImpl: t.fetchImpl });
  assert.equal(again.alerts, 0, "already-known alerts are never re-posted");
});

test("new ACT NOW item is posted once, with what to do", async () => {
  const kv = new KV(), t = fakeTelegram();
  const now = at(2, 0), d = feed(now);
  await publishToTelegram(env, d, kv, now, { fetchImpl: t.fetchImpl }); // baseline
  const fresh = { id: "NEW-1", title: "Fortinet FortiGate <script> SSL-VPN auth bypass exploited", summary: "", source: "CISA KEV", source_url: "https://example.com/a?x=1&y=2", ts: now, cve_ids: ["CVE-2026-999999"],
    priority: { score: 82, label: "ACT NOW", reasons: ["On CISA's Known Exploited Vulnerabilities list", "Internet-facing or perimeter product"] },
    action: { affected: "Fortinet FortiGate", do_now: "Patch the appliance now.", hunt: "x", deadline: "05 Dec 2026" } };
  d.advisories.unshift(fresh);
  const r = await publishToTelegram(env, d, kv, now + 300000, { fetchImpl: t.fetchImpl });
  assert.equal(r.alerts, 1); assert.equal(t.sent.length, 1);
  const msg = t.sent[0];
  assert.equal(msg.chat_id, "@bcyberaware"); assert.equal(msg.parse_mode, "HTML");
  assert.match(msg.text, /ACT NOW · 82\/100/); assert.match(msg.text, /Do now:<\/b> Patch the appliance now\./); assert.match(msg.text, /CISA deadline:<\/b> 05 Dec 2026/);
  assert.match(msg.text, /&lt;script&gt;/, "titles are HTML-escaped"); assert.match(msg.text, /x=1&amp;y=2/);
  const r2 = await publishToTelegram(env, d, kv, now + 600000, { fetchImpl: t.fetchImpl });
  assert.equal(r2.alerts, 0); assert.equal(t.sent.length, 1, "posted only once");
});

test("morning brief goes out once a day at 09:00 IST with the top 5", async () => {
  const kv = new KV(), t = fakeTelegram();
  await publishToTelegram(env, feed(at(3, 0)), kv, at(3, 0), { fetchImpl: t.fetchImpl });
  assert.equal(t.sent.length, 0, "not before 03:30 UTC");
  const r = await publishToTelegram(env, feed(at(3, 30)), kv, at(3, 30), { fetchImpl: t.fetchImpl });
  assert.equal(r.digest, true); assert.equal(t.sent.length, 1);
  assert.match(t.sent[0].text, /morning brief · 21 Nov 2026/); assert.equal((t.sent[0].text.match(/^\d\. /gm) || []).length, 5);
  await publishToTelegram(env, feed(at(9, 0)), kv, at(9, 0), { fetchImpl: t.fetchImpl });
  assert.equal(t.sent.length, 1, "only one brief per day");
  const next = Date.UTC(2026, 10, 22, 3, 35);
  const r3 = await publishToTelegram(env, feed(next), kv, next, { fetchImpl: t.fetchImpl });
  assert.equal(r3.digest, true, "next day's brief");
});

test("a Telegram error is reported, nothing is marked as sent, and it never throws", async () => {
  const kv = new KV(), ok = fakeTelegram();
  await publishToTelegram(env, feed(at(2, 0)), kv, at(2, 0), { fetchImpl: ok.fetchImpl });
  const bad = fakeTelegram(true);
  const r = await publishToTelegram(env, feed(at(4, 0)), kv, at(4, 0), { fetchImpl: bad.fetchImpl });
  assert.equal(r.digest, false); assert.match(r.error, /not a member/);
  const good = fakeTelegram();
  const r2 = await publishToTelegram(env, feed(at(4, 5)), kv, at(4, 5), { fetchImpl: good.fetchImpl });
  assert.equal(r2.digest, true, "retried on the next run");
  const hang = await publishToTelegram(env, feed(at(4, 10)), new KV(), at(4, 10), { fetchImpl: () => new Promise(() => {}), timeoutMs: 50 });
  assert.equal(typeof hang, "object");
});

test("messages stay within Telegram's 4096-character limit", () => {
  const d = feed(at(10, 0));
  for (const a of [...d.advisories, ...d.exploits, ...d.news].filter(a => a.priority?.score >= 50)) assert.ok(formatAlert(a).length <= 4096);
  assert.ok(formatDigest(pickDigest(d), at(10, 0)).length <= 4096);
});

test("the status reports Telegram's error, then clears it after a success", async () => {
  const { telegramStatus } = await import("../functions/_shared/telegram-core.js");
  const kv = new KV();
  assert.deepEqual(await telegramStatus(kv), { state: "not run yet" });
  const bad = fakeTelegram(true);
  await publishToTelegram(env, feed(at(4, 0)), kv, at(4, 0), { fetchImpl: bad.fetchImpl });
  let st = await telegramStatus(kv);
  assert.match(st.last_error, /not a member/); assert.equal(st.brief_sent_for, null);
  const good = fakeTelegram();
  await publishToTelegram(env, feed(at(4, 5)), kv, at(4, 5), { fetchImpl: good.fetchImpl });
  st = await telegramStatus(kv);
  assert.equal(st.last_error, null); assert.ok(st.last_success_at); assert.equal(st.brief_sent_for, "2026-11-21");
});

test("live check explains what is wrong without exposing the token", async () => {
  const { checkTelegram, tokenFormat } = await import("../functions/_shared/telegram-core.js");
  const FAKE = "123456789:" + "X".repeat(35); // obviously fake test token
  assert.equal(tokenFormat(FAKE).looks_like_number_colon_secret, true);
  assert.equal(tokenFormat(FAKE).secret_part_full_length, true);
  assert.equal(tokenFormat("X".repeat(35)).looks_like_number_colon_secret, false);
  assert.equal(tokenFormat(" " + FAKE + "\n").extra_spaces, true);
  assert.equal(tokenFormat('"' + FAKE + '"').has_quotes, true);
  const api = handlers => async url => { const m = url.match(/bot[^/]+\/(\w+)/)[1]; const [status, body] = handlers[m]; return new Response(JSON.stringify(body), { status }); };
  let t0 = 1e12;
  const run = (h, tok = FAKE) => checkTelegram({ TELEGRAM_BOT_TOKEN: tok, TELEGRAM_CHANNEL: "@examplechannel" }, { fetchImpl: api(h), now: (t0 += 60000) });
  let r = await run({ getMe: [401, { ok: false, description: "Unauthorized" }] });
  assert.equal(r.token_valid, false); assert.match(r.verdict, /revoked or mistyped/);
  assert.ok(!JSON.stringify(r).includes("XXXX"), "token never echoed");
  r = await run({ getMe: [404, { ok: false, description: "Not Found" }] }, "X".repeat(35));
  assert.match(r.verdict, /malformed/);
  r = await run({ getMe: [200, { ok: true, result: { id: 1, username: "example_bot" } }], getChatMember: [200, { ok: true, result: { status: "left" } }] });
  assert.equal(r.bot_can_post, false); assert.match(r.verdict, /administrator/);
  r = await run({ getMe: [200, { ok: true, result: { id: 1, username: "example_bot" } }], getChatMember: [200, { ok: true, result: { status: "administrator", can_post_messages: true } }] });
  assert.equal(r.bot_can_post, true); assert.match(r.verdict, /All good/);
});

test("/test from the channel owner posts a test message; anyone else is refused", async () => {
  const kv = new KV();
  const now = at(12, 0), d = feed(now);
  const sent = [];
  let updates = [];
  const role = { 111: "creator", 222: "left" };
  const fetchImpl = async (url, init) => {
    if (url.includes("/getUpdates")) {
      const offset = Number(new URL(url).searchParams.get("offset"));
      return new Response(JSON.stringify({ ok: true, result: updates.filter(u => u.update_id >= offset) }));
    }
    if (url.includes("/getChatMember")) {
      const uid = new URL(url).searchParams.get("user_id");
      return new Response(JSON.stringify({ ok: true, result: { status: role[uid] || "left" } }));
    }
    sent.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ ok: true }));
  };
  await publishToTelegram(env, d, kv, now, { fetchImpl }); // first run: baseline + today's brief
  sent.length = 0;
  const msg = (id, from, text) => ({ update_id: id, message: { chat: { id: from, type: "private" }, from: { id: from }, text } });
  updates = [msg(1, 111, "/test"), msg(2, 222, "/test"), msg(3, 222, "/start")];
  const r = await publishToTelegram(env, d, kv, now + 300000, { fetchImpl });
  assert.equal(r.commands, 1);
  const toChannel = sent.filter(m => m.chat_id === "@bcyberaware");
  assert.equal(toChannel.length, 1); assert.match(toChannel[0].text, /Test message from BCyberAware/); assert.match(toChannel[0].text, /Top priority right now/);
  assert.match(sent.find(m => m.chat_id === 111).text, /Test message posted/);
  assert.match(sent.find(m => m.chat_id === 222 && /only the owner/.test(m.text)).text, /only the owner/);
  assert.ok(sent.some(m => m.chat_id === 222 && /Join the channel/.test(m.text)), "/start answered");
  sent.length = 0;
  await publishToTelegram(env, d, kv, now + 600000, { fetchImpl });
  assert.equal(sent.length, 0, "commands are handled once");
});
