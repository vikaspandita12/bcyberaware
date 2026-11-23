import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pingIndexNow, sitemapXml, INDEXNOW_KEY } from "../functions/_shared/indexnow-core.js";

const kvMock = () => { const m = new Map(); return { get: async k => m.get(k) ?? null, put: async (k, v) => { m.set(k, v); } }; };

test("key file matches the key", () => {
  assert.equal(readFileSync(new URL(`../${INDEXNOW_KEY}.txt`, import.meta.url), "utf8"), INDEXNOW_KEY);
});

test("sitemap lists the homepage with today's date", () => {
  const x = sitemapXml(Date.UTC(2026, 10, 23));
  assert.match(x, /<loc>https:\/\/advisory\.bcyberaware\.co\.in\/<\/loc><lastmod>2026-11-23<\/lastmod>/);
});

test("pings once per day", async () => {
  const env = { FEED_KV: kvMock() }; let calls = 0; let body;
  const fetchImpl = async (_u, o) => { calls++; body = JSON.parse(o.body); return { status: 200 }; };
  const now = Date.UTC(2026, 10, 23, 5);
  assert.deepEqual(await pingIndexNow(env, now, { fetchImpl }), { status: 200 });
  assert.equal(body.key, INDEXNOW_KEY);
  assert.equal(body.host, "advisory.bcyberaware.co.in");
  assert.ok((await pingIndexNow(env, now + 3600e3, { fetchImpl })).skipped);
  await pingIndexNow(env, now + 86400e3, { fetchImpl });
  assert.equal(calls, 2);
});

test("never throws on network error", async () => {
  const r = await pingIndexNow({}, Date.now(), { fetchImpl: async () => { throw new Error("down"); } });
  assert.match(r.error, /down/);
});
