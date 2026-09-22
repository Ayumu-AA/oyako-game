/* v2 の 受け入れテスト：v1 と同じ挙動か（画面遷移・記録・判定・収まり） */
import { test, expect, type Page } from '@playwright/test';

const VPS = [[390, 844, 'iPhone14'], [375, 667, 'iPhoneSE'], [430, 932, 'ProMax'], [360, 640, 'Android小']] as const;

async function open(page: Page, seed?: Record<string, string>) {
  if (seed) await page.addInitScript((s) => { for (const k in s) localStorage.setItem(k, s[k]); }, seed);
  await page.goto('./');
  await expect(page.locator('#s-title')).toBeVisible();
}
/** ホームの 2択（何人で → がくねん）を 通って ゲーム一覧まで 行く */
async function nav(page: Page, players: 1 | 2 = 2, level: 1 | 2 = 2) {
  await page.click(`[data-players="${players}"]`);
  await page.click(`[data-level="${level}"]`);
  await expect(page.locator('#s-games')).toBeVisible();
}
const noErrors = (page: Page) => {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(e.message));
  return errs;
};
/** テンキーは pointerdown で受けるので dispatch する。
    同じキーの 60ms いないの 二重入力は 捨てる仕様なので、人の指と同じく 少し間をあける */
/** 赤いボタンで 回答権を とる（2人のときだけ 必要） */
async function buzz(page: Page, side: 'adult' | 'child') {
  await page.click(`#buzz-${side}`);
  await expect(page.locator(`#buzz-${side}`)).toHaveCount(0);   /* こたえが 出たら ボタンは 消える */
}
async function numkey(page: Page, side: 'adult' | 'child', k: string) {
  await page.locator(`#side-${side} .numkey[data-k="${k}"]`).dispatchEvent('pointerdown', { bubbles: true, cancelable: true });
  await page.waitForTimeout(80);
}

test('親子ヒントリレー：正解・パス・結果・まちがい帳', async ({ page }) => {
  const errs = noErrors(page);
  await open(page);
  await nav(page);
  await page.click('[data-group="relay"]');
  await expect(page.locator('#sub-title')).toHaveText('親子ヒントリレー');
  await page.click('[data-mode="pref"]');
  await expect(page.locator('#how-title')).toHaveText('都道府県');
  await page.click('#btn-start');
  await expect(page.locator('#s-play')).toBeVisible({ timeout: 6000 });
  await expect(page.locator('#hints li')).toHaveCount(3);
  const first = await page.locator('#answer').innerText();
  await page.click('#btn-ok');
  await expect(page.locator('#score')).toHaveText('1');
  await expect(page.locator('#answer')).not.toHaveText(first);
  const missed = await page.locator('#answer').innerText();
  await page.click('#btn-pass');
  /* 一時停止 → こたえが かくれる → つづける */
  await page.click('#btn-pause');
  await expect(page.locator('#overlay')).toBeVisible();
  await expect(page.locator('#card')).toHaveClass(/hidden-answer/);
  await page.click('#btn-resume');
  await expect(page.locator('#overlay')).toBeHidden();
  /* 時間切れを 待たずに 結果へ：残り時間を 0 に できないので 60秒設定で 待つのは 長い → タイトルへ戻って 記録だけ 確かめる */
  await page.click('#btn-pause'); await page.click('#btn-quit');
  await expect(page.locator('#s-title')).toBeVisible();
  await nav(page);
  await expect(page.locator('[data-tile="miss"]')).toBeVisible();
  await expect(page.locator('[data-tile="miss"] small')).toHaveText('のこり 1もん');
  const miss = await page.evaluate(() => JSON.parse(localStorage.getItem('oyako-miss') || '{}'));
  expect(Object.keys(miss)).toEqual(['pref:' + missed.replace(/\s/g, '').replace(/[ぁ-ん]+/g, '')]);
  /* まちがい直し */
  await page.click('[data-tile="miss"]');
  await expect(page.locator('#how-title')).toHaveText('まちがい直し');
  await expect(page.locator('#best-line')).toHaveText('まちがい帳に 1もん たまっています');
  await page.click('#btn-start');
  await expect(page.locator('#s-play')).toBeVisible({ timeout: 6000 });
  await page.click('#btn-ok');
  await page.click('#btn-pause'); await page.click('#btn-quit');
  await nav(page);
  await expect(page.locator('[data-tile="miss"]')).toBeHidden();
  expect(errs).toEqual([]);
});

test('結果画面：ランクと じこベスト（60秒）', async ({ page }) => {
  test.slow();
  await open(page);
  await page.click('#btn-settings'); await page.click('#seg-time button[data-v="60"]'); await page.click('#btn-set-close');
  await nav(page);
  await page.click('[data-group="relay"]'); await page.click('[data-mode="rika"]'); await page.click('#btn-start');
  await expect(page.locator('#s-play')).toBeVisible({ timeout: 6000 });
  for (let i = 0; i < 4; i++) { await page.click('#btn-ok'); await page.waitForTimeout(150); }
  await expect(page.locator('#s-result')).toBeVisible({ timeout: 65000 });
  await expect(page.locator('#final')).toHaveText('4');
  await expect(page.locator('#rank')).toHaveText('騎士級');       // 4問/60秒 = 4/分 → 騎士
  await expect(page.locator('#rank-pace')).toHaveText('60秒で 4もん');
  await expect(page.locator('#rank-next')).toHaveText('あと 2もんで 大臣級');
  await expect(page.locator('#newbest')).toBeVisible();
  await expect(page.locator('#recap-list li')).toHaveCount(4);
  await expect(page.locator('#btn-again')).toBeDisabled();
  await expect(page.locator('#btn-again')).toHaveText('もういちど', { timeout: 4000 });
  expect(await page.evaluate(() => localStorage.getItem('oyako-rika-2-60'))).toBe('4');
  /* ランキング：名前が 無いので 先に 決める → 今回の点数が 送信キューに 入る */
  await page.click('#btn-rank');
  await expect(page.locator('#name-ov')).toBeVisible();
  await page.fill('#nick-input', 'てすと'); await page.click('#btn-nick-ok');
  await expect(page.locator('#s-rank')).toBeVisible();
  await expect(page.locator('#rank-title')).toHaveText('りか');
  const q = await page.evaluate(() => JSON.parse(localStorage.getItem('oyako-queue') || '[]'));
  const sc = q.find((x: { k: string }) => x.k === 'score');
  expect(sc.row).toMatchObject({ mode: 'rika', level: 2, seconds: 60, score: 4, rank_i: 2, nickname: 'てすと', event_code: 'home' });
  expect(q.some((x: { k: string }) => x.k === 'profile')).toBe(true);
  await page.click('#btn-rank-back');
  await expect(page.locator('#s-title')).toBeVisible();
});

test('ランキング：タイトルから 入って 名前を 決める・NGワード・オフライン表示', async ({ page }) => {
  /* すでに つかわれている 名前の 控え（ふだんは サーバーから 取る。ここでは 端末の控えを 置いておく） */
  await open(page, { 'oyako-names-home': JSON.stringify(['ぱんだ', 'みどりのかに']) });
  await page.click('#btn-rank-title');
  await expect(page.locator('#s-rank')).toBeVisible();
  await page.click('#seg-rank-mode button[data-v="battle"]');
  await expect(page.locator('#rank-title')).toHaveText('はやおし親子バトル');
  await page.click('#btn-rank-name');
  await page.fill('#nick-input', 'ばかもの'); await page.click('#btn-nick-ok');
  await expect(page.locator('#nick-hint')).toHaveText('そのことばは つかえないよ');
  await page.fill('#nick-input', 'あ'); await page.click('#btn-nick-ok');
  await expect(page.locator('#nick-hint')).toHaveText('2もじ いじょうに してね');
  /* つかわれている 名前は はじく（カタカナで 入れても 同じ） */
  await page.fill('#nick-input', 'パンダ'); await page.click('#btn-nick-ok');
  await expect(page.locator('#nick-hint')).toHaveText('その なまえは つかわれているよ');
  await expect(page.locator('#name-ov')).toBeVisible();
  /* サイコロは かぶらない 候補を 出す */
  for (let i = 0; i < 5; i++) {
    await page.click('#btn-nick-dice');
    const v = await page.inputValue('#nick-input');
    expect(['ぱんだ', 'みどりのかに']).not.toContain(v);
  }
  await page.fill('#nick-input', 'こあら'); await page.click('#btn-nick-ok');
  await expect(page.locator('#name-ov')).toBeHidden();
  await expect(page.locator('#btn-rank-name')).toHaveText(/こあら/);
  expect(await page.evaluate(() => localStorage.getItem('oyako-nick'))).toBe('こあら');
  /* この環境からは Supabase に つながらない → 8秒で あきらめて 案内を 出す */
  await expect(page.locator('#rank-offline')).toHaveText('つながると 出ます', { timeout: 15000 });
  /* せってい からも 名前を 変えられる */
  await page.click('#btn-rank-back'); await page.click('#btn-settings');
  await expect(page.locator('#btn-set-name')).toHaveText('こあら　（かえる）');
  /* 自分の いまの名前は そのまま 通せる（つかわれている扱いに しない） */
  await page.click('#btn-set-name');
  await page.fill('#nick-input', 'こあら'); await page.click('#btn-nick-ok');
  await expect(page.locator('#name-ov')).toBeHidden();
});

test('10を作る：式を組んで 判定', async ({ page }) => {
  await open(page);
  await nav(page, 1);
  await page.click('[data-mode="math"]'); await page.click('#btn-start');
  await expect(page.locator('#s-play')).toBeVisible({ timeout: 6000 });
  await expect(page.locator('#numtiles button')).toHaveCount(4);
  await page.click('#btn-ok');
  await expect(page.locator('#verdict')).toHaveText(/数字を ぜんぶ使ってね/);
  /* こたえを見る → 例が出る → つぎへ */
  await page.click('#btn-hint');
  await expect(page.locator('#solution')).toHaveText(/^れい：.*＝10$/);
  await expect(page.locator('#btn-hint')).toHaveText('つぎへ');
  await page.click('#btn-hint');
  await expect(page.locator('#solution')).toBeHidden();
  /* 数字を 全部 + でつないで 判定文言を 確かめる */
  const nums = await page.locator('#numtiles button').allInnerTexts();
  for (let i = 0; i < 4; i++) { await page.click(`#numtiles button[data-i="${i}"]`); if (i < 3) await page.click('#ops button[data-op="＋"]'); }
  const sum = nums.reduce((a, b) => a + Number(b), 0);
  await page.click('#btn-ok');
  if (sum === 10) await expect(page.locator('#verdict')).toHaveText(/せいかい！/);
  else await expect(page.locator('#verdict')).toHaveText('ざんねん。' + sum + ' になったよ');
});

test('はやおしバトル：けいさんは テンキーで 桁数がそろったら 判定、3桁も 正しく', async ({ page }) => {
  const errs = noErrors(page);
  await open(page);
  await nav(page);
  await page.click('[data-mode="battle"]');
  await page.click('#seg-subject button[data-v="calc"]');
  await page.click('#seg-goal button[data-v="5"]');
  await page.click('#seg-handi button[data-v="0"]');
  await page.click('#btn-start');
  await expect(page.locator('#s-battle')).toBeVisible({ timeout: 8000 });
  let saw3 = false; let prevText: string | null = null;
  for (let n = 0; n < 5; n++) {
    await expect(page.locator('#buzz-adult')).toBeEnabled();
    if (prevText !== null) await expect(page.locator('#side-child .qtext')).not.toHaveText(prevText);
    const text = await page.locator('#side-child .qtext').innerText();
    prevText = text;
    const m = /(\d+)\s*([+−×÷])\s*(\d+)/.exec(text)!;
    const a = Number(m[1]), b = Number(m[3]);
    const ans = m[2] === '+' ? a + b : m[2] === '−' ? a - b : m[2] === '×' ? a * b : a / b;
    const s = String(ans); if (s.length === 3) saw3 = true;
    /* おとなが 赤いボタンを 取って わざと まちがえる（最後の桁を ずらす） → おてつき */
    let wrong = s.slice(0, -1) + String((Number(s.slice(-1)) + 1) % 10);
    if (wrong[0] === '0') wrong = '1' + wrong.slice(1);   /* 先頭の 0 は 打てない仕様 */
    await buzz(page, 'adult');
    await expect(page.locator('#side-child .numwrap')).toHaveCount(0);   /* 相手には テンキーは 出ない */
    for (const ch of wrong) await numkey(page, 'adult', ch);
    await expect(page.locator('#side-adult')).toHaveClass(/locked/);
    /* 回答権が こどもに 回ってくる */
    await buzz(page, 'child');
    for (const ch of s) await numkey(page, 'child', ch);
    await expect(page.locator('#sc-child')).toHaveText((n + 1) + '/5');
  }
  await expect(page.locator('#bfin')).toHaveClass(/on/);
  await expect(page.locator('#s-bresult')).toBeVisible({ timeout: 4000 });
  await expect(page.locator('#bwin')).toHaveText('こどもの かち');
  await expect(page.locator('#bs-child')).toHaveText('5');
  await expect(page.locator('#brank-pace')).toHaveText(/2人あわせて \d+秒で 5もん（5もん先取）/);
  expect(errs).toEqual([]);
  test.info().annotations.push({ type: '3桁', description: String(saw3) });
});

test('はやおしバトル：4たくは 同じ種類の 選たく肢（れきし）・ハンデ 子2・親4', async ({ page }) => {
  await open(page);
  await nav(page);
  await page.click('[data-mode="battle"]');
  await page.click('#seg-subject button[data-v="rekishi"]');
  await page.click('#btn-start');
  await expect(page.locator('#s-battle')).toBeVisible({ timeout: 8000 });
  /* はじめは 両方 赤いボタン。こたえは まだ 出ていない */
  await expect(page.locator('#buzz-child')).toBeEnabled();
  await expect(page.locator('#buzz-adult')).toBeEnabled();
  await expect(page.locator('#s-battle .choice')).toHaveCount(0);
  /* おとなが とる → おとなにだけ 4たく、こどもは 押せなくなる */
  await buzz(page, 'adult');
  await expect(page.locator('#side-adult .choice')).toHaveCount(4);
  await expect(page.locator('#side-child .choice')).toHaveCount(0);
  await expect(page.locator('#buzz-child')).toBeDisabled();
  /* ふりがな：漢字は かならず ruby の中 */
  const bare = await page.evaluate(() => {
    let n = 0;
    document.querySelectorAll('#s-battle .qtext, #s-battle .choice').forEach((el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let t; while ((t = walker.nextNode())) { if (/[一-鿿]/.test(t.textContent || '') && !(t.parentElement && t.parentElement.closest('ruby'))) n++; }
    });
    return n;
  });
  expect(bare).toBe(0);
  /* おとなが こたえる（合っていれば つぎの問題、まちがいなら 回ってくる）。
     どちらでも こどもは 赤いボタンを 押せて、こどもは ハンデで 2たく */
  const first = await page.evaluate(() => (document.querySelector('#side-adult .choice') as HTMLElement).dataset.a!);
  await page.click(`#side-adult .choice[data-a="${first}"]`);
  await page.waitForTimeout(700);
  await buzz(page, 'child');
  await expect(page.locator('#side-child .choice')).toHaveCount(2);
});

test('はやおしバトル：ことばは 例文が 問題・意味が 選たく肢。こどもが 上・おとなが 下。まちがえた問題を もう一回', async ({ page }) => {
  const errs = noErrors(page);
  await open(page);
  await nav(page);
  await page.click('[data-mode="battle"]');
  await page.click('#seg-subject button[data-v="kokugo"]');
  await page.click('#seg-goal button[data-v="5"]');
  await page.click('#btn-start');
  await expect(page.locator('#s-battle')).toBeVisible({ timeout: 8000 });
  /* ならび：こども（回転）→ まん中 → おとな（そのまま） */
  const order = await page.evaluate(() => [...document.querySelectorAll('#s-battle > .side, #s-battle > .mid')].map((e) => e.id || e.className));
  expect(order).toEqual(['side-child', 'mid', 'side-adult']);
  const rot = await page.evaluate(() => ({
    child: getComputedStyle(document.getElementById('side-child')!).transform,
    adult: getComputedStyle(document.getElementById('side-adult')!).transform,
    chip: getComputedStyle(document.getElementById('sc-child')!.parentElement!).transform,
    chipA: getComputedStyle(document.getElementById('sc-adult')!.parentElement!).transform,
  }));
  expect(rot.child).toBe('matrix(-1, 0, 0, -1, 0, 0)'); expect(rot.chip).toBe('matrix(-1, 0, 0, -1, 0, 0)');
  expect(rot.adult).toBe('none'); expect(rot.chipA).toBe('none');
  /* 問題は「」つきの 例文、選たく肢は 意味（ことば そのものは 出ない） */
  /* 文は 少しずつ 出るので、全文は 下じきの .ghost のほう */
  await expect(page.locator('#side-adult .qtext.ghost')).toHaveClass(/long/);
  expect(await page.locator('#side-adult .qtext.ghost').textContent()).toMatch(/「.+」/);
  await buzz(page, 'adult');
  const seen = await page.evaluate(() => [...document.querySelectorAll('#side-adult .choice')].map((b) => ({ a: (b as HTMLElement).dataset.a!, t: (b as HTMLElement).innerText })));
  expect(seen.length).toBe(4);
  for (const c of seen) { expect(c.t).not.toBe(c.a); expect(c.t.length).toBeGreaterThan(3); }
  /* こどもが わざと まちがえる → まちがい帳に 入る → 結果画面に「まちがえた問題を もう一回」 */
  const ans = await page.evaluate(() => {
    /* こたえは 例文の「」の中の ことば（活用あり）。ふりがな（rt）を 外して 先頭2文字で さがす */
    const qn = document.querySelector('#side-child .qtext')!.cloneNode(true) as HTMLElement;
    qn.querySelectorAll('rt').forEach((e) => e.remove());
    const segs = (qn.textContent || '').split('「').slice(1);   /* 「」は 例文の中に 2つ以上 あることもある */
    const c = [...document.querySelectorAll('#side-adult .choice')].map((b) => (b as HTMLElement).dataset.a!);
    const ans = c.find((o) => segs.some((g) => g.startsWith(o.slice(0, 2))))!;
    return { ans, wrong: c.find((o) => o !== ans)! };
  });
  expect(ans.ans).toBeTruthy(); expect(ans.wrong).toBeTruthy();
  await page.click(`#side-adult .choice[data-a="${ans.ans}"]`);
  await expect(page.locator('#sc-adult')).toHaveText('1/5');
  await expect(page.locator('#side-adult')).not.toHaveClass(/flash/);   /* つぎの問題 */
  await buzz(page, 'child');
  const wrong2 = await page.evaluate(() => {
    const qn = document.querySelector('#side-child .qtext')!.cloneNode(true) as HTMLElement;
    qn.querySelectorAll('rt').forEach((e) => e.remove());
    const segs = (qn.textContent || '').split('「').slice(1);
    const c = [...document.querySelectorAll('#side-child .choice')].map((b) => (b as HTMLElement).dataset.a!);
    return c.find((o) => !segs.some((g) => g.startsWith(o.slice(0, 2))))!;
  });
  await page.click(`#side-child .choice[data-a="${wrong2}"]`);   /* こどもが まちがえる（おとなは 答えない → まちがい帳に 残る） */
  await expect(page.locator('#side-child')).toHaveClass(/locked/);
  await page.click('#btn-bpause');
  await page.click('#btn-quit');
  await expect(page.locator('#s-title')).toBeVisible();
  const miss = JSON.parse(await page.evaluate(() => localStorage.getItem('oyako-miss') || '{}')) as Record<string, { n: number }>;
  expect(Object.keys(miss).filter((k) => k.startsWith('kokugo:') && miss[k].n > 0).length).toBe(1);
  /* 結果画面の ボタン（まちがい帳に 1つ あるので 出る） */
  await nav(page);
  await page.click('[data-mode="battle"]');
  await page.click('#seg-subject button[data-v="calc"]');
  await page.click('#seg-goal button[data-v="5"]'); await page.click('#seg-handi button[data-v="0"]');
  await page.click('#btn-start');
  await expect(page.locator('#s-battle')).toBeVisible({ timeout: 8000 });
  let prevText: string | null = null;
  for (let n = 0; n < 5; n++) {
    if (prevText !== null) await expect(page.locator('#side-child .qtext')).not.toHaveText(prevText);
    const text = await page.locator('#side-child .qtext').innerText();
    prevText = text;
    const m = /(\d+)\s*([+−×÷])\s*(\d+)/.exec(text)!;
    const a = Number(m[1]), b = Number(m[3]);
    const v = m[2] === '+' ? a + b : m[2] === '−' ? a - b : m[2] === '×' ? a * b : a / b;
    await buzz(page, 'child');
    for (const ch of String(v)) await numkey(page, 'child', ch);
    await expect(page.locator('#sc-child')).toHaveText((n + 1) + '/5');
  }
  await expect(page.locator('#s-bresult')).toBeVisible({ timeout: 6000 });
  await expect(page.locator('#btn-bmiss')).toBeVisible();
  await expect(page.locator('#btn-bmiss')).toBeEnabled({ timeout: 5000 });
  await page.click('#btn-bmiss');
  await expect(page.locator('#s-how')).toBeVisible();
  await expect(page.locator('#how-title')).toHaveText(/まちがい/);
  expect(errs).toEqual([]);
});

test('ちずクイズ：4たく・パス・県庁所在地', async ({ page }) => {
  await open(page);
  await nav(page);
  await page.click('[data-group="geo"]'); await page.click('[data-mode="geopref"]'); await page.click('#btn-start');
  await expect(page.locator('#s-geo')).toBeVisible({ timeout: 6000 });
  await expect(page.locator('.gchoice')).toHaveCount(4);
  await expect(page.locator('#geo-map svg .pf.hit')).toHaveCount(1);
  await expect(page.locator('#geo-sub')).toHaveText(/地方の 赤いところは どこ？|日本地図の 赤いところは どこ？/);
  await page.click('#btn-gpass');
  await expect(page.locator('#geo-bar')).toHaveClass(/ng/);
  await expect(page.locator('#geo-bartext')).toHaveText(/こたえは .+（県庁所在地は .+）/);
  await expect(page.locator('.gchoice.right')).toHaveCount(1);
  await page.waitForTimeout(1800);
  await expect(page.locator('#geo-bartext')).toHaveText('下の 4つから えらんでね');
  await page.click('.gchoice >> nth=0');
  await expect(page.locator('#geo-bar')).toHaveClass(/ok|ng/);
  await expect(page.locator('#btn-greset')).toBeHidden();
});

test('クロスワード：ここを開く で 全部うめると 完成', async ({ page }) => {
  test.slow();
  await open(page);
  await nav(page);
  await page.click('[data-mode="cross"]'); await page.click('#btn-start');
  await expect(page.locator('#s-cross')).toBeVisible();
  const left0 = Number(await page.locator('#cw-left').innerText());
  expect(left0).toBeGreaterThan(0);
  await page.click('#kbd button[data-k="あ"]');
  await page.click('.kbd2 button[data-k="゛"]');   // あ には つかない
  await page.click('.kbd2 button[data-k="小"]');
  await expect(page.locator('#cwgrid .cwcell.inword .ch >> nth=0')).toHaveText('ぁ');
  /* カギを 1つずつ えらんで「ここを開く」で うめる */
  await page.click('#btn-cluelist');
  const nClues = await page.locator('#cwclues .clue').count();
  for (let i = 0; i < nClues; i++) {
    if (await page.locator('#s-cresult').isVisible()) break;
    const clue = page.locator('#cwclues .clue').nth(i);
    const len = Number((/（(\d+)文字）/.exec(await clue.innerText()) || [])[1] || 6);
    await clue.click();
    for (let k = 0; k < len; k++) {
      if (await page.locator('#s-cresult').isVisible()) break;
      await page.click('.kbd2 button[data-k="hint"]');
    }
  }
  await expect(page.locator('#s-cresult')).toBeVisible();
  await expect(page.locator('#cw-msg')).toHaveText(/マスを \d+回 開けて かんせい！/);
  expect(Number(await page.evaluate(() => localStorage.getItem('oyako-cross-2')))).toBeGreaterThan(0);
  await page.click('#btn-cagain');
  await expect(page.locator('#s-cross')).toBeVisible();
});

test('クロスワード：さいしょから やりなおす は 同じ問題・フリック入力', async ({ page }) => {
  const errs = noErrors(page);
  await open(page);
  await nav(page);
  await page.click('[data-mode="cross"]');
  await page.click('#seg-kana button[data-v="F"]');
  expect(await page.evaluate(() => localStorage.getItem('oyako-kana'))).toBe('F');
  await page.click('#btn-start');
  await expect(page.locator('#s-cross')).toBeVisible();
  await expect(page.locator('#flick .fkey')).toHaveCount(12);
  await expect(page.locator('#kbd')).toHaveCount(0);
  const clue0 = await page.locator('#cwnow button.sel .txt').innerText();
  const first = page.locator('#cwgrid .cwcell.inword .ch >> nth=0');
  /* おしただけ → か。 うえに フリック → く。 ゛゜小 → ぐ → く */
  const key = page.locator('#flick .fkey[data-k="か"]');
  const box = (await key.boundingBox())!;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const flick = async (dx: number, dy: number) => {
    await key.dispatchEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, clientX: cx, clientY: cy, isPrimary: true });
    if (dx || dy) {
      await key.dispatchEvent('pointermove', { bubbles: true, pointerId: 1, clientX: cx + dx / 2, clientY: cy + dy / 2 });
      await expect(page.locator('#flick .flpop')).toBeVisible();
      await key.dispatchEvent('pointermove', { bubbles: true, pointerId: 1, clientX: cx + dx, clientY: cy + dy });
    }
    await key.dispatchEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, clientX: cx + dx, clientY: cy + dy });
  };
  await flick(0, 0);
  await expect(first).toHaveText('か');
  await page.click('.kbd2 button[data-k="del"]');
  await expect(first).toHaveText('');
  await flick(0, -40);
  await expect(first).toHaveText('く');
  await expect(page.locator('#flick .flpop')).toHaveCount(0);
  await flick(0, 0);   // 2マス目に か
  /* いまの か を ゛゜小 で まわす */
  const mod = page.locator('#flick .fkey.mod');
  const mb = (await mod.boundingBox())!;
  const tapMod = async () => {
    await mod.dispatchEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, clientX: mb.x + 10, clientY: mb.y + 10 });
    await mod.dispatchEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, clientX: mb.x + 10, clientY: mb.y + 10 });
  };
  await tapMod();
  await expect(page.locator('#cwgrid .cwcell.inword .ch >> nth=1')).toHaveText('が');
  await tapMod();
  await expect(page.locator('#cwgrid .cwcell.inword .ch >> nth=1')).toHaveText('か');
  /* さいしょから やりなおす → 同じカギ・マスは 空 */
  await page.click('#btn-cpause');
  await page.click('#btn-restart');
  await expect(page.locator('#s-cross')).toBeVisible();
  await expect(page.locator('#cwnow button.sel .txt')).toHaveText(clue0);
  await expect(first).toHaveText('');
  expect(errs).toEqual([]);
});

test('けいさんクロス：こたえあわせ', async ({ page }) => {
  await open(page);
  await nav(page, 1);
  await page.click('[data-mode="numcross"]'); await page.click('#btn-start');
  await expect(page.locator('#s-numcross')).toBeVisible();
  await page.click('#btn-nccheck');
  await expect(page.locator('#ncmsg')).toHaveText(/まだ 空いているマスが \d+こ あるよ/);
  /* 見えている数から 4つの元の数を 逆算して 全部 うめる */
  const vals = await page.evaluate(() => {
    const m: Record<string, string> = {};
    document.querySelectorAll<HTMLElement>('.nccell').forEach((b) => { m[b.dataset.k!] = b.textContent || ''; });
    return m;
  });
  const fixed: Record<string, number> = {}; for (const k in vals) if (vals[k] !== '') fixed[k] = Number(vals[k]);
  const lo = 1, hi = 40; let sol: Record<string, number> | null = null;
  outer: for (let a = lo; a <= hi; a++) for (let b = lo; b <= hi; b++) for (let d = lo; d <= hi; d++) for (let e = lo; e <= hi; e++) {
    const v: Record<string, number> = { a, b, s1: a + b, d, e, s2: d + e, c1: a + d, c2: b + e, T: a + b + d + e };
    if (Object.keys(fixed).every((k) => v[k] === fixed[k])) { sol = v; break outer; }
  }
  expect(sol).not.toBeNull();
  for (const k in vals) if (vals[k] === '') { await page.click(`.nccell[data-k="${k}"]`); for (const ch of String(sol![k])) await page.click(`#ncnum button[data-n="${ch}"]`); }
  await page.click('#btn-nccheck');
  await expect(page.locator('#s-cresult')).toBeVisible();
  await expect(page.locator('#cw-msg')).toHaveText('たて・よこ ぜんぶの 計算が そろいました。');
});

test('せってい：おと・時間・記録を消す', async ({ page }) => {
  await open(page, { 'oyako-miss': JSON.stringify({ 'pref:北海道': { n: 1, t: 1 } }), 'oyako-seen': JSON.stringify({ 'pref:北海道': 1 }) });
  await nav(page);
  await expect(page.locator('[data-tile="miss"] small')).toHaveText('のこり 1もん');
  await page.click('#btn-games-back'); await page.click('#btn-level-back');
  await page.click('#btn-settings');
  await expect(page.locator('#set-rec')).toHaveText('まちがい帳 1もん ／ 出題きろく 1もん');
  await page.click('#seg-sound button[data-v="0"]');
  expect(await page.evaluate(() => localStorage.getItem('oyako-sound'))).toBe('0');
  await page.click('#btn-clear-rec');
  await expect(page.locator('#btn-clear-rec')).toHaveText('本当に 消す？（もう一度 おす）');
  await page.click('#btn-clear-rec');
  await expect(page.locator('#btn-clear-rec')).toHaveText('消しました');
  await expect(page.locator('#set-rec')).toHaveText('まちがい帳 0もん ／ 出題きろく 0もん');
  await page.keyboard.press('Escape');
  await expect(page.locator('#set-ov')).toBeHidden();
  await nav(page);
  await expect(page.locator('[data-tile="miss"]')).toBeHidden();
});

for (const [w, h, tag] of VPS) {
  test(`収まり ${tag}（${w}×${h}）：スクロールなしで 1画面`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true });
    const page = await ctx.newPage();
    await open(page, { 'oyako-miss': JSON.stringify({ 'pref:北海道': { n: 1, t: 1 }, 'rika:てこ': { n: 1, t: 2 } }) });
    const sh = () => page.evaluate(() => document.documentElement.scrollHeight);
    const rows: [string, number][] = [];
    rows.push(['1．何人で', await sh()]);
    await page.click('[data-players="2"]'); rows.push(['2．がくねん', await sh()]);
    await page.click('[data-level="2"]'); rows.push(['3．ゲーム一覧（2人・まちがい帳あり）', await sh()]);
    await page.click('[data-mode="battle"]'); rows.push(['あそびかた:battle', await sh()]);
    await page.click('#btn-how-back'); await page.click('[data-tile="miss"]'); rows.push(['あそびかた:miss', await sh()]);
    await page.click('#btn-how-back'); await page.click('[data-mode="cross"]'); rows.push(['あそびかた:cross', await sh()]);
    await page.click('#btn-how-back'); await page.click('[data-group="relay"]'); rows.push(['グループ:relay', await sh()]);
    await page.click('[data-mode="pref"]'); rows.push(['あそびかた:pref', await sh()]);
    await page.click('#btn-start'); await expect(page.locator('#s-play')).toBeVisible({ timeout: 6000 });
    /* プレイ画面は ヒントの長さで 数px 変わる（v1 も同じ）。ここは 記録だけ */
    test.info().annotations.push({ type: 'プレイ:pref の高さ', description: String(await sh()) });
    await page.click('#btn-pause'); await page.click('#btn-quit');
    /* 1人の 一覧も 見ておく */
    await page.click('[data-players="1"]'); await page.click('[data-level="1"]'); rows.push(['3．ゲーム一覧（1人）', await sh()]);
    await page.click('#btn-games-back'); await page.click('#btn-level-back');
    await nav(page); await page.click('[data-mode="battle"]'); await page.click('#seg-subject button[data-v="calc"]'); await page.click('#btn-start');
    await expect(page.locator('#s-battle')).toBeVisible({ timeout: 8000 }); rows.push(['バトル:calc', await sh()]);
    const over = await page.evaluate(() => {
      const out: string[] = [];
      document.querySelectorAll('#s-battle .side').forEach((sd) => {
        const sr = sd.getBoundingClientRect();
        sd.querySelectorAll('.qtext,.numin,.numpad,.numkey').forEach((el) => {
          const e = el.getBoundingClientRect();
          if (e.bottom > sr.bottom + 1 || e.top < sr.top - 1 || e.right > sr.right + 1) out.push(el.className);
        });
      });
      return [...new Set(out)];
    });
    expect(over, 'テンキーが 枠から はみ出さない').toEqual([]);
    const bad = rows.filter(([, d]) => d > h);
    expect(bad, JSON.stringify(rows)).toEqual([]);
    await ctx.close();
  });
}

test('はやおし（ひとり）：1画面・回転なし・せいげん時間だけ・ランキングには 出さない', async ({ page }) => {
  const errs = noErrors(page);
  await page.clock.install(); await page.clock.resume();   /* 90秒を 早送りして 結果画面まで 見る */
  await open(page);
  await nav(page, 1);
  await page.click('[data-mode="battle1"]');
  await expect(page.locator('#how-title')).toHaveText('はやおし（ひとり）');
  await expect(page.locator('#seg-players')).toHaveCount(0);   /* 人数は 1画面目で 決めた */
  await expect(page.locator('#seg-goal')).toHaveCount(0);      /* 5もん・10もんは なし。せいげん時間だけ */
  await expect(page.locator('#seg-handi')).toHaveCount(0);     /* 相手が いないので ハンデも なし */
  await page.click('#seg-subject button[data-v="calc"]');
  await page.click('#btn-start');
  await expect(page.locator('#s-battle')).toBeVisible({ timeout: 8000 });
  /* ならび：時間が 上、じぶんの 面が 下。回転は しない。赤いボタンも 出ない */
  const order = await page.evaluate(() => [...document.querySelectorAll('#s-battle > .side, #s-battle > .mid')].map((e) => e.id || e.className));
  expect(order).toEqual(['mid', 'side-child']);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('side-child')!).transform)).toBe('none');
  await expect(page.locator('.buzz')).toHaveCount(0);
  let prevText: string | null = null;
  for (let n = 0; n < 3; n++) {
    await expect(page.locator('#side-child .numwrap')).toBeVisible();
    if (prevText !== null) await expect(page.locator('#side-child .qtext')).not.toHaveText(prevText);
    const text = await page.locator('#side-child .qtext').innerText();
    prevText = text;
    const m = /(\d+)\s*([+−×÷])\s*(\d+)/.exec(text)!;
    const a = Number(m[1]), b = Number(m[3]);
    const ans = String(m[2] === '+' ? a + b : m[2] === '−' ? a - b : m[2] === '×' ? a * b : a / b);
    for (const ch of ans) await numkey(page, 'child', ch);
    await expect(page.locator('#sc-solo')).toHaveText(String(n + 1));
  }
  await page.clock.fastForward(95000);
  await expect(page.locator('#s-bresult')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('#bwin')).toHaveText('ひとりで はやおし');
  await expect(page.locator('#bs-solo')).toHaveText('3');
  await expect(page.locator('#bs-adult')).toHaveCount(0);
  await expect(page.locator('#btn-brank-view')).toHaveCount(0);
  /* じこベストが この端末に のこる（90秒・こうがくねん） */
  expect(await page.evaluate(() => localStorage.getItem('oyako-battle1-2-90'))).toBe('3');
  expect(errs).toEqual([]);
});

test('はやおしバトル：まちがい直しは 帳から 出る・ランキングには 出さない', async ({ page }) => {
  const errs = noErrors(page);
  /* 帳を 1問だけに しておくと、出る問題が それに 決まるので たしかめやすい */
  await open(page, { 'oyako-miss': JSON.stringify({ 'rekishi:徳川家康': { n: 1, t: Date.now() } }) });
  await nav(page);
  await page.click('[data-mode="battle"]');
  await expect(page.locator('#seg-subject button[data-v="miss"]')).toBeVisible();
  await page.click('#seg-subject button[data-v="miss"]');
  await page.click('#seg-goal button[data-v="5"]');
  await page.click('#btn-start');
  await expect(page.locator('#s-battle')).toBeVisible({ timeout: 8000 });
  for (let i = 0; i < 5; i++) {
    await expect(page.locator('#buzz-child')).toBeEnabled();
    await buzz(page, 'child');
    /* 帳に ある問題しか 出ない（こたえが かならず 選たく肢に ある） */
    await expect(page.locator('#side-child .choice[data-a="徳川家康"]')).toBeVisible();
    await page.click('#side-child .choice[data-a="徳川家康"]');
    await expect(page.locator('#sc-child')).toHaveText((i + 1) + '/5');
  }
  await expect(page.locator('#s-bresult')).toBeVisible({ timeout: 4000 });
  await expect(page.locator('#btn-brank-view')).toHaveCount(0);
  expect(errs).toEqual([]);
});

test('1人でも クロスワードと ちずクイズが あそべる（役わりの わりふりは 出さない）', async ({ page }) => {
  const errs = noErrors(page);
  await open(page);
  await nav(page, 1);
  /* ちずクイズは 1人の 一覧にも 出る */
  await page.click('[data-group="geo"]');
  await expect(page.locator('#sub-title')).toHaveText('ちずクイズ');
  await expect(page.locator('[data-mode="geopref"]')).toBeVisible();
  await page.click('#s-sub [data-back="s-title"]');   /* もどる → ゲーム一覧 */
  await expect(page.locator('#s-games')).toBeVisible();
  await page.click('[data-mode="cross"]');
  await expect(page.locator('#how-title')).toHaveText('クロスワード');
  await expect(page.locator('#cross-roles')).toBeHidden();   /* ヨコ=こども／タテ=おとな は 出さない */
  await page.click('#btn-start');
  await expect(page.locator('#s-cross')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('.rolebar')).toHaveCount(0);
  await page.click('#btn-cluelist');
  await expect(page.locator('#cwclues')).toContainText('ヨコのカギ');
  await expect(page.locator('#cwclues')).not.toContainText('こどもが かんがえる');
  expect(errs).toEqual([]);
});

test('はやおしバトル：赤いボタンを 取ったら 3秒以内・もじあては 1文字ずつ 4たく', async ({ page }) => {
  const errs = noErrors(page);
  await open(page);
  await nav(page);
  await page.click('[data-mode="battle"]');
  await page.click('#seg-subject button[data-v="moji"]');
  await page.click('#btn-start');
  await expect(page.locator('#s-battle')).toBeVisible({ timeout: 8000 });
  /* 取る前は こたえも もちじかんも 出ていない */
  await expect(page.locator('#anst-adult')).toBeHidden();
  await buzz(page, 'adult');
  /* こたえの わくが 文字数ぶん、選たく肢は 1文字ぶんの 4つ（相手には 出ない） */
  const n = await page.locator('#side-adult .mchar').count();
  expect(n).toBeGreaterThan(1);
  /* 都道府県は 4たく、国旗は 2たく（どちらが 出るかは そのとき しだい） */
  const nOpt = await page.locator('#side-adult .choice.mj').count();
  expect([2, 4]).toContain(nOpt);
  await expect(page.locator('#side-child .choice.mj')).toHaveCount(0);
  const kana = await page.evaluate(() => [...document.querySelectorAll('#side-adult .choice.mj')].map((b) => (b as HTMLElement).dataset.a!));
  kana.forEach((k) => expect(k.length).toBe(1));   /* ひらがな1文字 */
  await expect(page.locator('#anst-adult')).toBeVisible();   /* 3秒の バーが 動く */
  /* 3秒 なにも しないと おてつき あつかいで、回答権が こどもに 回る */
  await expect(page.locator('#side-adult')).toHaveClass(/locked/, { timeout: 5000 });
  await expect(page.locator('#buzz-child')).toBeEnabled();
  await buzz(page, 'child');
  await expect(page.locator('#side-child .choice.mj')).toHaveCount(nOpt);
  expect(errs).toEqual([]);
});

test('はやおしバトル：問題文が 左から 少しずつ 出る', async ({ page }) => {
  const errs = noErrors(page);
  await open(page);
  await nav(page);
  await page.click('[data-mode="battle"]');
  await page.click('#seg-subject button[data-v="rekishi"]');
  await page.click('#btn-start');
  await expect(page.locator('#s-battle')).toBeVisible({ timeout: 8000 });
  const live = () => page.evaluate(() => (document.querySelector('#side-adult .qprog .live') as HTMLElement).innerText.replace(/\n/g, '').length);
  const a = await live();
  await page.waitForTimeout(500);
  const bLen = await live();
  expect(bLen).toBeGreaterThan(a);                 /* だんだん のびる */
  /* 赤いボタンを 取ると そこで 止まる */
  await buzz(page, 'adult');
  const c = await page.evaluate(() => (document.querySelector('#side-child .qprog .live') as HTMLElement).innerText.replace(/\n/g, '').length);
  await page.waitForTimeout(600);
  const d = await page.evaluate(() => (document.querySelector('#side-child .qprog .live') as HTMLElement).innerText.replace(/\n/g, '').length);
  expect(d).toBe(c);
  expect(errs).toEqual([]);
});
