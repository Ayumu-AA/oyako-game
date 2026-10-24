import { describe, it, expect, beforeEach } from 'vitest';
import { setKV, memoryKV, store } from '../lib/storage';
import { reloadRecords, markMiss, markHit, missCount, markSeen, seenAt, clearRecords } from './records';
import { evalTokens, makePuzzle, checkMath, type Token } from './math10';
import { rankOf, rankNext } from './rank';
import { plain, furi, furiName, FURI_RE } from './furigana';
import { calcQuestion, BattleSession, battlePool, pickOpts, SOLO_OPTS, ANSWER_MS, ANSWER_MS_SOLO, HINT_STEP_MS, PTS_BY_STAGE, ptsAtStage, MIX_ALL, mixFor, okSubj, wordRows, nearNums, splitYomi, charOptions, mojiGroups, askText, PROG_MAX, EIGO_WORD_RATE, isKata, noOverlap, subjKeys } from './battle';
import { cutFuri, plainLen } from './furigana';
import { relayDeck as deckOf } from './decks';
import { RIKA_Q } from '../data/rika';
import { EIGO_IMI } from '../data/eigo_imi';
import { relayDeck, deckFor, hints3, missDeck, kanjiDeck } from './decks';
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
  });
  it('はやおしの 国語は「かん字の読み」。選たく肢は よみ', () => {
    for (const g of [1, 2, 3, 4, 5, 6] as const) {
      const s = new BattleSession({ level: g, bsubj: 'kokugo', handi: 1, goal: 0 });
      const rows = new Map(kanjiDeck(g).map((x) => [x.name, x.yomi]));
      for (let i = 0; i < 10; i++) {
        const { q, opts } = s.next();
        expect(q.disp, String(g)).toBeDefined();
        expect(q.text).toBe('「' + q.answer + '」は なんと 読{よ}む？');
        expect(q.disp![q.answer]).toBe(rows.get(q.answer));
        /* 選たく肢は ぜんぶ よみが あり、よみが かぶらない */
        opts.adult.forEach((o) => expect(q.disp![o], o).toBeTruthy());
        expect(new Set(opts.adult.map((o) => q.disp![o])).size).toBe(opts.adult.length);
        /* ヒントは いみ → よみの 文字数 の 順 */
        expect((q.hints || []).length).toBe(2);
        expect(q.hints![1]).toContain('はじめは「');
      }
      s.correct('child');
      expect(seenAt('kokugo', s.q!.answer)).toBeGreaterThan(0);
    }
  });
  it('1年生は 一文字、2年生からは じゅくご', () => {
    expect(kanjiDeck(1).every((q) => [...q.name].length === 1)).toBe(true);
    expect(kanjiDeck(2).some((q) => [...q.name].length >= 2)).toBe(true);
    expect(kanjiDeck(6).some((q) => [...q.name].length >= 3)).toBe(true);
  });
  it('学年べつの ジャンル：1年は かん字・けいさん・国旗、2年から 県、3年から れきし・りか、5年から えいご', () => {
    expect(mixFor(1)).toEqual(['flag', 'kokugo', 'calc', 'word']);
    expect(mixFor(2)).toEqual(['pref', 'flag', 'kokugo', 'calc', 'word']);
    expect(mixFor(3)).toEqual(['pref', 'flag', 'kokugo', 'rika', 'rekishi', 'calc', 'word']);
    expect(mixFor(4)).toEqual(mixFor(3));
    expect(mixFor(5)).toEqual(['pref', 'flag', 'kokugo', 'rika', 'rekishi', 'eigo', 'calc', 'word']);
    expect(mixFor(6)).toEqual(mixFor(5));
    expect(okSubj('mix', 1)).toBe(true);
    expect(okSubj('eigo', 4)).toBe(false);
    /* ミックスで その学年に 出ない ジャンルは 出ない */
    for (const g of [1, 2, 3] as const) {
      const s = new BattleSession({ level: g, bsubj: 'mix', handi: 1, goal: 0, players: 1 });
      for (let i = 0; i < 60; i++) { const { q } = s.next(); if (q.sub) expect(mixFor(g)).toContain(q.sub); }
    }
  });
  it('その学年に ない ジャンルを えらんでいても、学年の ジャンルだけが 出る', () => {
    /* 6年で「えいご」を えらんだまま 1年に 変えた、のような ばあい */
    const s = new BattleSession({ level: 1, bsubj: 'eigo', handi: 1, goal: 0, players: 1 });
    for (let i = 0; i < 80; i++) { const { q } = s.next(); if (q.sub) expect(mixFor(1)).toContain(q.sub); }
    const s2 = new BattleSession({ level: 2, bsubj: 'rika', handi: 1, goal: 0, players: 2 });
    for (let i = 0; i < 80; i++) { const { q } = s2.next(); if (q.sub) expect(mixFor(2)).toContain(q.sub); }
    /* その学年に ある ジャンルは これまでどおり そのまま */
    const s3 = new BattleSession({ level: 6, bsubj: 'eigo', handi: 1, goal: 0, players: 1 });
    for (let i = 0; i < 20; i++) { const { q } = s3.next(); expect(q.sub).toBe('eigo'); }
  });
  it('おかいもの（文しょうだい）は 4たくで、まちがいは こたえに 近い 数', () => {
    for (const g of [1, 2, 3, 4, 5, 6] as const) {
      const s = new BattleSession({ level: g, bsubj: 'word', handi: 1, goal: 0, players: 1 });
      const rows = new Map(wordRows(g).map((r) => [r[0], r[1] + r[2]]));
      for (let i = 0; i < 40; i++) {
        const { q, opts } = s.next();
        expect(q.sub, String(g)).toBe('word');
        expect(rows.get(q.text), q.text).toBe(q.answer);           /* 文と こたえの 組みあわせが データどおり */
        expect(opts.child.length).toBe(SOLO_OPTS);
        expect(opts.child).toContain(q.answer);
        expect(new Set(opts.child).size).toBe(SOLO_OPTS);          /* おなじ 選たく肢が ならばない */
        const unit = q.answer.replace(/^\d+/, '');
        opts.child.forEach((o) => expect(o.endsWith(unit), o).toBe(true));   /* たんいが そろう */
      }
    }
  });
  it('まちがいの 数は 0より 大きい', () => {
    for (const a of [1, 2, 5, 10, 48, 120, 1500]) {
      nearNums(a).forEach((v) => { expect(v).toBeGreaterThan(0); expect(v).not.toBe(a); });
      expect(nearNums(a).length).toBeGreaterThanOrEqual(8);
    }
  });
  it('けいさんは 学年で むずかしさが かわる', () => {
    const ops = (g: 1 | 2 | 3 | 4 | 5 | 6) => {
      const set = new Set<string>();
      for (let i = 0; i < 200; i++) { const t = calcQuestion(g).text; set.add(t.includes('×') ? '×' : t.includes('÷') ? '÷' : t.includes('−') ? '−' : '+'); }
      return set;
    };
    expect([...ops(1)].sort()).toEqual(['+', '−']);
    expect(ops(3).has('×')).toBe(true);
    expect(ops(3).has('÷')).toBe(false);
    expect(ops(4).has('÷')).toBe(true);
  });
  it('テンキーは 桁数が そろった瞬間に 判定', () => {
    const s = new BattleSession({ level: 6, bsubj: 'calc', handi: 1, goal: 10 });
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
    const s = new BattleSession({ level: 6, bsubj: 'miss', handi: 1, goal: 0 });
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
    const s = new BattleSession({ level: 6, bsubj: 'miss', handi: 1, goal: 0 });   // 高学年で 遊ぶ
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
    const s = new BattleSession({ level: 6, bsubj: 'rekishi', handi: 1, goal: 5, players: 1 });
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
    const solo = new BattleSession({ level: 6, bsubj: 'calc', handi: 2, goal: 0, players: 1 });
    expect(solo.next().wait).toBe(0);
    const duo = new BattleSession({ level: 6, bsubj: 'calc', handi: 2, goal: 0 });
    expect(duo.next().wait).toBeGreaterThan(0);   /* 2人のときは おとなに ハンデの 待ちが 入る */
  });
  it('ひとりモードで 〇もん とったら おわる', () => {
    setKV(memoryKV()); reloadRecords();
    const s = new BattleSession({ level: 6, bsubj: 'pref', handi: 0, goal: 3, players: 1 });
    s.next(); expect(s.correct('child')).toBe(false);
    s.next(); expect(s.correct('child')).toBe(false);
    s.next(); expect(s.correct('child')).toBe(true);
    expect(s.scoreText('child')).toBe('3/3');
  });
});

describe('はやおしの 回答権（赤いボタン）', () => {
  const sess = () => { setKV(memoryKV()); reloadRecords(); const s = new BattleSession({ level: 6, bsubj: 'rekishi', handi: 1, goal: 0 }); s.next(); return s; };
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
    const s = new BattleSession({ level: 6, bsubj: 'rekishi', handi: 1, goal: 0, players: 1 });
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
    const s = new BattleSession({ level: 6, bsubj: 'moji', handi: 1, goal: 0 });
    const { q, opts } = s.next();
    expect(q.chars!.length).toBeGreaterThan(1);
    /* ? は 一部だけ。ぜんぶは あかない（名前の 手がかりが のこる）。
       よみが みじかい県（なら・みえ など）は ? が 1つに なることも ある */
    expect(q.holes!.length).toBeGreaterThanOrEqual(1);
    expect(q.holes!.length).toBeLessThanOrEqual(3);
    if (q.chars!.length >= 3) expect(q.holes!.length).toBeLessThan(q.chars!.length);
    expect(q.charOpts!.length).toBe(q.holes!.length);
    expect(opts.child.length).toBe(0);              /* ふつうの選たく肢は 出さない */
    const first = q.chars![q.holes![0]];
    expect(q.charOpts![0]).toContain(first);
    const wrong = q.charOpts![0].find((c) => c !== first)!;
    expect(s.char('child', wrong)).toBe('ng');
    s.wrong('child');
    expect(s.charAt('child')).toBe(0);              /* 入れたものは 消える */
    /* ? を 順に うめると 正解に なる */
    q.holes!.forEach((h, i) => {
      const res = s.char('child', q.chars![h]);
      expect(res).toBe(i === q.holes!.length - 1 ? 'ok' : null);
    });
  });
  it('国旗は 2たく（むずかしい国が まざるので やさしくする）', () => {
    setKV(memoryKV()); reloadRecords();
    const s = new BattleSession({ level: 6, bsubj: 'moji', handi: 1, goal: 0 });
    let sawFlag = false, sawPref = false;
    for (let i = 0; i < 40 && !(sawFlag && sawPref); i++) {
      const { q } = s.next();
      if (!q.charOpts) continue;
      const n = q.charOpts[0].length;
      if (q.sub === 'flag') { sawFlag = true; expect(n).toBe(2); }
      if (q.sub === 'pref') { sawPref = true; expect(n).toBe(4); }
      expect(q.charOpts!.length).toBe(q.holes!.length);
    }
    expect(sawFlag && sawPref).toBe(true);
  });
  it('小さい字や のばす音は ? に しない', () => {
    setKV(memoryKV()); reloadRecords();
    const s = new BattleSession({ level: 6, bsubj: 'moji', handi: 1, goal: 0 });
    for (let i = 0; i < 40; i++) {
      const { q } = s.next();
      if (!q.holes) continue;
      const small = [...'ぁぃぅぇぉゃゅょっゎー'];
      /* ふつうの かなが 足りていれば、? は かならず ふつうの かな */
      const normal = q.chars!.filter((c) => small.indexOf(c) < 0).length;
      if (normal >= q.holes.length) q.holes.forEach((h) => expect(small).not.toContain(q.chars![h]));
      q.charOpts!.forEach((o) => o.forEach((c) => expect(small).not.toContain(c)));
    }
  });
  it('こたえる もちじかんは 2人が 3秒・ひとりは ヒント3つぶん（9秒）', () => {
    expect(ANSWER_MS).toBe(3000);
    expect(ANSWER_MS_SOLO).toBe(HINT_STEP_MS * 3);
    expect(ANSWER_MS_SOLO).toBeGreaterThan(ANSWER_MS);
  });
  it('ポイントは 早いほど 高い（3→2→1）', () => {
    expect(PTS_BY_STAGE).toEqual([3, 2, 1]);
    expect(ptsAtStage(0)).toBe(3);
    expect(ptsAtStage(1)).toBe(2);
    expect(ptsAtStage(2)).toBe(1);
    expect(ptsAtStage(9)).toBe(1);   /* それ以上 下がらない */
  });
  it('ミックスに もじうめは 入れない（都道府県と 国旗の 中で 出す）', () => {
    expect(MIX_ALL).not.toContain('moji');
    expect(MIX_ALL).toContain('pref');
    expect(MIX_ALL).toContain('flag');
  });
});


describe('問題文を 少しずつ 出す（クイズ番組ふう）', () => {
  const src = '鎌倉時代{かまくらじだい}の 若{わか}い 指導者{しどうしゃ}';
  it('ふりがなを 数に 入れない 文字数で かぞえる', () => {
    expect(plainLen(src)).toBe(plain(src).length);
    expect(plain(src)).toBe('鎌倉時代の 若い 指導者');
  });
  it('先頭から n文字。ルビは 途中で 割らない', () => {
    expect(cutFuri(src, 0)).toBe('');
    /* 「鎌倉時代」は 4文字ぶん。1文字でも 入るなら まるごと 出す */
    expect(plain(cutFuri(src, 2))).toBe('鎌倉時代');
    expect(cutFuri(src, 2)).toContain('{かまくらじだい}');
    expect(plain(cutFuri(src, 6))).toBe('鎌倉時代の ');
    expect(cutFuri(src, 99)).toBe(src);
    /* だんだん のびる（みじかく なることは ない） */
    let prev = 0;
    for (let n = 0; n <= plainLen(src); n++) {
      const len = plain(cutFuri(src, n)).length;
      expect(len).toBeGreaterThanOrEqual(prev);
      prev = len;
    }
  });
});

describe('もじあて：〇文字目が「か」の都道府県は？', () => {
  it('仲間は 2〜4県。ぜんぶ そのいちに その文字を 持つ', () => {
    const deck = deckOf('pref', 2);
    const gs = mojiGroups(deck, 'pref');
    expect(gs.length).toBeGreaterThan(20);
    gs.forEach((g) => {
      expect(g.names.length).toBeGreaterThanOrEqual(2);
      expect(g.names.length).toBeLessThanOrEqual(4);
      g.names.forEach((nm) => {
        const x = deck.find((y) => y.name === nm)!;
        expect(splitYomi('pref', x.name, x.yomi).body[g.pos]).toBe(g.ch);
      });
    });
  });
  it('こたえは 1つに 決まる（のこりの仲間は 見せてある）', () => {
    setKV(memoryKV()); reloadRecords();
    const deck = deckOf('pref', 2);
    const s = new BattleSession({ level: 6, bsubj: 'moji', handi: 1, goal: 0 });
    let seen = 0;
    for (let i = 0; i < 30 && seen < 8; i++) {
      const { q } = s.next();
      if (q.sub !== 'pref' || !q.shown) continue;
      seen++;
      const m = /^(\d+)文字目\{[^}]*\}が「(.)」/.exec(q.text)!;
      const pos = Number(m[1]) - 1, ch = m[2];
      /* その条件に あう県は 「見せてある数 ＋ こたえ」と ぴったり 同じ */
      const all = deck.filter((x) => splitYomi('pref', x.name, x.yomi).body[pos] === ch).map((x) => x.name);
      expect(all.sort()).toEqual([q.answer, ...q.shown.map((x) => x.name)].sort());
      /* 条件の いちは はじめから 見えている（? に しない） */
      expect(q.holes).not.toContain(pos);
      expect(q.chars![pos]).toBe(ch);
      for (let k = 0; k < q.holes!.length; k++) s.char('child', q.chars![q.holes![k]]);
      expect(s.charAt('child')).toBe(q.holes!.length);
      s.next();
    }
    expect(seen).toBeGreaterThan(3);
  });
});

describe('都道府県の ヒント', () => {
  it('どの県にも ヒントが 5つ いじょう ある（ヒント3つを えらべる）', () => {
    for (const lv of [1, 2] as const) {
      relayDeck('pref', lv).forEach((q) => {
        expect(q.hints.length, q.name).toBeGreaterThanOrEqual(5);
      });
    }
  });
  it('ヒントに ふりがなの 書きまちがいが ない（かっこの とじわすれ など）', () => {
    const bad: string[] = [];
    for (const lv of [1, 2] as const) {
      relayDeck('pref', lv).forEach((q) => q.hints.forEach((h) => {
        /* { } の 数が あわない／ルビの 中に 漢字が まざる のを 見つける */
        if ((h.match(/\{/g) || []).length !== (h.match(/\}/g) || []).length) bad.push(q.name + ': ' + h);
        if (/\{[^}]*[一-鿿][^}]*\}/.test(h)) bad.push(q.name + '(ルビに漢字): ' + h);
        if (/\}\{/.test(h)) bad.push(q.name + '(ルビが つながる): ' + h);
      }));
    }
    expect(bad).toEqual([]);
  });
  it('同じ県の 中で ヒントが かぶらない', () => {
    for (const lv of [1, 2] as const) {
      relayDeck('pref', lv).forEach((q) => {
        const p = q.hints.map((h) => plain(h));
        expect(new Set(p).size, q.name).toBe(p.length);
      });
    }
  });
});

describe('問題文に「何を 答えるか」を 入れる（10/20）', () => {
  it('都道府県は ヒントだけで なく 問いかけの形で 出る', () => {
    const s = new BattleSession({ level: 4, bsubj: 'pref', handi: 1, goal: 0 });
    let seen = 0;
    for (let i = 0; i < 40; i++) {
      const q = s.next().q;
      if (q.chars) continue;            /* もじうめは べつの 出しかた */
      const t = plain(q.text);
      expect(t, t).toMatch(/で 有名なのは どこ？$/);
      /* ヒントそのもの（「りんご」だけ）には ならない */
      expect(t.length).toBeGreaterThan('で 有名なのは どこ？'.length);
      seen++;
    }
    expect(seen).toBeGreaterThan(0);
  });
  it('りかは「これは なに？」で おわる', () => {
    const s = new BattleSession({ level: 4, bsubj: 'rika', handi: 1, goal: 0 });
    let seen = 0;
    for (let i = 0; i < 40; i++) {
      const q = s.next().q;
      if (q.num) continue;
      /* 理科は 問題文つき（新しい原稿）と ヒント形式が まざる。
         問題文つきは ヒントが「ヒント：「〇〇」の もんだい」の 1つだけ。それで 見分ける */
      if ((q.hints || []).some((h) => h.startsWith('ヒント：'))) continue;
      const t = plain(q.text);
      expect(t, t).toMatch(/。これは なに？$/); seen++;
    }
    expect(seen).toBeGreaterThan(0);
  });
  it('れきしは 人物なら「だれ？」、ものなら「なに？」', () => {
    expect(plain(askText('rekishi', { tag: '人物', hints: ['ばくふを ひらいた'] } as never)))
      .toBe('ばくふを ひらいた。この人は だれ？');
    expect(plain(askText('rekishi', { tag: 'たてもの', hints: ['金色に かがやく'] } as never)))
      .toBe('金色に かがやく。これは なに？');
  });
  it('ヒントが 無ければ 空のまま（こわれない）', () => {
    expect(askText('pref', { tag: '', hints: [] } as never)).toBe('');
  });
});

describe('長い 文章題は 一気に 出す（10/20）', () => {
  it('さかいめは 20文字', () => {
    expect(PROG_MAX).toBe(20);
  });
  it('みじかい 文は 1文字ずつ、長い 文は そのまま 出す 判定に なる', () => {
    const short = 'この国旗{こっき}はどこ？';
    const long = '水{みず}を あたためつづけると 100度{ど}くらいで ぶくぶく わきます。これを なんと いう？';
    expect(plainLen(short)).toBeLessThan(PROG_MAX);
    expect(plainLen(long)).toBeGreaterThanOrEqual(PROG_MAX);
  });
  it('理科の 文章題は 半分いじょうが 長い（待たされていた もと）', () => {
    const all = ([3, 4, 5, 6] as const).flatMap((g) => RIKA_Q[g] || []);
    expect(all.length).toBe(400);
    const long = all.filter((r) => plainLen(r[1]) >= PROG_MAX).length;
    expect(long).toBeGreaterThan(all.length / 2);
  });
  it('都道府県は 問いかけに しても みじかいので 1文字ずつ のまま', () => {
    const s = new BattleSession({ level: 4, bsubj: 'pref', handi: 1, goal: 0 });
    let seen = 0;
    for (let i = 0; i < 40; i++) {
      const q = s.next().q;
      if (q.chars) continue;
      expect(plainLen(q.text), plain(q.text)).toBeLessThan(PROG_MAX + 14);
      seen++;
    }
    expect(seen).toBeGreaterThan(0);
  });
});

describe('まちがい直しの 数を えらぶ（10/20）', () => {
  const fill = (n: number) => {
    setKV(memoryKV()); reloadRecords();
    relayDeck('pref', 2).slice(0, n).forEach((q) => markMiss('pref', q.name));
  };
  it('5もんを えらんだら 5もんで おわる', () => {
    fill(20);
    const s = new BattleSession({ level: 4, bsubj: 'miss', handi: 1, goal: 0, missN: 5 });
    expect(s.missPool.length).toBe(5);
    for (let i = 0; i < 5; i++) { expect(s.missDone()).toBe(false); s.next(); }
    expect(s.missDone()).toBe(true);
  });
  it('0（ぜんぶ）は 帳の 数ぜんぶ', () => {
    fill(12);
    expect(new BattleSession({ level: 4, bsubj: 'miss', handi: 1, goal: 0, missN: 0 }).missPool.length).toBe(12);
    expect(new BattleSession({ level: 4, bsubj: 'miss', handi: 1, goal: 0 }).missPool.length).toBe(12);
  });
  it('帳に ある数より 多く えらんでも ある ぶんだけ', () => {
    fill(3);
    expect(new BattleSession({ level: 4, bsubj: 'miss', handi: 1, goal: 0, missN: 20 }).missPool.length).toBe(3);
  });
  it('多く まちがえた ものから 先に 入る', () => {
    setKV(memoryKV()); reloadRecords();
    const d = relayDeck('pref', 2);
    markMiss('pref', d[0].name);
    for (let i = 0; i < 3; i++) markMiss('pref', d[5].name);
    const s = new BattleSession({ level: 4, bsubj: 'miss', handi: 1, goal: 0, missN: 1 });
    expect(s.missPool[0].name).toBe(d[5].name);
  });
});

describe('えいご：英単語 → 日本語 の 向きも 出す（10/23）', () => {
  const run = (rate: string, n = 30) => {
    setKV(memoryKV()); reloadRecords();
    store('oyako-eigorate', rate);
    const s = new BattleSession({ level: 6, bsubj: 'eigo', handi: 1, goal: 0, players: 1 });
    return Array.from({ length: n }, () => s.next());
  };

  it('半々が 既定', () => {
    expect(EIGO_WORD_RATE).toBe(0.5);
  });

  it('「1」なら ぜんぶ 英単語 → 日本語', () => {
    for (const { q, opts } of run('1')) {
      expect(plain(q.text), plain(q.text)).toMatch(/^「[a-z]+」は 日本語で？$/);
      expect(q.art, 'イラストを 出すと こたえが ばれる').toBeNull();
      /* こたえは 英単語のまま（まちがい帳が つながる） */
      expect(q.answer).toMatch(/^[a-z]+$/);
      /* ボタンの 表示は ぜんぶ 日本語。英語の まま 出るものが あっては いけない */
      expect(opts.child.length).toBeGreaterThan(1);
      opts.child.forEach((o) => {
        expect(q.disp && q.disp[o], o + ' に いみが ない').toBeTruthy();
        expect(q.disp![o]).toBe(EIGO_IMI[o]);
      });
    }
  });

  it('「0」なら いままでどおり イラスト → 英語', () => {
    for (const { q } of run('0')) {
      expect(plain(q.text)).toBe('これを英語で？');
      expect(q.art, 'イラストが 出ていない').not.toBeNull();
      expect(q.disp).toBeUndefined();
    }
  });

  it('半々だと どちらも 出る', () => {
    let word = 0, art = 0;
    for (const { q } of run('0.5', 60)) (q.art ? art++ : word++);
    expect(word, '英単語の 向きが 出ない').toBeGreaterThan(0);
    expect(art, 'イラストの 向きが 出ない').toBeGreaterThan(0);
  });

  it('こたえを 見せるときは「apple（りんご）」の 形', () => {
    for (const { q } of run('1', 10)) {
      expect(q.yomi && q.yomi[q.answer]).toBe(EIGO_IMI[q.answer]);
    }
  });

  it('4たくは こたえと 同じ 文字の種類で そろう（見た目で しぼれない）', () => {
    for (const { q, opts } of run('1', 40)) {
      const shown = opts.child.map((o) => q.disp![o]);
      const k = isKata(q.disp![q.answer]);
      shown.forEach((v) => expect(isKata(v), shown.join(' / ') + ' ← こたえ ' + q.disp![q.answer]).toBe(k));
    }
  });

  it('カタカナの こたえには カタカナだけ、ひらがなの こたえには ひらがなだけ', () => {
    let kata = 0, hira = 0;
    for (const { q } of run('1', 60)) (isKata(q.disp![q.answer]) ? kata++ : hira++);
    /* どちらの 種類も 出る（かたよって いない） */
    expect(kata, 'カタカナの こたえが 出ない').toBeGreaterThan(0);
    expect(hira, 'ひらがなの こたえが 出ない').toBeGreaterThan(0);
  });

  it('同じ いみが 2つ ならばない', () => {
    for (const { q, opts } of run('1')) {
      const shown = opts.child.map((o) => q.disp![o]);
      expect(new Set(shown).size, shown.join('/')).toBe(shown.length);
    }
  });

  it('5年でも 6年でも 出る', () => {
    for (const lv of [5, 6] as const) {
      setKV(memoryKV()); reloadRecords();
      store('oyako-eigorate', '1');
      const s = new BattleSession({ level: lv, bsubj: 'eigo', handi: 1, goal: 0, players: 1 });
      const { q } = s.next();
      expect(plain(q.text), lv + '年').toMatch(/は 日本語で？$/);
    }
  });
});

describe('ヒントの かさなりを さける（10/24）', () => {
  it('片方が もう片方を ふくむ ものは 1つに する', () => {
    expect(noOverlap(['善光寺', '善光寺が ある'])).toEqual(['善光寺']);
    expect(noOverlap(['道後温泉', 'タオル', '道後温泉が ある'])).toEqual(['道後温泉', 'タオル']);
    expect(noOverlap(['日本の首都', '日本の首都'])).toEqual(['日本の首都']);
  });
  it('かっこの ふりがなは 数に 入れない', () => {
    expect(noOverlap(['高野山{こうやさん}', '高野山が 有名'])).toEqual(['高野山{こうやさん}']);
  });
  it('ちがう ヒントは のこる', () => {
    const a = ['りんご', 'ねぶたまつり', 'にんにくの 生産量が 日本一'];
    expect(noOverlap(a)).toEqual(a);
  });
  it('どの県でも ヒントが かさならない', () => {
    for (const lv of [1, 2] as const) {
      relayDeck('pref', lv).forEach((q) => {
        const hs = noOverlap(q.hints.slice(1));
        const key = (h: string) => plain(h).replace(/[（(][^）)]*[）)]/g, '').replace(/\s/g, '');
        hs.forEach((a, i) => hs.slice(i + 1).forEach((b) => {
          expect(key(a).includes(key(b)) || key(b).includes(key(a)), q.name + ': ' + a + ' ／ ' + b).toBe(false);
        }));
        expect(hs.length, q.name + ' の ヒントが 足りない').toBeGreaterThanOrEqual(2);
      });
    }
  });
});

describe('ジャンルを 2つ いじょう えらぶ（10/24）', () => {
  it('ミックスは いままでどおり その学年 ぜんぶ', () => {
    expect(subjKeys({ level: 6, bsubj: 'mix' })).toEqual(mixFor(6));
    expect(subjKeys({ level: 6, bsubj: 'mix', subs: ['pref', 'calc'] })).toEqual(mixFor(6));
  });
  it('2つ えらんだら その2つだけ', () => {
    expect(subjKeys({ level: 6, bsubj: 'pref', subs: ['pref', 'calc'] })).toEqual(['pref', 'calc']);
  });
  it('1つだけなら そのジャンル', () => {
    expect(subjKeys({ level: 6, bsubj: 'pref', subs: [] })).toEqual(['pref']);
    expect(subjKeys({ level: 6, bsubj: 'pref', subs: ['pref'] })).toEqual(['pref']);
  });
  it('その学年に ない ジャンルは のぞく', () => {
    /* えいごは 5年から。3年で えらんでも 出さない */
    expect(subjKeys({ level: 3, bsubj: 'pref', subs: ['pref', 'eigo', 'calc'] })).toEqual(['pref', 'calc']);
  });
  it('のこらなければ ミックスに もどす（画面が 止まらない）', () => {
    expect(subjKeys({ level: 3, bsubj: 'eigo', subs: ['eigo'] })).toEqual(mixFor(3));
  });
  it('同じものを 2回 入れても 1つ', () => {
    expect(subjKeys({ level: 6, bsubj: 'pref', subs: ['pref', 'calc', 'pref'] })).toEqual(['pref', 'calc']);
  });
  it('えらんだ 2つからしか 出ない', () => {
    setKV(memoryKV()); reloadRecords();
    const s = new BattleSession({ level: 6, bsubj: 'pref', handi: 1, goal: 0, players: 1, subs: ['pref', 'calc'] });
    for (let i = 0; i < 30; i++) {
      const { q } = s.next();
      expect(q.num || q.sub === 'pref', q.sub + ' が 出た').toBe(true);
    }
  });
});

describe('都道府県の 1つ目を 直した（10/24）', () => {
  const h1 = (nm: string) => plain(relayDeck('pref', 2).find((q) => q.name === nm)!.hints[0]);
  it('埼玉県は「海がない」を やめた（海のない県は 8つ ある）', () => {
    expect(h1('埼玉県')).not.toBe('海がない');
  });
  it('りんご・みかんの かぶりが なくなった', () => {
    expect(h1('青森県')).toBe('りんご');
    expect(h1('長野県')).not.toBe('りんご');
    expect(h1('和歌山県')).toBe('みかん');
    expect(h1('愛媛県')).not.toBe('みかん');
  });
  it('47県 ぜんぶで 1つ目が かぶらない', () => {
    const hs = relayDeck('pref', 2).map((q) => plain(q.hints[0]));
    const dup = hs.filter((h, i) => hs.indexOf(h) !== i);
    expect(dup, 'かぶり: ' + dup.join(', ')).toEqual([]);
  });
});
