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

/** ツールバーが 出入りしても かわらない 高さ。
    innerHeight は スマホで スクロールすると アドレスバーが 引っこんで 80px ほど かわり、
    そのたびに 倍率が かわって 画面ぜんたいが のび縮みしていた（長い けっか画面で 目立つ）。
    100svh（バーが 出ている ときの 小さい ほう）を じっさいに はかって つかう。CSS の 高さも 100svh が もと */
function stableHeight(): number {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none';
  document.body.appendChild(probe);
  const h = probe.getBoundingClientRect().height;
  probe.remove();
  return h || window.innerHeight || BASE_H;   /* svh が つかえない 古い ブラウザは 今までどおり */
}

/* さいごに 書きこんだ ときの 条件。同じなら 書きなおさない（バーの 出入りでは 何も おきない） */
let lastKey = '';

/** いまの 画面に あわせて --ui を 書きこむ */
export function applyScale() {
  if (typeof document === 'undefined' || !document.body) return;
  const mode = scaleMode();
  const w = window.innerWidth || BASE_W, h = stableHeight();
  const key = mode + ':' + w + 'x' + Math.round(h);
  if (key === lastKey) return;
  lastKey = key;
  document.documentElement.style.setProperty('--ui', String(scaleOf(mode, w, h)));
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
