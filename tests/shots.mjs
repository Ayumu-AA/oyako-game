// v1 と v2 の 同じ画面を 並べて 撮る（見た目が 同じかを 目で 確かめる）
import { chromium } from '@playwright/test';
const V1 = 'http://localhost:8000/index.html';
const V2 = 'http://localhost:4173/oyako-game/';
const out = process.argv[2] || '/tmp/claude-0/-home-claude/2923a584-d943-58d9-94ec-cb5af3e033cd/scratchpad/shots';
import fs from 'node:fs'; fs.mkdirSync(out, { recursive: true });

const CHROME = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(fs.existsSync(CHROME) ? { executablePath: CHROME } : {});
const errors = [];
async function run(name, url, steps) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 1, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(name + ': ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_TUNNEL|fonts\.g/.test(m.text())) errors.push(name + ' console: ' + m.text()); });
  await page.goto(url); await page.waitForTimeout(600);
  await steps(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/${name}.png` });
  await ctx.close();
}
const flows = {
  title: async () => {},
  sub: async (p) => { await p.click('[data-group="relay"]'); },
  how: async (p) => { await p.click('[data-group="relay"]'); await p.click('[data-mode="pref"]'); },
  rules: async (p) => { await p.click('[data-group="relay"]'); await p.click('[data-mode="pref"]'); await p.click('#btn-rules'); },
  howbattle: async (p) => { await p.click('[data-group="battle"]'); },
  howcross: async (p) => { await p.click('[data-group="cross"]'); },
  settings: async (p) => { await p.click('#btn-settings'); },
  play: async (p) => { await p.click('[data-group="relay"]'); await p.click('[data-mode="pref"]'); await p.click('#btn-start'); await p.waitForSelector('#s-play.on, #s-play', { timeout: 5000 }); await p.waitForTimeout(2800); },
  math: async (p) => { await p.click('[data-group="solo"]'); await p.click('[data-mode="math"]'); await p.click('#btn-start'); await p.waitForTimeout(2800); },
  geo: async (p) => { await p.click('[data-group="geo"]'); await p.click('[data-mode="geopref"]'); await p.click('#btn-start'); await p.waitForTimeout(2800); },
  battle: async (p) => { await p.click('[data-group="battle"]'); await p.click('#btn-start'); await p.waitForTimeout(3600); },
  cross: async (p) => { await p.click('[data-group="cross"]'); await p.click('#btn-start'); await p.waitForTimeout(500); },
  numcross: async (p) => { await p.click('[data-group="solo"]'); await p.click('[data-mode="numcross"]'); await p.click('#btn-start'); await p.waitForTimeout(500); },
};
const only = process.argv[3] ? process.argv[3].split(',') : Object.keys(flows);
for (const k of only) {
  await run('v1-' + k, V1, flows[k]);
  await run('v2-' + k, V2, flows[k]);
}
await browser.close();
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('ok', only.join(','));
