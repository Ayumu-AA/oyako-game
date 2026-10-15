import { describe, it, expect } from 'vitest';
import { RIKA_Q } from './rika';
import { RIKA } from './questions';
import { plain } from '../game/furigana';
import { rikaDeck } from '../game/decks';
import { rikaRows, rikaPool, okSubj, SUBJ_FROM } from '../game/battle';
import type { Level } from '../game/types';

const GRADES: Level[] = [3, 4, 5, 6];
type RikaRow = [string, string, string, string, string, number];

describe('理科の問題（学年べつ・いただいた100問×4学年）', () => {
  it('3〜6年に 100問ずつ。1・2年には 置かない', () => {
    for (const g of GRADES) expect(RIKA_Q[g].length, g + '年').toBe(100);
    expect(RIKA_Q[1]).toBeUndefined();
    expect(RIKA_Q[2]).toBeUndefined();
  });
  it('どの学年も 10単元 × 10問', () => {
    for (const g of GRADES) {
      const u: Record<string, number> = {};
      for (const [unit] of RIKA_Q[g]) u[unit] = (u[unit] || 0) + 1;
      expect(Object.keys(u).length, g + '年の単元数').toBe(10);
      for (const k in u) expect(u[k], g + '年 ' + k).toBe(10);
    }
  });
  it('こたえ1つ＋まちがい5つで、ぜんぶ ちがう文字列', () => {
    for (const g of GRADES) for (const [, q, ans, wrong] of RIKA_Q[g]) {
      expect(wrong.length, q).toBe(5);
      expect(new Set([ans, ...wrong]).size, q + ' の選たく肢が かぶっている').toBe(6);
      for (const c of [ans, ...wrong]) expect(c.trim().length, q + ' の空の選たく肢').toBeGreaterThan(0);
    }
  });
  it('出すときは こたえと 字の長さが 近い まちがいを えらぶ（長い＝こたえ に ならないように）', () => {
    /* いただいた原稿は「〜だから」と 理由を 書く問題で こたえだけ 文が 長い。
       そのままだと いちばん長いのを えらべば 当たるので、近い長さの ものを 先に する。
       ここでは「ならべかえた あとの 上位3つ」が「まちがい5つから むやみに 3つ とった とき」より
       こたえとの 長さの差が 小さくなることを 見る */
    let better = 0, same = 0;
    for (const g of GRADES) for (const [, , ans, wrong] of RIKA_Q[g]) {
      const d = (v: string) => Math.abs([...v].length - [...ans].length);
      const sorted = rikaPool(ans, wrong).slice(0, 3);
      const picked = Math.max(...sorted.map(d));
      const worst = Math.max(...[...wrong].sort((a, b) => d(b) - d(a)).slice(0, 3).map(d));
      if (picked < worst) better++; else same++;
    }
    expect(better, 'ならべかえが きいていない').toBeGreaterThan(300);
    expect(better + same).toBe(400);
  });
  it('rikaPool は まちがいを 1つも 落とさない', () => {
    const w = ['あ', 'いいい', 'ううううう', 'ええ', 'おおおお'];
    const out = rikaPool('かきく', w);
    expect(out.length).toBe(5);
    expect([...out].sort()).toEqual([...w].sort());
    /* こたえ（3文字）に 近い順に なっている */
    expect([...out[0]].length).toBe(3);
  });
  it('問題文・こたえ・解説が ぜんぶ 入っている', () => {
    for (const g of GRADES) for (const [unit, q, ans, , fact] of RIKA_Q[g]) {
      for (const [k, v] of [['単元', unit], ['問題文', q], ['こたえ', ans], ['解説', fact]] as const) {
        expect(v.trim().length, g + '年 ' + q + ' の ' + k).toBeGreaterThan(0);
      }
    }
  });
  it('問題文が 1つも かぶっていない（400問ぜんぶ）', () => {
    const all = GRADES.flatMap((g) => RIKA_Q[g].map(([, q]) => q));
    expect(all.length).toBe(400);
    expect(new Set(all).size).toBe(400);
  });
});

describe('いままでの 理科（ヒント形式）の 学年わけ', () => {
  const rows = RIKA as unknown as RikaRow[];
  it('ぜんぶ 3〜6年に 入っている（1・2年は 学校でも 理科が ない）', () => {
    for (const q of rows) expect(q[5], q[0]).toBeGreaterThanOrEqual(3);
    for (const q of rows) expect(q[5], q[0]).toBeLessThanOrEqual(6);
  });
  it('どの学年にも 5問いじょう ある', () => {
    for (const g of GRADES) {
      const n = rows.filter((q) => q[5] === g).length;
      expect(n, g + '年の 理科（ヒント形式）').toBeGreaterThanOrEqual(5);
    }
  });
  it('こたえの 名前が かぶっていない', () => {
    const names = rows.map((q) => q[0]);
    expect(new Set(names).size).toBe(names.length);
  });
  it('ヒントは 3つ以上、へぇは 必ず ある', () => {
    for (const q of rows) {
      expect(q[3].length, q[0] + ' のヒント').toBeGreaterThanOrEqual(3);
      expect(plain(q[4]).length, q[0] + ' のへぇ').toBeGreaterThan(0);
    }
  });
});

describe('学年ごとの デッキ', () => {
  it('理科は 3年から（1・2年は からっぽ）', () => {
    expect(rikaDeck(1)).toEqual([]);
    expect(rikaDeck(2)).toEqual([]);
    expect(SUBJ_FROM.rika).toBe(3);
    expect(okSubj('rika', 2)).toBe(false);
    expect(okSubj('rika', 3)).toBe(true);
  });
  it('ヒント形式は その学年＋1つ下（3年は その学年だけ）', () => {
    const d3 = rikaDeck(3).map((q) => q.name);
    const d4 = rikaDeck(4).map((q) => q.name);
    expect(d3.length).toBeGreaterThan(0);
    /* 4年には 3年の ぶんも 入る */
    expect(d4.length).toBeGreaterThan(rikaDeck(5).length - d3.length);
    for (const n of d3) expect(d4).toContain(n);
    /* 名前の かぶりなし */
    for (const g of GRADES) {
      const names = rikaDeck(g).map((q) => q.name);
      expect(new Set(names).size, g + '年').toBe(names.length);
    }
  });
  it('問題も その学年＋1つ下（3年は 100問、4〜6年は 200問）', () => {
    expect(rikaRows(3).length).toBe(100);
    for (const g of [4, 5, 6] as Level[]) expect(rikaRows(g).length, g + '年').toBe(200);
    expect(rikaRows(2).length).toBe(0);
  });
});

/* ===== 字数の 上限 =====
   1人用は 問題文が 出そろってから 9秒で、3秒ごとに 3点→2点→1点。
   満点を とるには 最初の 3秒。小学校中学年が 4つを 見くらべながら 読む速さを
   ひかえめに 5字/秒と みて、
     ・選たく肢 1つ   … 10字以内（4つで 40字 ＝ 約8秒）
     ・4つの 最長と最短の差 … 4字以内（長さで こたえが 分からないように）
     ・問題文         … 25字以内（1文字 0.07秒で 出るので 約1.8秒）
   いまの 原稿は この基準を こえるものが のこっている。
   直すたびに ここの 数を へらしていく（増やさない ための 上限）。 */
const LIMIT = { opt: 10, gap: 4, q: 25 } as const;
/** いま 基準を こえている 数。直したら この数を 下げる（上げてはいけない） */
const OVER = { opt: 113, gap: 113, q: 103 } as const;

describe('選たく肢の 字数（読める 長さに おさめる）', () => {
  const all = GRADES.flatMap((g) => RIKA_Q[g]);
  /* rikaPool は 同じ近さの ときに ばらばらに するので、かぞえる ときは
     ばらつかない やり方（近い順・同じなら 元の順）で そろえる */
  const four = (ans: string, wrong: string[]) => {
    const d = (v: string) => Math.abs([...v].length - [...ans].length);
    return [ans, ...wrong.map((w, i) => [w, i] as const).sort((a, b) => d(a[0]) - d(b[0]) || a[1] - b[1]).slice(0, 3).map((x) => x[0])];
  };
  const len = (v: string) => [...v].length;

  it('基準を こえている 問題は これ以上 ふえない', () => {
    const over = { opt: 0, gap: 0, q: 0 };
    for (const [, q, ans, wrong] of all) {
      if (len(q) > LIMIT.q) over.q++;
      const f = four(ans, wrong);
      if (Math.max(...f.map(len)) > LIMIT.opt) over.opt++;
      if (Math.max(...f.map(len)) - Math.min(...f.map(len)) > LIMIT.gap) over.gap++;
    }
    expect(over.opt, '選たく肢が 10字を こえる問題が ふえた').toBeLessThanOrEqual(OVER.opt);
    expect(over.gap, '4つの 長さの差が 4字を こえる問題が ふえた').toBeLessThanOrEqual(OVER.gap);
    expect(over.q, '問題文が 25字を こえる問題が ふえた').toBeLessThanOrEqual(OVER.q);
    /* 直したのに OVER を 下げ忘れていないか（10問以上 余裕が できたら 下げる） */
    expect(OVER.opt - over.opt, 'OVER.opt を 今の数に 下げてください').toBeLessThan(10);
    expect(OVER.gap - over.gap, 'OVER.gap を 今の数に 下げてください').toBeLessThan(10);
    expect(OVER.q - over.q, 'OVER.q を 今の数に 下げてください').toBeLessThan(10);
  });

  it('どんなに 長くても 読めない ほどでは ない（安全弁）', () => {
    for (const [, q, ans, wrong] of all) {
      expect(len(q), q).toBeLessThanOrEqual(45);
      for (const c of four(ans, wrong)) expect(len(c), q + ' → ' + c).toBeLessThanOrEqual(32);
      expect(four(ans, wrong).reduce((s, c) => s + len(c), 0), q + ' の4つの合計').toBeLessThanOrEqual(75);
    }
  });
});
