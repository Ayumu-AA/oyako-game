import { describe, it, expect, beforeEach } from 'vitest';
import { setKV, memoryKV } from '../lib/storage';
import { reloadRecords, markMiss, markHit, missCount, markSeen, seenAt, clearRecords } from './records';
import { evalTokens, makePuzzle, checkMath, type Token } from './math10';
import { rankOf, rankNext } from './rank';
import { plain, furi, furiName } from './furigana';
import { calcQuestion, BattleSession, battlePool, pickOpts } from './battle';
import { relayDeck, deckFor, hints3, missDeck } from './decks';
import { polyOf, inPoly, geoChoices, geoGroupOf, geoDeck, jpSVG, wSVG, jpFullVB, geoQuestion } from './geo';
import { newCross, cwCells, cwInput, cwHint, cwAllOk, cwLeft, cwTapCell, cwModify, cwDelete } from './cross';
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
  it('学年で 完全に 分かれる', () => {
    const a = relayDeck('pref', 1).map((q) => q.name), b = relayDeck('pref', 2).map((q) => q.name);
    expect(a.length + b.length).toBe(47);
    expect(a.some((x) => b.includes(x))).toBe(false);
    expect(relayDeck('eigo', 1).every((q) => q.art)).toBe(true);
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
    expect(geoDeck('jp', 1).length).toBe(20);
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
