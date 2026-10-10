/* 文しょうだいの たしかめ。
   ・こたえの 数が 文の 計算と あっているか
   ・ルビの ついていない 漢字が その学年までに ならうものか */
import { describe, it, expect } from 'vitest';
import { WORD_Q } from './word';
import { KANJI_BY_GRADE as BY } from './kanji-grades';
import { plain, FURI_RE } from '../game/furigana';

const GRADES = [1, 2, 3, 4, 5, 6] as const;
const CUM: Record<number, Set<string>> = {};
let acc = '';
for (const g of GRADES) { acc += BY[g]; CUM[g] = new Set([...acc]); }
const KANJI = /[一-鿿]/;
/** ルビの ついた ところを のぞいた 文（ルビが あれば 読めるので 学年を 問わない） */
const noRuby = (t: string) => t.replace(new RegExp(FURI_RE.source, 'g'), '');

describe('文しょうだい（おかいもの）', () => {
  it('ルビの ない 漢字は その学年までに ならうものだけ', () => {
    for (const g of GRADES) {
      for (const [text] of WORD_Q[g]) {
        for (const c of noRuby(text)) {
          if (KANJI.test(c)) expect(CUM[g].has(c), `${g}年「${plain(text)}」の「${c}」`).toBe(true);
        }
      }
    }
  });
  it('1年生は 漢字が ほとんど ない（円 と 数字だけ）', () => {
    const ok = new Set(['円', '出']);
    for (const [text] of WORD_Q[1]) {
      for (const c of noRuby(text)) if (KANJI.test(c)) expect(ok.has(c), `1年「${plain(text)}」の「${c}」`).toBe(true);
    }
  });
  it('こたえは 0より 大きい 整数で、たんいが ついている', () => {
    for (const g of GRADES) {
      for (const [text, ans, unit] of WORD_Q[g]) {
        expect(Number.isInteger(ans) && ans > 0, plain(text)).toBe(true);
        expect(unit.length, plain(text)).toBeGreaterThan(0);
      }
    }
  });
  it('どの学年も 4たくに 足りる 数が ある', () => {
    for (const g of GRADES) {
      const deck = (g > 1 ? WORD_Q[g - 1] : []).concat(WORD_Q[g]);
      expect(deck.length, String(g)).toBeGreaterThanOrEqual(8);
    }
  });
  it('同じ 文が ない', () => {
    const seen = new Set<string>();
    for (const g of GRADES) for (const [text] of WORD_Q[g]) {
      expect(seen.has(plain(text)), plain(text)).toBe(false);
      seen.add(plain(text));
    }
  });
});
