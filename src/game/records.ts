/* まちがい帳（MISS）と 出題きろく（SEEN）。
   保存先は lib/storage の KVStorage。キーの形は v1 と同じ（oyako-miss / oyako-seen）なので
   旧版で遊んだ端末の記録が そのまま引きつがれる */
import { store } from '../lib/storage';
import { shuffle } from './util';
import type { Mode, Subject } from './types';

export const MISS_KEY = 'oyako-miss';
export const SEEN_KEY = 'oyako-seen';
export const SEEN_MAX = 800;

export interface MissEntry { n: number; t: number }
type MissMap = Record<string, MissEntry>;
type SeenMap = Record<string, number>;

function loadJSON<T>(k: string): T {
  try { return (JSON.parse(store(k) || '{}') || {}) as T; } catch { return {} as T; }
}
function saveJSON(k: string, v: unknown) {
  try { store(k, JSON.stringify(v)); } catch { /* 保存できなくても ゲームは止めない */ }
}

let MISS: MissMap = loadJSON<MissMap>(MISS_KEY);
let SEEN: SeenMap = loadJSON<SeenMap>(SEEN_KEY);

/** 1問ぶんの きろく（サーバーと やりとりする形） */
export interface StatRow { sub: string; name: string; miss_count: number; last_seen_at: number; last_missed_at: number }
type Listener = (row: StatRow) => void;
const listeners: Listener[] = [];
/** きろくが 変わったら 呼ばれる（同期の 送信キューが 使う） */
export function onRecordChange(fn: Listener): () => void {
  listeners.push(fn);
  return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
}
export function statOf(sub: string, name: string): StatRow {
  const k = qkey(sub, name);
  return { sub, name, miss_count: MISS[k]?.n || 0, last_seen_at: SEEN[k] || 0, last_missed_at: MISS[k]?.t || 0 };
}
function changed(sub: string, name: string) { const row = statOf(sub, name); listeners.forEach((fn) => { try { fn(row); } catch { /* 同期の失敗で ゲームは 止めない */ } }); }
export function allStats(): StatRow[] {
  const keys = new Set([...Object.keys(MISS), ...Object.keys(SEEN)]);
  return [...keys].map((k) => { const i = k.indexOf(':'); return statOf(k.slice(0, i), k.slice(i + 1)); });
}
/** サーバーの きろくを 取りこむ。新しいほうを 採用する。戻り値は 変わった件数 */
export function mergeRemote(rows: StatRow[]): number {
  let n = 0;
  for (const r of rows) {
    const k = qkey(r.sub, r.name);
    const lm = MISS[k], ls = SEEN[k] || 0;
    if (r.last_missed_at > (lm?.t || 0)) {
      MISS[k] = { n: Math.min(9, Math.max(0, r.miss_count)), t: r.last_missed_at };
      n++;
    }
    if (r.last_seen_at > ls) { SEEN[k] = r.last_seen_at; n++; }
  }
  if (n) { saveJSON(MISS_KEY, MISS); saveJSON(SEEN_KEY, SEEN); }
  return n;
}

/** 保存先を切りかえたあとなどに 読みなおす */
export function reloadRecords() {
  MISS = loadJSON<MissMap>(MISS_KEY);
  SEEN = loadJSON<SeenMap>(SEEN_KEY);
}

/** ちずクイズは 中身が 都道府県・国旗と 同じなので きろくを まとめる */
export function subjOf(mode: Mode): Subject {
  return mode === 'geopref' ? 'pref' : mode === 'geoflag' ? 'flag' : (mode as Subject);
}
export function qkey(sub: string, name: string) { return sub + ':' + name; }

export function markMiss(sub: string | undefined, name: string | undefined) {
  if (!sub || !name || sub === 'math' || sub === 'calc') return;
  const k = qkey(sub, name), o = MISS[k] || { n: 0, t: 0 };
  o.n = Math.min(9, o.n + 1); o.t = Date.now(); MISS[k] = o; saveJSON(MISS_KEY, MISS);
  changed(sub, name);
}
export function markHit(sub: string | undefined, name: string | undefined) {
  if (!sub || !name) return;
  const k = qkey(sub, name), o = MISS[k];
  if (!o) return;
  /* 0 になっても 消さずに 時刻つきで 残す（n=0 は「当てて 消えた」しるし。
     ほかの端末の 古い記録と くらべるとき、消えたほうが 新しいと 分かる） */
  o.n = Math.max(0, o.n - 1); o.t = Date.now(); MISS[k] = o;
  saveJSON(MISS_KEY, MISS);
  changed(sub, name);
}
export function markSeen(sub: string | undefined, name: string | undefined) {
  if (!sub || !name) return;
  SEEN[qkey(sub, name)] = Date.now();
  const ks = Object.keys(SEEN);
  if (ks.length > SEEN_MAX) {
    ks.sort((a, b) => SEEN[a] - SEEN[b]);
    ks.slice(0, ks.length - SEEN_MAX).forEach((k) => { delete SEEN[k]; });
  }
  saveJSON(SEEN_KEY, SEEN);
  changed(sub, name);
}
export function seenAt(sub: string, name: string): number { return SEEN[qkey(sub, name)] || 0; }
export function missCount(): number { return Object.keys(MISS).filter((k) => MISS[k].n > 0).length; }
export function seenCount(): number { return Object.keys(SEEN).length; }
export function clearRecords() {
  MISS = {}; SEEN = {}; saveJSON(MISS_KEY, MISS); saveJSON(SEEN_KEY, SEEN);
}
/** まちがい帳のキー一覧。多くまちがえたものを 先に、同じなら 古いものから */
export function missKeys(): { sub: string; name: string }[] {
  return Object.keys(MISS).filter((k) => MISS[k].n > 0)
    .sort((a, b) => (MISS[b].n - MISS[a].n) || (MISS[a].t - MISS[b].t))
    .map((k) => { const i = k.indexOf(':'); return { sub: k.slice(0, i), name: k.slice(i + 1) }; });
}
/** まだ出していない問題を 先に、つぎに 古いものから。同じ並びには ならない */
export function orderBySeen<T extends { name: string }>(sub: string, arr: readonly T[]): T[] {
  return shuffle(arr).sort((a, b) => seenAt(sub, a.name) - seenAt(sub, b.name));
}
