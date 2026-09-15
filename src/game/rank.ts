/* くらい（ランク）。時間あたりの正解数で きまる。90秒でも 60秒でも 同じ ものさしで はかれる */
import { RANKS, RANK_PACE, RANK_MSG } from '../data/texts';
import type { RankKind } from './types';

const RANKS_T = RANKS as { n: string; c: string }[];
const PACE_T = RANK_PACE as Record<RankKind, number[]>;
const MSG_T = RANK_MSG as Record<RankKind, string[]>;

export interface Rank { i: number; name: string; color: string; pace: number; th: number[] }

/** score もん を sec 秒で とったときの 位 */
export function rankOf(kind: RankKind, score: number, sec: number): Rank {
  const th = PACE_T[kind] || PACE_T.relay;
  const pace = sec > 0 ? (score * 60 / sec) : 0;
  let i = 0;
  for (let k = 0; k < th.length; k++) { if (pace >= th[k]) i = k; }
  if (score <= 0) i = 0;
  return { i, name: RANKS_T[i].n + '級', color: RANKS_T[i].c, pace, th };
}
/** つぎの位まで あと何もん か */
export function rankNext(kind: RankKind, score: number, sec: number): { name: string; more: number } | null {
  const r = rankOf(kind, score, sec);
  if (r.i >= RANKS_T.length - 1) return null;
  const need = Math.ceil(r.th[r.i + 1] * sec / 60 - 1e-9);
  return { name: RANKS_T[r.i + 1].n + '級', more: Math.max(1, need - score) };
}
/** 「90秒で 12もん」の 一行 */
export function rankLine(score: number, sec: number, unit?: string): string {
  return sec + '秒で ' + score + (unit || 'もん');
}
export function rankMsg(kind: RankKind, i: number): string { return MSG_T[kind][i]; }
