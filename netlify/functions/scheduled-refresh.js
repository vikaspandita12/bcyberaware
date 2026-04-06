/**
 * BCyberAware – Scheduled Auto-Refresh
 * Author  : Vikas Pandita | BCyberAware
 *
 * Runs every 15 minutes automatically via Netlify Scheduled Functions.
 * Pings the proxy to fetch fresh data from all 14 sources.
 * Keeps advisories always up to date — even with zero visitors.
 *
 * Schedule: every 15 minutes  →  "*/15 * * * *"
 */

exports.handler = async () => {
  const BASE_URL = process.env.URL || "https://bcyberawarebyvikaspandita.netlify.app";

  try {
    console.log(`[BCyberAware] Scheduled refresh started at ${new Date().toUTCString()}`);

    // Ping the proxy with bust=1 to force a fresh fetch ignoring cache
    const r = await fetch(`${BASE_URL}/.netlify/functions/proxy?action=feed&bust=1`, {
      headers: { "User-Agent": "BCyberAware-Scheduler/1.0" },
    });

    if (!r.ok) {
      console.error(`[BCyberAware] Refresh failed: HTTP ${r.status}`);
      return { statusCode: r.status, body: `Refresh failed: ${r.status}` };
    }

    const data = await r.json();
    const count = (data.advisories?.length||0) + (data.exploits?.length||0) + (data.news?.length||0);

    console.log(`[BCyberAware] Refresh complete. ${count} items fetched at ${data.fetched_at_human}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok:        true,
        items:     count,
        timestamp: data.fetched_at_human,
      }),
    };
  } catch(e) {
    console.error(`[BCyberAware] Scheduler error: ${e.message}`);
    return { statusCode: 500, body: e.message };
  }
};
