import { describe, expect, it } from 'vitest';
import { ASK } from './ask';
import { RIKA, REKISHI } from './questions';
import { plain } from '../game/furigana';
import { BattleSession, askText, PROG_MAX } from '../game/battle';
import { relayDeck } from '../game/decks';

/* はやおしの 問題文（data/ask.ts）。名前が ずれると だまって 古い 作り方に もどるので テストで 見る */
const ROWS = { rika: RIKA as unknown as [string, string, string, string[]][], rekishi: REKISHI as unknown as [string, string, string, string[]][] };
const MAX = 25;   /* ふりがなを のぞいた 文字数の 上限（理科4択の 問題文と 同じ。画面で 2行に おさまる） */

describe('はやおしの 問題文', () => {
  for (const key of ['rika', 'rekishi'] as const) {
    const names = new Set(ROWS[key].map((r) => r[0]));

    it(key + '：登録した 名前は ぜんぶ 問題データに ある', () => {
      for (const n of Object.keys(ASK[key])) expect(names.has(n), n).toBe(true);
    });

    it(key + '：問題データの ぜんぶに 問題文が ある', () => {
      expect([...names].filter((n) => !ASK[key][n])).toEqual([]);
    });

    it(key + '：' + MAX + '文字 いない・「？」で おわる・こたえを ふくまない・ふりがなの かっこが そろう', () => {
      for (const [n, t] of Object.entries(ASK[key])) {
        const p = plain(t);
        expect(p.length, n + '：' + p).toBeLessThanOrEqual(MAX);
        expect(p, n).toMatch(/？$/);
        expect(p.includes(n), n + ' が 問題文に 入っている：' + p).toBe(false);
        expect((t.match(/\{/g) || []).length, n).toBe((t.match(/\}/g) || []).length);
      }
    });
  }

  it('人物は「だれ？」、時代は「何時代？」、それ いがいは「なに？」で きく', () => {
    for (const r of ROWS.rekishi) {
      const want = r[2] === '人物' ? /は だれ？$/ : r[2] === '時代' ? /のは 何時代？$/ : /は なに？$/;
      expect(plain(ASK.rekishi[r[0]]), r[0]).toMatch(want);
    }
    /* 理科は ぜんぶ「なに」で きく（「何に なる？」も ふくむ） */
    for (const [n, t] of Object.entries(ASK.rika)) expect(plain(t), n).toMatch(/(は なに|何に なる)？$/);
  });

  it('問題文は ask.ts の ものを つかい、問題文と かさなる ヒントは 出さない', () => {
    const deck = relayDeck('rekishi', 1).concat(relayDeck('rekishi', 2));
    const q = deck.find((x) => x.name === '徳川家康')!;
    expect(askText('rekishi', q)).toBe(ASK.rekishi['徳川家康']);
    const s = new BattleSession({ level: 6, bsubj: 'rekishi', handi: 1, goal: 0, players: 1 });
    const b = s.buildQ('rekishi', q, deck);
    expect(b.text).toBe(ASK.rekishi['徳川家康']);
    /* 1つ目の ヒント「江戸に ばくふを ひらいた」は 問題文と かさなるので 出さない */
    for (const h of b.hints || []) expect(plain(h)).not.toMatch(/ばくふを ひらいた/);
    expect((b.hints || []).length).toBeGreaterThan(0);
  });

  it('長くても 理科4択の 問題文と 同じ 長さまで（1文字ずつ 出す さかいめ PROG_MAX より 長い ものも ある）', () => {
    const all = [...Object.values(ASK.rika), ...Object.values(ASK.rekishi)].map((t) => plain(t).length);
    expect(Math.max(...all)).toBeLessThanOrEqual(MAX);
    expect(PROG_MAX).toBeLessThanOrEqual(MAX);
  });
});
