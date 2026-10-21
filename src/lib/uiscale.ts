/* 画面の 大きさを 端末に あわせる。
   小さい スマホでは 少し 小さく、タブレットでは 大きく して、
   どの端末でも「スクロールなしで 1画面」に おさまるように する。
   せっていで 手動に することも できる（じどう／小さめ／ふつう／大きめ）。 */
import { store } from './storage';

export type ScaleMode = 'auto' | 'S' | 'M' | 'L';
const KEY = 'oyako-uiscale';
/* 手動のときの 倍率。じどうは 画面の 大きさから 計算する */
export const FIXED: Record<Exclude<ScaleMode, 'auto'>, number> = { S: 0.9, M: 1, L: 1.15 };
/* 設計の もとに した 画面（iPhone 12 くらい）。ここを 1倍と する */
const BASE_W = 390, BASE_H = 760;
export const MIN = 0.85, MAX = 1.3;

export function scaleMode(): ScaleMode {
  const v = store(KEY);
  return v === 'S' || v === 'M' || v === 'L' ? v : 'auto';
}

/** 画面の 幅と 高さの どちらでも はみ出さない 倍率。小数2けたに まるめる */
export function autoScale(w: number, h: number): number {
  const r = Math.min(w / BASE_W, h / BASE_H);
  return Math.round(Math.min(MAX, Math.max(MIN, r)) * 100) / 100;
}

export function scaleOf(mode: ScaleMode, w: number, h: number): number {
  return mode === 'auto' ? autoScale(w, h) : FIXED[mode];
}

/** いまの 画面に あわせて --ui を 書きこむ */
export function applyScale() {
  if (typeof document === 'undefined') return;
  const w = window.innerWidth || BASE_W, h = window.innerHeight || BASE_H;
  const v = scaleOf(scaleMode(), w, h);
  document.documentElement.style.setProperty('--ui', String(v));
}

export function setScaleMode(m: ScaleMode) {
  store(KEY, m);
  applyScale();
}

/** 回転や 画面の 出し入れで 大きさが 変わったら つけ直す */
export function startScaleWatch() {
  applyScale();
  if (typeof window === 'undefined') return;
  let t: number | null = null;
  const again = () => { if (t) clearTimeout(t); t = window.setTimeout(applyScale, 120); };
  window.addEventListener('resize', again);
  window.addEventListener('orientationchange', again);
}
