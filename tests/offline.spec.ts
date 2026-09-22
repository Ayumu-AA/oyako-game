/* 機内モードで 一通り 遊べるか（Service Worker の キャッシュ） */
import { test, expect } from '@playwright/test';

test('一度 開いたあと オフラインでも 起動して 遊べる', async ({ browser }) => {
  test.slow();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  const errs: string[] = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('./');
  await expect(page.locator('#s-title')).toBeVisible();
  /* SW が 入って 先読みが 終わるまで 待つ */
  await page.waitForFunction(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    return !!(r && r.active);
  }, null, { timeout: 30000 });
  await page.waitForFunction(async () => {
    const keys = await caches.keys();
    for (const k of keys) { const c = await caches.open(k); const n = (await c.keys()).length; if (n > 200) return true; }
    return false;
  }, null, { timeout: 60000 });
  /* 最初の読み込みは SW の管理下にないので、一度 オンラインで 読みなおしてから 切る */
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
  await ctx.setOffline(true);
  await page.reload();
  await expect(page.locator('#s-title')).toBeVisible({ timeout: 15000 });
  /* えいご（絵は キャッシュから） */
  await page.click('[data-players="2"]'); await page.click('[data-level="2"]');
  await page.click('[data-group="relay"]'); await page.click('[data-mode="eigo"]'); await page.click('#btn-start');
  await expect(page.locator('#s-play')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('#flagbox img')).toBeVisible();
  const ok = await page.locator('#flagbox img').evaluate((im: HTMLImageElement) => im.complete && im.naturalWidth > 0);
  expect(ok).toBe(true);
  await page.click('#btn-ok');
  await expect(page.locator('#score')).toHaveText('1');
  /* 記録は 端末に 残り、キューに 積まれる */
  await page.click('#btn-pause'); await page.click('#btn-quit');
  const q = await page.evaluate(() => JSON.parse(localStorage.getItem('oyako-queue') || '[]'));
  expect(q.length).toBeGreaterThan(0);
  expect(errs).toEqual([]);
  await ctx.close();
});

test('掲示ページは Service Worker が 入ったあとも 本体に すりかわらない', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 700 } });
  const page = await ctx.newPage();
  await page.goto('./');
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.active, null, { timeout: 30000 });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
  await page.goto('./board.html?e=TEST');
  await expect(page.locator('.bhead h1')).toHaveText('親子ゲーム ランキング');
  await expect(page.locator('.bev')).toHaveText('TEST');
  await page.goto('./?e=TEST');
  await expect(page.locator('#s-title')).toBeVisible();
  await ctx.close();
});
