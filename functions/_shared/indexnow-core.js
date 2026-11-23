/**
 * Search-engine notifications without any account.
 * IndexNow (Bing, Yandex, Seznam, Naver, Yep) is pinged once a day so the live feed is
 * re-crawled. The key is public by design: it is served at /d307350958a0efd5eca735f2ee4adfa9.txt to prove ownership.
 */
export const SITE = "https://advisory.bcyberaware.co.in";
export const INDEXNOW_KEY = "d307350958a0efd5eca735f2ee4adfa9";
const KV_LAST_PING = "indexnow:last_day";

export function sitemapXml(now = Date.now()) {
  const day = new Date(now).toISOString().slice(0, 10);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc><lastmod>${day}</lastmod><changefreq>hourly</changefreq><priority>1.0</priority></url>
  <url><loc>${SITE}/feed.xml</loc><lastmod>${day}</lastmod><changefreq>hourly</changefreq><priority>0.5</priority></url>
</urlset>
`;
}

export function handleSitemapRequest(now = Date.now()) {
  return new Response(sitemapXml(now), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}

/** Ping IndexNow at most once per UTC day. Never throws. */
export async function pingIndexNow(env, now = Date.now(), { fetchImpl = fetch } = {}) {
  const store = env?.FEED_KV;
  const day = new Date(now).toISOString().slice(0, 10);
  try {
    if (store && (await store.get(KV_LAST_PING)) === day) return { skipped: "already pinged today" };
    const res = await fetchImpl("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: new URL(SITE).host,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
        urlList: [`${SITE}/`, `${SITE}/feed.xml`],
      }),
    });
    if (store && res.status < 300) await store.put(KV_LAST_PING, day, { expirationTtl: 3 * 86400 });
    return { status: res.status };
  } catch (e) {
    return { error: String(e?.message || e).slice(0, 120) };
  }
}
