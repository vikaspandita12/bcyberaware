// Run with: npm test
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { prepareStories, scoreAndAdvise, clusterStories, exploitationEvidence, cvssOf, buildAction } from "../functions/_shared/intel-core.js";
import { parseActionDetail } from "../functions/_shared/feed-core.js";

const sample = JSON.parse(fs.readFileSync(new URL("./fixtures/live-sample.json", import.meta.url), "utf8"));
const fresh = () => JSON.parse(JSON.stringify({ advisories: sample.advisories, exploits: sample.exploits, news: sample.news }));
const run = () => { const out = prepareStories(fresh()); scoreAndAdvise({ ...out, now: sample.fetched_at }); return out; };
const storyOf = (news, source, starts) => news.find(a => [a, ...(a.also || [])].some(x => x.source === source && x.title.startsWith(starts)));

test("same story from several outlets becomes one card", () => {
  const { news } = run();
  const together = [
    [["Security Affairs", "Russia-Linked APT Turla"], ["Infosecurity Magazine", "Russia-Linked Turla Hijacks"]],
    [["GBHackers", "Railway Security Breach"], ["The Hacker News", "Railway Says Stolen"]],
    [["GBHackers", "Notion AI Data Breach"], ["The Record", "AI company Fireworks"]],
    [["SecurityWeek", "Threat Actors Exploit Openwave"], ["The Hacker News", "Cisco BroadWorks and Openwave"]],
    [["GBHackers", "N-able Warns"], ["Rapid7", "Critical vulnerabilities in N-able"]],
    [["Malwarebytes Labs", "Microsoft Patch Tuesday fixes Outlook"], ["CyberScoop", "Microsoft fixes over 1,000"]],
    [["CyberScoop", "CISA director pick"], ["The Register", "Trump taps Palantir"]],
  ];
  for (const [a, b] of together) {
    const sa = storyOf(news, ...a), sb = storyOf(news, ...b);
    assert.ok(sa && sb, `both present: ${a[1]} / ${b[1]}`);
    assert.equal(sa, sb, `should be one card: ${a[1]} + ${b[1]}`);
    assert.ok(sa.sources_count >= 2);
  }
  assert.ok(news.length <= sample.news.length - 12, `merged at least 12 duplicates (${sample.news.length} → ${news.length})`);
});

test("different stories are not merged", () => {
  const { news } = run();
  const apart = [
    [["GBHackers", "Fortinet2Shell"], ["The Hacker News", "Git Patches Flaw"]],
    [["The Record", "Britain, France set out"], ["Telegram: DarkFeed", "Who Hacked Fridges"]],
    [["GBHackers", "BluePhishing Attack"], ["Help Net Security", "Microsoft researchers demonstrate"]],
    [["SecurityWeek", "Chipmaker Patch Tuesday"], ["Malwarebytes Labs", "Microsoft Patch Tuesday fixes Outlook"]],
    [["The Hacker News", "Cisco BroadWorks and Openwave"], ["Security Affairs", "U.S. CISA adds IBM"]],
    [["SecurityWeek", "Fortinet Patches Nearly 100"], ["GBHackers", "Fortinet2Shell"]],
  ];
  for (const [a, b] of apart) assert.notEqual(storyOf(news, ...a), storyOf(news, ...b), `must stay separate: ${a[1]} / ${b[1]}`);
  // a source never appears twice in one merged card
  for (const s of news.filter(a => a.also)) assert.equal(new Set([s.source, ...s.also.map(o => o.source)]).size, s.sources_count);
});

test("'exploited in the wild' needs evidence, not just the word exploit", () => {
  const none = new Set();
  const ev = (title, summary = "", source = "X") => exploitationEvidence({ title, summary, source, cve_ids: [] }, none);
  assert.equal(ev("Multiple Vulnerabilities in Fortinet Products Could Allow for Arbitrary Code Execution", "Successful exploitation could allow an attacker to execute code.").wild, false);
  assert.equal(ev("Cisco Identity Services Engine Authorization Bypass Vulnerabilities", "An attacker could exploit this vulnerability by sending a crafted request.").wild, false);
  assert.equal(ev("Vendor advisory", "The vendor is not aware of any active exploitation.").wild, false);
  assert.equal(ev("Recently Patched Barracuda Vulnerabilities Exploited in Attacks").wild, true);
  assert.equal(ev("N-able Warns of Critical N-central Zero-Day Vulnerability Actively Exploited by Hackers").wild, true);
  assert.equal(ev("SonicWall security advisory", "SonicWall indicates that CVE-2026-19868 is being exploited.").wild, true);
  assert.equal(ev("[remote] Some App 1.0 - Remote Code Execution", "", "Exploit-DB").wild, false);
  assert.equal(ev("[remote] Some App 1.0 - Remote Code Execution", "", "Exploit-DB").pub, true);
  assert.equal(exploitationEvidence({ title: "x", summary: "", source: "GHSA", cve_ids: ["CVE-2026-1"] }, new Set(["CVE-2026-1"])).kev, true);
  const { advisories, exploits, news } = run();
  const all = [...advisories, ...exploits, ...news];
  const loose = [...sample.advisories, ...sample.exploits, ...sample.news].filter(a => a.exploit_in_wild).length;
  const strict = all.filter(a => a.exploit_in_wild).length;
  assert.ok(strict >= 15 && strict < loose / 2, `strict ${strict} vs old loose flag ${loose}`);
});

test("CVSS is read from text when the field is empty", () => {
  assert.equal(cvssOf({ title: "x", summary: "A CVSS score 7.0 AV:L/AC:H severity vulnerability" }), 7.0);
  assert.equal(cvssOf({ title: "x", summary: "CVSSv3 Score: 7.5 An allocation of resources" }), 7.5);
  assert.equal(cvssOf({ title: "x", summary: "no score here, version 12.4" }), null);
  assert.equal(cvssOf({ cvss: 9.8, title: "x", summary: "CVSS score 5.0" }), 9.8);
});

test("priority score: evidence drives the ranking and reasons are always given", () => {
  const { advisories, exploits, news } = run();
  const all = [...advisories, ...exploits, ...news];
  for (const a of all) {
    assert.ok(a.priority.score >= 0 && a.priority.score <= 100);
    assert.ok(["ACT NOW", "THIS WEEK", "PLAN", "MONITOR"].includes(a.priority.label));
    if (a.priority.score >= 30) assert.ok(a.priority.reasons.length >= 2, a.title);
  }
  const top = [...all].sort((x, y) => y.priority.score - x.priority.score);
  assert.ok(top.slice(0, 5).every(a => a.kev || a.exploit_in_wild), "top 5 all have exploitation evidence");
  const barracuda = all.find(a => a.source === "CISA KEV" && /Barracuda/.test(a.title));
  assert.equal(barracuda.priority.label, "ACT NOW");
  const funding = all.find(a => /Raises \$50 Million/.test(a.title));
  assert.equal(funding.priority.label, "MONITOR");
  assert.equal(funding.action, undefined);
  const hypothetical = all.find(a => a.source === "CIS Advisories" && /Fortinet/.test(a.title));
  assert.ok(hypothetical.priority.score < 50 && !hypothetical.exploit_in_wild);
  const actNow = all.filter(a => a.priority.label === "ACT NOW").length;
  assert.ok(actNow >= 1 && actNow <= 12, `ACT NOW stays a short list (${actNow})`);
});

test("action guidance is specific to the kind of issue", () => {
  const { advisories, exploits, news } = run();
  const all = [...advisories, ...exploits, ...news];
  const kev = all.filter(a => a.source === "CISA KEV");
  assert.ok(kev.length && kev.every(a => a.action && a.action.do_now && a.action.hunt));
  assert.equal(all.find(a => a.source === "CISA KEV" && /Barracuda.*Authentication Bypass/.test(a.title)).action.playbook, "edge");
  assert.equal(all.find(a => a.source === "CISA KEV" && /Chromium/.test(a.title)).action.playbook, "browser");
  assert.equal(all.find(a => /Outlook flaw already under attack/.test(a.title)).action.playbook, "patch-cycle");
  for (const a of all.filter(a => a.action)) assert.ok(!/^(Attacks|Admin Access)$/.test(a.action.affected || ""), a.title);
  const due = buildAction({ title: "X Command Injection Vulnerability", summary: "", source: "CISA KEV", affected_products: ["Acme Acme Router"], kev_due: "02 Dec 2026" });
  assert.equal(due.deadline, "02 Dec 2026");
  assert.equal(due.affected, "Acme Router");
});

test("AI detail is rejected unless grounded in the item's own text", () => {
  const item = { title: "Barracuda Email Security Gateway Authentication Bypass", summary: "Barracuda ESG versions 9.2.1 and earlier contain an authentication bypass.", cve_ids: ["CVE-2026-11100"] };
  const ok = parseActionDetail("IN SHORT: Attackers can log in to Barracuda email gateways without credentials, giving them control of mail flow.\nAFFECTED: Barracuda ESG 9.2.1 and earlier", item);
  assert.equal(ok.affected, "Barracuda ESG 9.2.1 and earlier");
  assert.equal(parseActionDetail("IN SHORT: Attackers can log in to Barracuda gateways version 10.4.2 without credentials today.\nAFFECTED: x", item), null);
  assert.equal(parseActionDetail("IN SHORT: Attackers exploit CVE-2026-99999 to log in to Barracuda gateways without credentials.\nAFFECTED: x", item), null);
  assert.equal(parseActionDetail("Sure! Here is a summary of the advisory you provided.", item), null);
  assert.equal(parseActionDetail("IN SHORT: Attackers can log in to Barracuda email gateways without any credentials today.\nAFFECTED: Not stated", item).affected, undefined);
});

test("clustering a single item or none is safe", () => {
  assert.deepEqual(clusterStories([]), []);
  assert.equal(clusterStories([{ title: "A", summary: "", source: "S", ts: 1 }])[0].sources_count, 1);
});
