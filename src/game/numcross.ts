/* けいさんクロス（1人用）の 純ロジック */
import { shuffle, randInt } from './util';
import type { Level } from './types';

export type NcKey = 'a' | 'b' | 's1' | 'd' | 'e' | 's2' | 'c1' | 'c2' | 'T';
export const NC_KEYS: NcKey[] = ['a', 'b', 's1', 'd', 'e', 's2', 'c1', 'c2', 'T'];
export const NC_POS: Record<NcKey, [number, number]> = { a: [0, 0], b: [0, 2], s1: [0, 4], d: [2, 0], e: [2, 2], s2: [2, 4], c1: [4, 0], c2: [4, 2], T: [4, 4] };
const NC_COEF: Record<NcKey, number[]> = { a: [1, 0, 0, 0], b: [0, 1, 0, 0], s1: [1, 1, 0, 0], d: [0, 0, 1, 0], e: [0, 0, 0, 1], s2: [0, 0, 1, 1], c1: [1, 0, 1, 0], c2: [0, 1, 0, 1], T: [1, 1, 1, 1] };
export const NC_LINES: NcKey[][] = [['a', 'b', 's1'], ['d', 'e', 's2'], ['c1', 'c2', 'T'], ['a', 'd', 'c1'], ['b', 'e', 'c2'], ['s1', 's2', 'T']];

/* 見えているマスだけで 答えが1つに決まるか（ランクが4か）を調べる */
export function ncRank(keys: NcKey[]): number {
  const m = keys.map((k) => NC_COEF[k].slice());
  let rank = 0;
  for (let col = 0; col < 4; col++) {
    let piv = -1;
    for (let i = rank; i < m.length; i++) { if (Math.abs(m[i][col]) > 1e-9) { piv = i; break; } }
    if (piv < 0) continue;
    const t = m[rank]; m[rank] = m[piv]; m[piv] = t;
    for (let i = 0; i < m.length; i++) {
      if (i === rank || Math.abs(m[i][col]) < 1e-9) continue;
      const f = m[i][col] / m[rank][col];
      for (let j = 0; j < 4; j++) m[i][j] -= f * m[rank][j];
    }
    rank++;
  }
  return rank;
}
export interface NcPuzzle { v: Record<NcKey, number>; hide: NcKey[] }
export function makeNum(level: Level): NcPuzzle {
  const lo = level === 1 ? 1 : 3, hi = level === 1 ? 9 : 19;
  const k = level === 1 ? 4 : 5;
  for (let t = 0; t < 600; t++) {
    const a = randInt(lo, hi), b = randInt(lo, hi), d = randInt(lo, hi), e = randInt(lo, hi);
    const v: Record<NcKey, number> = { a, b, s1: a + b, d, e, s2: d + e, c1: a + d, c2: b + e, T: a + b + d + e };
    const hide = shuffle(NC_KEYS).slice(0, k);
    const shown = NC_KEYS.filter((x) => hide.indexOf(x) < 0);
    if (ncRank(shown) === 4) return { v, hide };
  }
  return { v: { a: 2, b: 3, s1: 5, d: 4, e: 1, s2: 5, c1: 6, c2: 4, T: 10 }, hide: ['s1', 'c1', 'e', 'T'] };
}

export interface NcState { puz: NcPuzzle; val: Partial<Record<NcKey, string>>; sel: NcKey | null; checked: boolean }
export function newNum(level: Level): NcState {
  const puz = makeNum(level);
  const val: Partial<Record<NcKey, string>> = {};
  puz.hide.forEach((k) => { val[k] = ''; });
  return { puz, val, sel: puz.hide[0], checked: false };
}
export function ncVal(nc: NcState, k: NcKey): number | null {
  if (nc.puz.hide.indexOf(k) < 0) return nc.puz.v[k];
  const s = nc.val[k];
  return s === '' || s === undefined ? null : Number(s);
}
export function ncLeft(nc: NcState): number { return nc.puz.hide.filter((k) => nc.val[k] === '').length; }
/** こたえあわせ後の 色分け */
export function ncMarks(nc: NcState): { good: Partial<Record<NcKey, boolean>>; bad: Partial<Record<NcKey, boolean>> } {
  const good: Partial<Record<NcKey, boolean>> = {}, bad: Partial<Record<NcKey, boolean>> = {};
  if (nc.checked) {
    NC_LINES.forEach((L) => {
      const v = L.map((k) => ncVal(nc, k));
      if (v.some((x) => x === null)) return;
      if ((v[0] as number) + (v[1] as number) === v[2]) L.forEach((k) => { good[k] = true; });
      else L.forEach((k) => { bad[k] = true; });
    });
  }
  return { good, bad };
}
export function ncAllOk(nc: NcState): boolean {
  return NC_LINES.every((L) => { const v = L.map((k) => ncVal(nc, k)); return (v[0] as number) + (v[1] as number) === v[2]; });
}
export function ncKey(nc: NcState, n: string) {
  const k = nc.sel; if (!k) return;
  const cur = nc.val[k] || '';
  if (n === 'del') nc.val[k] = cur.slice(0, -1);
  else if (cur.length < 3) nc.val[k] = (cur + n).replace(/^0(?=\d)/, '');
  nc.checked = false;
}
