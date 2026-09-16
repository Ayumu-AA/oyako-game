/* 親子クロスワード の 純ロジック */
import { CROSS, DAKU, HANDAKU, SMALL } from '../data/cross';
import { rng } from './util';
import type { Level } from './types';

export interface CwWord { d: 'A' | 'D'; r: number; c: number; w: string; q: string }
export interface CwPuzzle { g: string[]; w: CwWord[] }
const PUZ = CROSS as Record<number, CwPuzzle[]>;

export function cwKey(r: number, c: number) { return r + '_' + c; }
export function cwCells(w: CwWord): [number, number][] {
  const a: [number, number][] = [];
  for (let i = 0; i < w.w.length; i++) a.push(w.d === 'A' ? [w.r, w.c + i] : [w.r + i, w.c]);
  return a;
}

export interface CwState {
  idx: number; puz: CwPuzzle; R: number; C: number;
  nums: Record<string, number>;      // 単語の先頭マス → 番号
  letters: Record<string, string>;   // 入れた文字
  sel: { i: number; pos: number };
  last: [number, number] | null;     // 最後に入れたマス（てんてん・まる 用）
  hints: number;
}

/** 新しい盤面。直前と同じ問題は さける。forceIdx を渡すと その問題（「さいしょから やりなおす」用） */
export function newCross(level: Level, prevIdx: number | null, forceIdx: number | null = null): CwState {
  const list = PUZ[level] || PUZ[1];
  let idx = Math.floor(rng() * list.length);
  if (forceIdx !== null && forceIdx >= 0 && forceIdx < list.length) idx = forceIdx;
  else if (prevIdx !== null && prevIdx === idx && list.length > 1) idx = (idx + 1) % list.length;
  const puz = list[idx];
  const R = puz.g.length, C = puz.g[0].length;
  const nums: Record<string, number> = {}; let n = 0;
  puz.w.slice().sort((a, b) => (a.r - b.r) || (a.c - b.c)).forEach((w) => {
    const k = cwKey(w.r, w.c);
    if (!(k in nums)) { n++; nums[k] = n; }
  });
  return { idx, puz, R, C, nums, letters: {}, sel: { i: 0, pos: 0 }, last: null, hints: 0 };
}

export function wordsAt(cw: CwState, r: number, c: number): number[] {
  const out: number[] = [];
  cw.puz.w.forEach((w, i) => { if (cwCells(w).some((p) => p[0] === r && p[1] === c)) out.push(i); });
  return out;
}
export function wordOk(cw: CwState, w: CwWord): boolean {
  return cwCells(w).every((p, k) => cw.letters[cwKey(p[0], p[1])] === w.w[k]);
}
export function cwLeft(cw: CwState): number {
  let left = 0;
  for (let r = 0; r < cw.R; r++) for (let c = 0; c < cw.C; c++) {
    if (cw.puz.g[r][c] !== '#' && !cw.letters[cwKey(r, c)]) left++;
  }
  return left;
}
export function cwAllOk(cw: CwState): boolean { return cw.puz.w.every((w) => wordOk(cw, w)); }

/* 以下は 状態を書きかえる。UI は 呼んだあと 再描画する */
export function cwSelectWord(cw: CwState, i: number) { cw.sel = { i, pos: 0 }; cw.last = null; }
/** カギの一覧（キーボードの上）から えらぶ：いまのマスの位置を保つ */
export function cwSelectWordKeepPos(cw: CwState, i: number) {
  const cur = cwCells(cw.puz.w[cw.sel.i])[cw.sel.pos];
  const nc = cwCells(cw.puz.w[i]);
  const pos = nc.findIndex((p) => p[0] === cur[0] && p[1] === cur[1]);
  cw.sel = { i, pos: pos < 0 ? 0 : pos }; cw.last = null;
}
/** マスをタップ：同じマスを 2回押すと ヨコ⇄タテ が 入れかわる */
export function cwTapCell(cw: CwState, r: number, c: number) {
  const ws = wordsAt(cw, r, c);
  if (!ws.length) return;
  let i = cw.sel.i;
  const cells = cwCells(cw.puz.w[i]);
  const inCur = cells.some((p) => p[0] === r && p[1] === c);
  if (!inCur || ws.length === 1) { i = ws[0]; }
  else if (ws.length > 1) { i = ws[(ws.indexOf(i) + 1) % ws.length]; }
  const nc = cwCells(cw.puz.w[i]);
  cw.sel = { i, pos: nc.findIndex((p) => p[0] === r && p[1] === c) };
  cw.last = null;
}
export function cwInput(cw: CwState, ch: string) {
  const cells = cwCells(cw.puz.w[cw.sel.i]);
  const p = cells[cw.sel.pos];
  cw.letters[cwKey(p[0], p[1])] = ch;
  cw.last = [p[0], p[1]];
  cw.sel.pos = Math.min(cw.sel.pos + 1, cells.length - 1);
}
export function cwModify(cw: CwState, kind: '゛' | '゜' | '小') {
  const cells = cwCells(cw.puz.w[cw.sel.i]);
  let p = cw.last;
  if (!p || !cw.letters[cwKey(p[0], p[1])]) {
    p = cells[cw.sel.pos];
    if (!cw.letters[cwKey(p[0], p[1])] && cw.sel.pos > 0) p = cells[cw.sel.pos - 1];
  }
  const cur = cw.letters[cwKey(p[0], p[1])];
  if (!cur) return;
  const map = (kind === '゛' ? DAKU : kind === '゜' ? HANDAKU : SMALL) as Record<string, string>;
  const rev: Record<string, string> = {};
  Object.keys(map).forEach((k) => { rev[map[k]] = k; });
  const nv = map[cur] || rev[cur] || null;
  if (nv) cw.letters[cwKey(p[0], p[1])] = nv;
}
/** フリック入力の「゛゜小」キー：は → ば → ぱ → は、か → が → か、つ → づ → っ → つ のように 順に まわす */
export function cycleKana(ch: string): string {
  const daku = DAKU as Record<string, string>, han = HANDAKU as Record<string, string>, sm = SMALL as Record<string, string>;
  const base = (x: string) => {
    for (const m of [daku, han, sm]) for (const k of Object.keys(m)) if (m[k] === x) return k;
    return x;
  };
  const b = base(ch);
  const ring = [b]; if (daku[b]) ring.push(daku[b]); if (han[b]) ring.push(han[b]); if (sm[b]) ring.push(sm[b]);
  if (ring.length === 1) return ch;
  return ring[(ring.indexOf(ch) + 1) % ring.length];
}
export function cwCycle(cw: CwState) {
  const cells = cwCells(cw.puz.w[cw.sel.i]);
  let p = cw.last;
  if (!p || !cw.letters[cwKey(p[0], p[1])]) {
    p = cells[cw.sel.pos];
    if (!cw.letters[cwKey(p[0], p[1])] && cw.sel.pos > 0) p = cells[cw.sel.pos - 1];
  }
  const cur = cw.letters[cwKey(p[0], p[1])];
  if (!cur) return;
  cw.letters[cwKey(p[0], p[1])] = cycleKana(cur);
}
export function cwDelete(cw: CwState) {
  const cells = cwCells(cw.puz.w[cw.sel.i]);
  const p = cells[cw.sel.pos];
  if (cw.letters[cwKey(p[0], p[1])]) delete cw.letters[cwKey(p[0], p[1])];
  else if (cw.sel.pos > 0) { cw.sel.pos--; const q = cells[cw.sel.pos]; delete cw.letters[cwKey(q[0], q[1])]; }
}
/** 「ここを開く」：いま選んでいるマス（合っていれば その語の まちがっているマス）を 正解で埋める */
export function cwHint(cw: CwState) {
  const cells = cwCells(cw.puz.w[cw.sel.i]);
  const right = (x: [number, number]) => cw.letters[cwKey(x[0], x[1])] === cw.puz.g[x[0]][x[1]];
  let p = cells[cw.sel.pos];
  if (right(p)) {
    const q = cells.find((x) => !right(x));
    if (!q) return;              /* この語はもう全部あっている */
    p = q; cw.sel.pos = cells.indexOf(q);
  }
  cw.letters[cwKey(p[0], p[1])] = cw.puz.g[p[0]][p[1]];
  cw.hints++;
  cw.last = [p[0], p[1]];
  cw.sel.pos = Math.min(cw.sel.pos + 1, cells.length - 1);
}
