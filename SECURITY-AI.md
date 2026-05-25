# AI Security Checklist — BCyberAware

Reference: [Awesome AI Security](https://github.com/vikaspandita12/awesome-ai-security)

**AI features:** AI-driven threat analysis and scoring

## Data

- [ ] Document all inputs to AI (feeds, APIs, user text)
- [ ] No API keys in client-side / GitHub Pages assets

## LLM safety

- [ ] [OWASP Top 10 for LLM](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [ ] Rate limits and input length on user → model paths
- [ ] Model output is informational only

## Hardening ideas

- [langkit](https://github.com/whylabs/langkit) · [LLM Guard](https://github.com/protectai/llm-guard)

**Tracking issue:** #8
