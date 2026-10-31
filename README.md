<p align="center">
  <img src="assets/bcyberaware-logo.svg" alt="BCyberAware Logo" width="200"/>
</p>

<h1 align="center">BCyberAware</h1>

<p align="center">
  <strong>AI-powered Threat Intelligence Dashboard</strong><br/>
  <em>by Vikas Pandita</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Security-Intelligence-blue?style=flat-square&logo=shield" alt="Security Intelligence"/>
  <img src="https://img.shields.io/badge/Powered%20By-AI-cyan?style=flat-square" alt="Powered by AI"/>
  <img src="https://img.shields.io/badge/Author-Vikas%20Pandita-blueviolet?style=flat-square" alt="Author"/>
</p>

---

## About

BCyberAware is an AI-powered Threat Intelligence Dashboard designed to help individuals and organisations stay informed about the latest cybersecurity threats, vulnerabilities, and best practices.

## Features

- Real-time threat intelligence feeds
- AI-driven threat analysis and scoring
- Interactive security dashboard
- Actionable cybersecurity insights

## AI Threat Analyst (free)

The floating **🛡️ Ask Threat Analyst** chat runs on [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/) — no API key, no third-party account. The free Workers plan includes **10,000 neurons/day** (roughly a few hundred chats with the default model). The assistant is grounded in the live feed snapshot, so it can answer "what's exploited in the wild right now?" from the dashboard's own data.

- Endpoint: `POST /api/chat` (streaming SSE) — see `functions/_shared/chat-core.js`
- Model: set `AI_MODEL` in `wrangler.jsonc` (default `@cf/meta/llama-3.1-8b-instruct-fast`; `@cf/meta/llama-3.3-70b-instruct-fp8-fast` for higher quality at ~6× the neuron cost)
- Guards: per-IP rate limit (20 msgs / 10 min), 1,200-char messages, 8-turn history, cybersecurity-only system prompt
- If the deploy fails on the `ai` binding, make sure the `CLOUDFLARE_API_TOKEN` has **Workers AI → Edit** permission

## Development

The dashboard UI lives in `src/app.jsx` and is precompiled to `app.js` (served as a static asset — no in-browser Babel).

```bash
npm install        # one-time setup
npm run build      # compile src/app.jsx → app.js (run after editing the UI)
npm run dev        # build + local server at http://localhost:8787
npm run deploy     # build + deploy to Cloudflare
```

> **Note:** after editing `src/app.jsx`, run `npm run build` and commit the regenerated `app.js` — the GitHub Action deploys files as-is.

---

<p align="center">
  <sub>Built with passion by <strong>Vikas Pandita</strong></sub>
</p>
