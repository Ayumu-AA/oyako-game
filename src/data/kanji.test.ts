/* 「かん字の読み」の ことばが、その学年までに ならう 漢字だけで できているか たしかめる。
   くらべる もとは kanji-grades.ts（学年べつ 漢字配当表：80/160/200/202/193/191＝1026字） */
import { describe, it, expect } from 'vitest';
import { KANJI_Q } from './kanji';
import { KANJI_BY_GRADE as BY } from './kanji-grades';
const GRADES = [1, 2, 3, 4, 5, 6] as const;
const CUM: Record<number, Set<string>> = {};
let acc = '';
for (const g of GRADES) { acc += BY[g]; CUM[g] = new Set([...acc]); }
const KANJI = /[一-鿿]/;
/** その学年の 出題デッキ（1つ下の 学年も まざる） */
const deckOf = (g: number) => (g > 1 ? KANJI_Q[g - 1] : []).concat(KANJI_Q[g]);

describe('かん字の読み', () => {
  it('学年べつ 漢字配当表は 80/160/200/202/193/191 で 1026字', () => {
    expect(GRADES.map((g) => [...BY[g]].length)).toEqual([80, 160, 200, 202, 193, 191]);
    expect(CUM[6].size).toBe(1026);
  });
  it('どの ことばも その学年までに ならう 漢字だけ', () => {
    for (const g of GRADES) {
      for (const [w, y] of KANJI_Q[g]) {
        for (const c of w) if (KANJI.test(c)) expect(CUM[g].has(c), g + '年 ' + w + ' の「' + c + '」').toBe(true);
        expect(y, w).toMatch(/^[ぁ-ゖー]+$/);
      }
    }
  });
  it('1年生は 一文字。2年生からは じゅくご も 出る', () => {
    expect(KANJI_Q[1].every(([w]) => [...w].length === 1)).toBe(true);
    for (const g of [2, 3, 4, 5, 6] as const) expect(KANJI_Q[g].some(([w]) => [...w].length >= 2), String(g)).toBe(true);
  });
  it('同じ画面に 出る よみは かぶらない（選たく肢が 2つ 正解に ならないように）', () => {
    for (const g of GRADES) {
      const seen = new Map<string, string>();
      for (const [w, y] of deckOf(g)) {
        expect(seen.has(y), g + '年 ' + seen.get(y) + ' と ' + w + ' が 同じ よみ').toBe(false);
        seen.set(y, w);
      }
    }
  });
  it('どの学年も 4たくに 足りる 数が ある', () => {
    for (const g of GRADES) expect(deckOf(g).length, String(g)).toBeGreaterThanOrEqual(30);
  });
});
