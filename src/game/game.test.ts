import { describe, it, expect, beforeEach } from 'vitest';
import { setKV, memoryKV } from '../lib/storage';
import { reloadRecords, markMiss, markHit, missCount, markSeen, seenAt, clearRecords } from './records';
import { evalTokens, makePuzzle, checkMath, type Token } from './math10';
import { rankOf, rankNext } from './rank';
import { plain, furi, furiName, FURI_RE } from './furigana';
import { calcQuestion, BattleSession, battlePool, pickOpts, SOLO_OPTS, ANSWER_MS, splitYomi, charOptions } from './battle';
import { relayDeck, deckFor, hints3, missDeck } from './decks';
import { polyOf, inPoly, geoChoices, geoGroupOf, geoDeck, jpSVG, wSVG, jpFullVB, geoQuestion } from './geo';
import { newCross, cwCells, cwInput, cwHint, cwAllOk, cwLeft, cwTapCell, cwModify, cwDelete, cycleKana, cwCycle } from './cross';
import { KOKUGO_REI } from '../data/kokugo_rei';
import { FLICK } from '../data/cross';
import { makeNum, ncRank, NC_KEYS, newNum, ncKey, ncAllOk, ncLeft } from './numcross';

beforeEach(() => { setKV(memoryKV()); reloadRecords(); });

describe('records', () => {
  it('まちがい → 当てたら 消える', () => {
    markMiss('pref', '青森県'); markMiss('pref', '青森県');
    expect(missCount()).toBe(1);
    markHit('pref', '青森県'); expect(missCount()).toBe(1);
    markHit('pref', '青森県'); expect(missCount()).toBe(0);
  });
  it('math/calc は 記録しない', () => { markMiss('calc', '12'); markMiss('math', 'x'); expect(missCount()).toBe(0); });
  it('出題きろく', () => { expect(seenAt('rika', 'x')).toBe(0); markSeen('rika', 'x'); expect(seenAt('rika', 'x')).toBeGreaterThan(0); clearRecords(); expect(seenAt('rika', 'x')).toBe(0); });
});

describe('math10', () => {
  const n = (v: number, i = 0): Token => ({ t: 'n', i, v });
  const o = (v: '＋' | '−' | '×' | '÷'): Token => ({ t: 'o', v });
  const p = (v: '(' | ')'): Token => ({ t: 'p', v });
  it('四則とカッコ', () => {
    expect(evalTokens([n(2), o('＋'), n(3), o('×'), n(4)])).toBe(14);
    expect(evalTokens([p('('), n(2), o('＋'), n(3), p(')'), o('×'), n(2)])).toBe(10);
    expect(evalTokens([n(2), o('＋')])).toBeNull();
    expect(evalTokens([n(1), o('÷'), n(0)])).toBeNull();
  });
  it('作った問題は かならず 解ける', () => {
    for (let i = 0; i < 30; i++) {
      const q = makePuzzle(2);
      expect(q.nums.length).toBe(4);
      expect(q.sol.endsWith('＝10')).toBe(true);
    }
    expect(makePuzzle(1).nums.length).toBe(3);
  });
  it('判定の文言', () => {
    const q = { nums: [2, 3, 5], sol: '' };
    expect(checkMath(q, [n(2, 0), o('＋'), n(3, 1)]).ok).toBe(false);
    expect(checkMath(q, [n(2, 0), o('＋'), n(3, 1), o('＋'), n(5, 2)])).toEqual({ ok: true, text: 'せいかい！　2 ＋ 3 ＋ 5 ＝ 10' });
    const w = checkMath(q, [n(2, 0), o('×'), n(3, 1), o('＋'), n(5, 2)]);
    expect(w.ok).toBe(false); expect(w.text).toBe('ざんねん。11 になったよ');
  });
});

describe('rank', () => {
  it('90秒で 0もん は 見習い、15もん は 王さま', () => {
    expect(rankOf('relay', 0, 90).name).toBe('見習い級');
    expect(rankOf('relay', 12, 90).name).toBe('王さま級');
    expect(rankOf('relay', 15, 90).name).toBe('伝説の王級');
    expect(rankNext('relay', 12, 90)).toEqual({ name: '伝説の王級', more: 3 });
    expect(rankNext('relay', 15, 90)).toBeNull();
  });
  it('バトルは 2人合計・180秒でも 同じ ものさし', () => {
    expect(rankOf('battle', 9, 180).name).toBe('家来級');
  });
});

describe('furigana', () => {
  it('plain / furi / 重複かっこ', () => {
    expect(plain('白{しろ}い旗{はた}')).toBe('白い旗');
    expect(furi('白{しろ}い')).toBe('<ruby>白<rt>しろ</rt></ruby>い');
    expect(furi('南部鉄器{なんぶてっき}（なんぶてっき）')).toBe('<ruby>南部鉄器<rt>なんぶてっき</rt></ruby>');
    expect(furi('a<b')).toBe('a&lt;b');
    expect(furiName('徳川家康', 'とくがわいえやす')).toContain('<rt>とくがわいえやす</rt>');
    expect(furiName('apple', 'アップル')).toBe('apple');
  });
});

describe('decks', () => {
  it('都道府県は 高学年が 47ぜんぶ・低学年は やさしい県だけ', () => {
    const a = relayDeck('pref', 1).map((q) => q.name), b = relayDeck('pref', 2).map((q) => q.name);
    expect(b.length).toBe(47);                              // 高学年は ぜんぶ
    expect(a.length).toBeGreaterThanOrEqual(28);            // 低学年は その一部
    expect(a.every((x) => b.includes(x))).toBe(true);
    expect(a.includes('北海道')).toBe(true);
    expect(a.includes('鳥取県')).toBe(false);               // 低学年には 出ない
    expect(relayDeck('eigo', 1).every((q) => q.art)).toBe(true);
  });
  it('ほかの教科は 学年で 完全に 分かれる', () => {
    for (const sub of ['kokugo', 'rika', 'rekishi', 'eigo'] as const) {
      const a = relayDeck(sub, 1).map((q) => q.name), b = relayDeck(sub, 2).map((q) => q.name);
      expect(a.length, sub).toBeGreaterThan(0); expect(b.length, sub).toBeGreaterThan(0);
      expect(a.some((x) => b.includes(x)), sub).toBe(false);
    }
  });
  it('ヒントは 6つのプールから 3つ', () => {
    const q = relayDeck('flag', 1).find((x) => x.name === '日本')!;
    expect(q.hints.length).toBeGreaterThanOrEqual(3);
    expect(hints3(q).length).toBe(3);
  });
  it('math デッキは 40問', () => { expect(deckFor('math', 1).length).toBe(40); });
  it('まちがい直しは 学年をまたいで さがす', () => {
    markMiss('pref', '北海道'); markMiss('rika', 'モンシロチョウ'); markMiss('pref', '北海道');
    const d = missDeck();
    expect(d.map((q) => q.name)).toEqual(['北海道', 'モンシロチョウ']);
    expect(d[0].sub).toBe('pref');
  });
});

describe('battle', () => {
  it('けいさんの 選たく肢は かならず 8個・答えを ふくまない', () => {
    for (let i = 0; i < 50; i++) {
      const q = calcQuestion(i % 2 ? 1 : 2);
      expect(q.pool.length).toBe(8);
      expect(q.pool.includes(q.answer)).toBe(false);
      expect(new Set(q.pool).size).toBe(8);
    }
  });
  it('れきしは 同じ種類が 先に 並ぶ', () => {
    const deck = relayDeck('rekishi', 2);
    const q = deck.find((x) => x.tag === '人物')!;
    const pool = battlePool('rekishi', deck, q);
    const same = deck.filter((x) => x.tag === '人物' && x.name !== q.name).length;
    const names = new Map(deck.map((x) => [x.name, x.tag]));
    expect(pool.slice(0, same).every((n) => names.get(n) === '人物')).toBe(true);
    expect(pickOpts({ art: null, text: '', num: false, answer: q.name, pool, fact: null }, 4).length).toBe(4);
  });
  it('ことばは 例文が 問題・意味が 選たく肢。記録は 名前', () => {
    for (const lv of [1, 2] as const) {
      const deck = relayDeck('kokugo', lv);
      deck.forEach((q) => {
        const r = KOKUGO_REI[q.name];
        expect(r, q.name).toBeDefined();
        expect(plain(r.rei)).toContain('「' + plain(q.name).slice(0, 2));    // 例文の中に そのことばが「」つきで 入っている（活用あり）
        /* 漢字は みんな ふりがなつき。ルビの ついた ぶんを まるごと 消して、
           のこった 漢字が あれば つけ忘れ。本体と 同じ FURI_RE を つかうので
           々 や ヶ を ふくむ ことば（次々{つぎつぎ} など）でも 正しく 判定できる */
        const noRuby = (t: string) => t.replace(new RegExp(FURI_RE.source, 'g'), '');
        expect(/[一-鿿々〆ヶ]/.test(noRuby(r.rei)), q.name + ' rei').toBe(false);
        expect(/[一-鿿々〆ヶ]/.test(noRuby(r.imi)), q.name + ' imi').toBe(false);
      });
    }
    const s = new BattleSession({ level: 2, bsubj: 'kokugo', handi: 1, goal: 0 });
    for (let i = 0; i < 10; i++) {
      const { q, opts } = s.next();
      expect(q.disp).toBeDefined();
      expect(q.text).toBe(KOKUGO_REI[q.answer].rei);
      expect(q.disp![q.answer]).toBe(KOKUGO_REI[q.answer].imi);
      opts.adult.forEach((o) => expect(q.disp![o]).toBeTruthy());
      expect(new Set(opts.adult.map((o) => q.disp![o])).size).toBe(opts.adult.length);   // 意味が かぶらない
    }
    s.correct('child');
    expect(seenAt('kokugo', s.q!.answer)).toBeGreaterThan(0);
  });
  it('テンキーは 桁数が そろった瞬間に 判定', () => {
    const s = new BattleSession({ level: 2, bsubj: 'calc', handi: 1, goal: 10 });
    const { q } = s.next();
    expect(q.num).toBe(true);
    const ans = q.answer;
    let res: string | null = null;
    for (const ch of ans) res = s.key('child', ch);
    expect(res).toBe('ok');
    expect(s.correct('child')).toBe(false);
    expect(s.scoreText('child')).toBe('1/10');
  });
  it('先頭の 0 は 打てない・1つけす', () => {
    const s = new BattleSession({ level: 1, bsubj: 'calc', handi: 0, goal: 0 });
    s.next();
    expect(s.key('adult', '0')).toBeNull(); expect(s.input.adult).toBe('');
    s.key('adult', '1'); expect(s.input.adult).toBe('1');
    s.key('adult', 'del'); expect(s.input.adult).toBe('');
  });
  it('〇もん先取', () => {
    const s = new BattleSession({ level: 1, bsubj: 'mix', handi: 1, goal: 1 });
    s.next();
    expect(s.correct('adult')).toBe(true);
  });
});

describe('geo', () => {
  it('パス → ポリゴン → 内外判定', () => {
    const r = polyOf('t', 'M0,0L10,0L10,10L0,10Z');
    expect(r.length).toBe(1);
    expect(inPoly(r, 5, 5)).toBe(true); expect(inPoly(r, 15, 5)).toBe(false);
  });
  it('高学年の 4たくは 同じ地方から', () => {
    for (let i = 0; i < 20; i++) {
      const o = geoChoices('jp', 2, '38');
      expect(o.length).toBe(4); expect(o).toContain('38');
      expect(o.every((k) => geoGroupOf('jp', k) === '中国・四国')).toBe(true);
    }
    const lo = geoChoices('jp', 1, '38');
    expect(lo.filter((k) => k !== '38').every((k) => geoGroupOf('jp', k) !== '中国・四国')).toBe(true);
  });
  it('デッキと SVG', () => {
    expect(geoDeck('jp', 2).length).toBe(47);
    expect(geoDeck('jp', 1).length).toBe(relayDeck('pref', 1).length);   /* ちずクイズも 同じ「やさしい県」 */
    expect(jpSVG({ '13': 'hit' })).toContain('class="pf hit" data-k="13"');
    expect(wSVG({ jp: 'hit' })).toContain('class="cty hit" data-k="jp"');
    expect(jpFullVB()[2]).toBeGreaterThan(400);
    const q = geoQuestion('jp', 2, '13');
    expect(q.scope && q.scope.length).toBeGreaterThanOrEqual(4);
    expect(q.sub).toBe('関東地方の 赤いところは どこ？');
    expect(geoQuestion('jp', 1, '13').vb).toBeNull();
  });
});

describe('cross', () => {
  it('番号・入力・ヒント・完成', () => {
    const cw = newCross(1, null);
    expect(Object.keys(cw.nums).length).toBeGreaterThan(0);
    const w = cw.puz.w[0];
    expect(cwCells(w).length).toBe(w.w.length);
    cwInput(cw, 'あ'); expect(cw.sel.pos).toBe(1);
    cwModify(cw, '小'); expect(cw.letters['0_' + w.c] ?? cw.letters[w.r + '_' + w.c]).toBeDefined();
    cwDelete(cw);
    cwTapCell(cw, w.r, w.c); cwHint(cw);
    expect(cw.letters[w.r + '_' + w.c]).toBe(w.w[0]); expect(cw.hints).toBe(1);
    for (let r = 0; r < cw.R; r++) for (let c = 0; c < cw.C; c++) if (cw.puz.g[r][c] !== '#') cw.letters[r + '_' + c] = cw.puz.g[r][c];
    expect(cwAllOk(cw)).toBe(true);
    expect(cwLeft(cw)).toBe(0);
  });
  it('同じ問題が つづかない', () => {
    for (let i = 0; i < 20; i++) { const a = newCross(1, null); const b = newCross(1, a.idx); if (a.idx === b.idx) expect(true).toBe(false); }
  });
  it('さいしょから やりなおす は 同じ問題', () => {
    for (let i = 0; i < 10; i++) { const a = newCross(2, null); const b = newCross(2, a.idx, a.idx); expect(b.idx).toBe(a.idx); expect(cwLeft(b)).toBeGreaterThan(0); }
    expect(newCross(1, null, 9999).idx).toBeLessThan(100);   // 範囲外は ふつうに えらぶ
  });
  it('フリック：゛゜小 は 順に まわる', () => {
    expect(cycleKana('は')).toBe('ば'); expect(cycleKana('ば')).toBe('ぱ'); expect(cycleKana('ぱ')).toBe('は');
    expect(cycleKana('か')).toBe('が'); expect(cycleKana('が')).toBe('か');
    expect(cycleKana('つ')).toBe('づ'); expect(cycleKana('づ')).toBe('っ'); expect(cycleKana('っ')).toBe('つ');
    expect(cycleKana('あ')).toBe('ぁ'); expect(cycleKana('ぁ')).toBe('あ');
    expect(cycleKana('ん')).toBe('ん'); expect(cycleKana('ー')).toBe('ー');
    const cw = newCross(1, null);
    cwInput(cw, 'は'); cwCycle(cw); cwCycle(cw);
    const w = cw.puz.w[0];
    expect(cw.letters[w.r + '_' + w.c]).toBe('ぱ');
    /* フリックの表は 3×4、50音が ぜんぶ 入っている */
    expect(FLICK.length).toBe(12);
    const all = FLICK.flatMap((k) => k).filter(Boolean).join('');
    for (const ch of 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんー') expect(all, ch).toContain(ch);
  });
});

describe('numcross', () => {
  it('見えている数で 一意に決まる問題だけ', () => {
    for (let i = 0; i < 30; i++) {
      const p = makeNum(2);
      const shown = NC_KEYS.filter((k) => !p.hide.includes(k));
      expect(ncRank(shown)).toBe(4);
      expect(p.v.T).toBe(p.v.a + p.v.b + p.v.d + p.v.e);
    }
  });
  it('入力と 判定', () => {
    const nc = newNum(1);
    expect(ncLeft(nc)).toBe(4);
    for (const k of nc.puz.hide) { nc.sel = k; for (const ch of String(nc.puz.v[k])) ncKey(nc, ch); }
    expect(ncLeft(nc)).toBe(0);
    expect(ncAllOk(nc)).toBe(true);
  });
});

describe('はやおしの まちがい直し・ひとり', () => {
  it('まちがい帳から 出る。選たく肢は 同じ教科から', () => {
    setKV(memoryKV()); reloadRecords();
    markMiss('rekishi', '徳川家康'); markMiss('rekishi', '織田信長');
    markMiss('kokugo', '一石二鳥'); markMiss('pref', '北海道');
    const s = new BattleSession({ level: 2, bsubj: 'miss', handi: 1, goal: 0 });
    expect(s.missPool.length).toBe(4);
    for (let i = 0; i < 12; i++) {
      const { q, opts } = s.next();
      expect(['徳川家康', '織田信長', '一石二鳥', '北海道'], q.answer).toContain(q.answer);
      /* まちがいの選たく肢は こたえと 同じ教科から（別教科が まざらない） */
      const deck = relayDeck(q.sub!, 1).concat(relayDeck(q.sub!, 2)).map((x) => x.name);
      opts.adult.forEach((o) => expect(deck, q.sub + ' の 選たく肢に ' + o).toContain(o));
    }
  });
  it('低学年の問題を 高学年で 直しても 選たく肢が そろう', () => {
    setKV(memoryKV()); reloadRecords();
    markMiss('rika', 'カブトムシ');                    // 低学年の問題
    const s = new BattleSession({ level: 2, bsubj: 'miss', handi: 1, goal: 0 });   // 高学年で 遊ぶ
    const { q, opts } = s.next();
    expect(q.answer).toBe('カブトムシ');
    const rika = relayDeck('rika', 1).concat(relayDeck('rika', 2)).map((x) => x.name);
    opts.adult.forEach((o) => expect(rika).toContain(o));
    expect(opts.adult.length).toBeGreaterThan(1);
  });
  it('まちがい帳が 空なら けいさんに なる（画面は 止まらない）', () => {
    setKV(memoryKV()); reloadRecords();
    const s = new BattleSession({ level: 1, bsubj: 'miss', handi: 1, goal: 0 });
    expect(s.missPool.length).toBe(0);
    expect(s.next().q.num).toBe(true);
  });
  it('ひとりモードは 4たく・相手なし・ハンデなし', () => {
    setKV(memoryKV()); reloadRecords();
    const s = new BattleSession({ level: 2, bsubj: 'rekishi', handi: 1, goal: 5, players: 1 });
    const { q, opts } = s.next();
    expect(q.answer).toBeTruthy();
    expect(opts.child.length).toBe(SOLO_OPTS);
    expect(opts.child).toContain(q.answer);
    expect(opts.adult.length).toBe(0);            /* 相手側は 出さない */
    expect(s.correct('child')).toBe(false);       /* 5もんで おわり。1もん目では まだ */
    expect(s.score.child).toBe(1);
  });
  it('ひとりモードの けいさんは 待たされない', () => {
    setKV(memoryKV()); reloadRecords();
    const solo = new BattleSession({ level: 2, bsubj: 'calc', handi: 2, goal: 0, players: 1 });
    expect(solo.next().wait).toBe(0);
    const duo = new BattleSession({ level: 2, bsubj: 'calc', handi: 2, goal: 0 });
    expect(duo.next().wait).toBeGreaterThan(0);   /* 2人のときは おとなに ハンデの 待ちが 入る */
  });
  it('ひとりモードで 〇もん とったら おわる', () => {
    setKV(memoryKV()); reloadRecords();
    const s = new BattleSession({ level: 2, bsubj: 'pref', handi: 0, goal: 3, players: 1 });
    s.next(); expect(s.correct('child')).toBe(false);
    s.next(); expect(s.correct('child')).toBe(false);
    s.next(); expect(s.correct('child')).toBe(true);
    expect(s.scoreText('child')).toBe('3/3');
  });
});

describe('はやおしの 回答権（赤いボタン）', () => {
  const sess = () => { setKV(memoryKV()); reloadRecords(); const s = new BattleSession({ level: 2, bsubj: 'rekishi', handi: 1, goal: 0 }); s.next(); return s; };
  it('先に おした人だけが 回答権を 持つ', () => {
    const s = sess();
    expect(s.owner).toBe(null);
    expect(s.claim('child')).toBe(true);
    expect(s.owner).toBe('child');
    expect(s.claim('adult')).toBe(false);   /* もう 取られている */
  });
  it('まちがえたら 回答権は はなれ、同じ人は もう 押せない', () => {
    const s = sess();
    s.claim('child'); s.wrong('child');
    expect(s.owner).toBe(null);
    expect(s.claim('child')).toBe(false);   /* 1問に 1回だけ */
    expect(s.claim('adult')).toBe(true);
    expect(s.bothTried()).toBe(false);
  });
  it('2人とも まちがえたら つぎの問題へ（bothTried）', () => {
    const s = sess();
    s.claim('child'); s.wrong('child');
    s.claim('adult'); s.wrong('adult');
    expect(s.bothTried()).toBe(true);
    expect(s.owner).toBe(null);
  });
  it('つぎの問題で 回答権は まっさらに もどる', () => {
    const s = sess();
    s.claim('child'); s.wrong('child');
    s.next();
    expect(s.owner).toBe(null);
    expect(s.tried).toEqual({ adult: false, child: false });
  });
  it('ひとりモードは 取り合う相手が いないので いつでも こたえられる', () => {
    setKV(memoryKV()); reloadRecords();
    const s = new BattleSession({ level: 2, bsubj: 'rekishi', handi: 1, goal: 0, players: 1 });
    s.next();
    expect(s.claim('child')).toBe(true);
    s.wrong('child');
    expect(s.claim('child')).toBe(true);   /* 同じ問題に もう一度 挑戦できる */
  });
});

describe('もじあて（みんはや式）と 3秒ルール', () => {
  it('よみを 県・都・府・道 と 本体に 分ける', () => {
    expect(splitYomi('pref', '青森県', 'あおもりけん')).toEqual({ body: 'あおもり', tail: '県' });
    expect(splitYomi('pref', '東京都', 'とうきょうと')).toEqual({ body: 'とうきょう', tail: '都' });
    expect(splitYomi('pref', '大阪府', 'おおさかふ')).toEqual({ body: 'おおさか', tail: '府' });
    expect(splitYomi('pref', '北海道', 'ほっかいどう')).toEqual({ body: 'ほっかい', tail: '道' });
    expect(splitYomi('flag', 'アメリカ', 'あめりか')).toEqual({ body: 'あめりか', tail: '' });
  });
  it('1文字ぶんの 選たく肢は 4つで、正解が かならず 入る', () => {
    const pool = ['あ', 'い', 'う', 'え', 'お', 'か', 'き'];
    for (let i = 0; i < 20; i++) {
      const o = charOptions(pool, 'か');
      expect(o.length).toBe(4);
      expect(o).toContain('か');
      expect(new Set(o).size).toBe(4);   /* 同じ文字が ならばない */
    }
  });
  it('1文字ずつ えらんで こたえる。ちがう文字は その場で おてつき', () => {
    setKV(memoryKV()); reloadRecords();
    const s = new BattleSession({ level: 2, bsubj: 'moji', handi: 1, goal: 0 });
    const { q, opts } = s.next();
    expect(q.chars!.length).toBeGreaterThan(1);
    expect(q.charOpts!.length).toBe(q.chars!.length);
    expect(opts.child.length).toBe(0);              /* ふつうの選たく肢は 出さない */
    expect(q.charOpts![0]).toContain(q.chars![0]);
    const wrong = q.charOpts![0].find((c) => c !== q.chars![0])!;
    expect(s.char('child', wrong)).toBe('ng');
    s.wrong('child');
    expect(s.charAt('child')).toBe(0);              /* 入れたものは 消える */
    /* さいごの1文字で 正解に なる */
    for (let i = 0; i < q.chars!.length; i++) {
      const res = s.char('child', q.chars![i]);
      expect(res).toBe(i === q.chars!.length - 1 ? 'ok' : null);
    }
  });
  it('こたえる もちじかんは 3秒', () => { expect(ANSWER_MS).toBe(3000); });
});
