/* print/*.html を A4 の PDF にする（Playwright の Chromium を つかう）。
   node tools/print_pdf.mjs            … 3つ ぜんぶ
   node tools/print_pdf.mjs poster     … 指定したものだけ
   はみ出しが あると 中止する（A4 1ページに 収まっているかの 見はり） */
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const names = process.argv.slice(2).length ? process.argv.slice(2) : ['poster', 'cards', 'manual'];
const exe = '/opt/pw-browsers/chromium';
const br = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}).catch(() => chromium.launch({ executablePath: exe }));
const page = await (await br.newContext({ viewport: { width: 820, height: 1160 } })).newPage();
let bad = 0;
for (const name of names) {
  const src = path.join(root, 'print', name + '.html');
  await page.goto('file://' + src);
  await page.emulateMedia({ media: 'print' });
  await page.waitForTimeout(250);
  const fit = await page.evaluate(() => [...document.querySelectorAll('.page')].map((p) => {
    const cs = getComputedStyle(p);
    const inner = p.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    let used = 0;
    [...p.children].forEach((c) => {
      if (getComputedStyle(c).position === 'absolute') return;
      used += c.getBoundingClientRect().height + parseFloat(getComputedStyle(c).marginTop || 0);
    });
    return Math.round(used - inner);
  }));
  const over = fit.filter((x) => x > 0);
  if (over.length) { console.error(`${name}: ページから はみ出しています（${fit.join(', ')}px）`); bad++; continue; }
  await page.pdf({ path: path.join(root, 'print', name + '.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
  console.log(name + '.pdf', 'ok', '(' + fit.map((x) => x + 'px') + ' あまり)');
}
await br.close();
process.exit(bad ? 1 : 0);
