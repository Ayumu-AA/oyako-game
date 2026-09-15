/* 小さな道具。乱数は Math.random を使う（テストでは差しかえられるように rng を分けてある） */

export let rng: () => number = Math.random;
export function setRng(fn: () => number) { rng = fn; }

export function shuffle<T>(a: readonly T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = b[i]; b[i] = b[j]; b[j] = t;
  }
  return b;
}

/** 配列から n 個を ランダムに えらぶ（もとの配列は こわさない） */
export function pickN<T>(arr: readonly T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

export function pickOne<T>(arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function randInt(lo: number, hi: number): number { // lo..hi（両端をふくむ）
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function fmtTime(ms: number): string {
  const t = Math.floor(ms / 1000);
  return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
}

export function esc(t: unknown): string {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
