/* 地図（えがく・あてる）。SVG は文字列で組み立てる。DOM には さわらない */
import { JPBOX, JPINSET, JPMAP, JPCAP, WBOX, WLAND, WMAP, JPREG } from '../data/maps';
import { PREF, FLAG, PCODE, LV1_PREF, LV1_FLAG } from '../data/questions';
import { shuffle, rng } from './util';
import type { Level } from './types';

type MapSrc = Record<string, string>;
export const JP = JPMAP as MapSrc;
export const W = WMAP as MapSrc;
const CAP = JPCAP as unknown as Record<string, [number, number, string]>;
const REG = JPREG as Record<string, string>;
const JPB = JPBOX as [number, number];
const WB = WBOX as [number, number];
const INSET = JPINSET as [number, number, number, number];
type FRow = [string, string, string, string, string[], string];
const FLAGS = FLAG as FRow[];
const PREFS = PREF as [string, string, string, string[], string][];

export type VB = [number, number, number, number];
export type Marks = Record<string, 'hit' | 'got' | ''>;

export function jpName(code: string): string { return PREFS[Number(code) - 1][0]; }
export function capOf(code: string) { return CAP[code]; }
/* 「秋田県→秋田市」のように県名がそのまま入るか。ちがう県は 小5でよく問われる */
export function capSameName(code: string): boolean {
  const c = CAP[code]; if (!c) return true;
  return c[2].indexOf(jpName(code).replace(/[都道府県]$/, '')) === 0;
}
export function flagName(iso: string): string { for (const q of FLAGS) if (q[3] === iso) return q[0]; return iso; }
export function flagCont(iso: string): string { for (const q of FLAGS) if (q[3] === iso) return q[2]; return ''; }

/* パス文字列（M/L/Z だけ）をポリゴンに読みなおす。データを二重に持たないため */
const POLY: Record<string, number[][]> = {};
export function polyOf(key: string, d: string): number[][] {
  if (POLY[key]) return POLY[key];
  const rings: number[][] = []; let cur: number[] | null = null, buf: number[] = [];
  const re = /([MLZ])|(-?\d+(?:\.\d+)?)/g; let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    if (m[1]) {
      if (m[1] === 'Z') { if (cur && cur.length >= 6) rings.push(cur); cur = null; }
      else if (m[1] === 'M') { if (cur && cur.length >= 6) rings.push(cur); cur = []; }
      buf = [];
    } else {
      buf.push(+m[2]);
      if (buf.length === 2) { if (!cur) cur = []; cur.push(buf[0], buf[1]); buf = []; }
    }
  }
  if (cur && cur.length >= 6) rings.push(cur);
  POLY[key] = rings; return rings;
}
export function ringsFor(src: MapSrc, k: string) { return polyOf((src === JP ? 'jp' : 'w') + k, src[k]); }
export function inPoly(rings: number[][], x: number, y: number): boolean {   /* ぐう奇規則 */
  let c = false;
  for (const r of rings) {
    for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
      if (((yi > y) !== (yj > y)) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
  }
  return c;
}
export function distTo(rings: number[][], x: number, y: number): number {
  let best = Infinity;
  for (const r of rings) for (let i = 0; i < r.length; i += 2) {
    const dx = r[i] - x, dy = r[i + 1] - y, d = dx * dx + dy * dy;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}
/* タップ位置から いちばん近い相手を返す */
export function pickAt(src: MapSrc, keys: string[], x: number, y: number): string | null {
  let near: string | null = null, nd = Infinity;
  for (const k of keys) {
    const rings = ringsFor(src, k);
    if (inPoly(rings, x, y)) return k;
    const d = distTo(rings, x, y);
    if (d < nd) { nd = d; near = k; }
  }
  return near;
}
export function bboxOf(src: MapSrc, keys: string[], pad?: number): VB {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const k of keys) {
    const rings = ringsFor(src, k);
    for (const r of rings) for (let i = 0; i < r.length; i += 2) {
      if (r[i] < x0) x0 = r[i]; if (r[i] > x1) x1 = r[i];
      if (r[i + 1] < y0) y0 = r[i + 1]; if (r[i + 1] > y1) y1 = r[i + 1];
    }
  }
  pad = pad === undefined ? 14 : pad;
  return [x0 - pad, y0 - pad, (x1 - x0) + pad * 2, (y1 - y0) + pad * 2];
}

export interface SvgOpt { inset?: boolean; zoom?: number; ring?: string | null; caps?: string[] | 'all' | null; capLab?: string[] | null }

/* 日本地図を組み立てる。marks は {'38':'hit'} のような塗り分け */
export function jpSVG(marks?: Marks | null, vb?: VB | null, opt?: SvgOpt): string {
  marks = marks || {}; opt = opt || {};
  const box = vb || jpFullVB();
  const I = INSET;
  let s = '<svg class="mapsvg" viewBox="' + box.join(' ') + '" preserveAspectRatio="xMidYMid meet">';
  s += '<rect class="sea" x="' + (box[0] - box[2] * 3) + '" y="' + (box[1] - box[3] * 3) + '" width="' + (box[2] * 7) + '" height="' + (box[3] * 7) + '"/>';
  s += '<g class="mapg">';
  for (const k in JP) {
    if (k === '47') continue;
    s += '<path class="pf ' + (marks[k] || '') + '" data-k="' + k + '" d="' + JP[k] + '"/>';
  }
  if (opt.inset !== false) {
    s += '<rect class="insetbox" x="' + I[0] + '" y="' + I[1] + '" width="' + I[2] + '" height="' + I[3] + '"/>';
    s += '<path class="pf ' + (marks['47'] || '') + '" data-k="47" d="' + JP['47'] + '"/>';
    const fs = (box[2] / 42) / (opt.zoom || 1);   /* 拡大しても 画面上の大きさが変わらないように */
    s += '<text class="inslabel" font-size="' + fs.toFixed(2) + '" x="' + (I[0] + fs * 0.5) + '" y="' + (I[1] + fs * 1.3) + '">沖縄県</text>';
  }
  s += capsSVG(box, opt);
  if (opt.ring) s += ringSVG(JP, opt.ring, box);
  return s + '</g></svg>';
}
export function wSVG(marks?: Marks | null, vb?: VB | null, opt?: SvgOpt): string {
  marks = marks || {}; opt = opt || {};
  const box = vb || [0, 0, WB[0], WB[1]];
  let s = '<svg class="mapsvg" viewBox="' + box.join(' ') + '" preserveAspectRatio="xMidYMid meet">';
  s += '<rect class="sea" x="' + (box[0] - box[2] * 3) + '" y="' + (box[1] - box[3] * 3) + '" width="' + (box[2] * 7) + '" height="' + (box[3] * 7) + '"/>';
  s += '<g class="mapg">';
  s += '<path class="land" d="' + WLAND + '"/>';
  for (const k in W) s += '<path class="cty ' + (marks[k] || '') + '" data-k="' + k + '" d="' + W[k] + '"/>';
  if (opt.ring) s += ringSVG(W, opt.ring, box);
  return s + '</g></svg>';
}
/* 県庁所在地の点と名前 */
export function capsSVG(box: VB, opt: SvgOpt): string {
  if (!opt || !opt.caps) return '';
  const all = opt.caps === 'all';
  const keys = all ? Object.keys(CAP) : (opt.caps as string[]);
  const lab = opt.capLab || [];
  const scale = box[2] / JPB[0];
  const r = Math.max(1.1, 2.1 * scale);
  const fs = (box[2] / 26) / (opt.zoom || 1);
  const showText = box[2] < 260;   /* 全国表示のまま市の名前を出すと つぶれて読めない */
  let s = '';
  for (const k of keys) {
    const c = CAP[k]; if (!c) continue;
    if (k === '47' && opt.inset === false) continue;
    const hot = lab.indexOf(k) >= 0;
    s += '<circle class="capdot' + (hot ? ' on' : '') + '" cx="' + c[0] + '" cy="' + c[1] + '" r="' + (hot ? r * 1.9 : r).toFixed(2) + '"/>';
    if (hot) s += '<circle class="capcore" cx="' + c[0] + '" cy="' + c[1] + '" r="' + (r * 0.85).toFixed(2) + '"/>';
  }
  if (!showText) return s;
  for (const k of lab) {
    const c = CAP[k]; if (!c) continue;
    if (k === '47' && opt.inset === false) continue;
    const anchor = (c[0] > box[0] + box[2] * 0.72) ? 'end' : 'start';
    const dx = (anchor === 'end' ? -1 : 1) * fs * 0.95;
    s += '<text class="caplab' + (capSameName(k) ? '' : ' diff') + '" text-anchor="' + anchor
      + '" font-size="' + fs.toFixed(2) + '" x="' + (c[0] + dx).toFixed(1) + '" y="' + (c[1] + fs * 0.38).toFixed(1) + '">' + c[2] + '</text>';
  }
  return s;
}
/* まわった県の 県庁所在地を 文字で ならべる。県名とちがうものは 赤 */
export function capListHTML(codes: string[]): string {
  if (!codes.length) return '';
  const diff = codes.filter((k) => !capSameName(k));
  const html = '県庁所在地　' + codes.map((k) => {
    const c = CAP[k]; if (!c) return '';
    return capSameName(k) ? c[2] : '<b>' + c[2] + '</b>';
  }).filter(Boolean).join('・');
  return html + (diff.length ? '<br><span class="rm-hint">赤い字は 県名と ちがう 県庁所在地</span>' : '');
}
/* 小さすぎて 見つけにくい県・国には 目じるしの輪をつける */
export function ringSVG(src: MapSrc, key: string, box: VB): string {
  if (!key || !src[key]) return '';
  const rings = ringsFor(src, key);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const r of rings) for (let i = 0; i < r.length; i += 2) {
    if (r[i] < x0) x0 = r[i]; if (r[i] > x1) x1 = r[i];
    if (r[i + 1] < y0) y0 = r[i + 1]; if (r[i + 1] > y1) y1 = r[i + 1];
  }
  const w = x1 - x0, h = y1 - y0;
  if (Math.max(w, h) > box[2] / 9) return '';
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const r = Math.max(Math.hypot(w, h) / 2 * 1.9, box[2] / 26);
  return '<circle class="findring" cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + r.toFixed(1) + '"/>';
}
let JPFULLVB: VB | null = null;
export function jpFullVB(): VB {
  if (!JPFULLVB) {
    const b = bboxOf(JP, Object.keys(JP), 8), I = INSET;
    const x0 = Math.min(b[0], I[0] - 4), y0 = Math.min(b[1], I[1] - 4);
    const x1 = Math.max(b[0] + b[2], I[0] + I[2] + 4), y1 = Math.max(b[1] + b[3], I[1] + I[3] + 4);
    JPFULLVB = [x0, y0, x1 - x0, y1 - y0];
  }
  return JPFULLVB;
}
export function worldFullVB(): VB { return [0, 0, WB[0], WB[1]]; }

/* 地図の枠と 地図の縦横比が ちがうと、上下（左右）に 大きな空白ができる。枠の比率にあわせて広げる */
export function fitVB(vb: VB, w: number, h: number): VB {
  if (!w || !h) return vb.slice() as VB;
  let [x, y, bw, bh] = vb;
  const ar = w / h;
  if (bw / bh < ar) { const nw = bh * ar; x -= (nw - bw) / 2; bw = nw; }
  else { const nh = bw / ar; y -= (nh - bh) / 2; bh = nh; }
  return [x, y, bw, bh];
}

/* ===== ちずクイズ ===== */
export type GeoKind = 'jp' | 'world';
export function geoSrc(kind: GeoKind): MapSrc { return kind === 'world' ? W : JP; }
export function geoAllKeys(kind: GeoKind): string[] { return Object.keys(geoSrc(kind)); }
export function geoNameOf(kind: GeoKind, k: string): string { return kind === 'world' ? flagName(k) : jpName(k); }
export function geoGroupOf(kind: GeoKind, k: string): string { return kind === 'world' ? flagCont(k) : REG[k]; }
export function geoFullVB(kind: GeoKind): VB { return kind === 'world' ? worldFullVB() : jpFullVB(); }

export function geoDeck(kind: GeoKind, lv: Level): string[] {
  if (kind === 'world') {
    return shuffle(FLAGS.filter((q) => lv === 1 ? (LV1_FLAG as Set<string>).has(q[0]) : true).map((q) => q[3]));
  }
  const all = PREFS.map((_, i) => PCODE(i) as string);
  return shuffle(lv === 1 ? all.filter((c) => (LV1_PREF as Set<string>).has(jpName(c))) : all);
}

/* 4つの選たく肢。低学年 … ほかの地方・大陸から／高学年 … 同じ地方の中から */
export function geoChoices(kind: GeoKind, lv: Level, ans: string): string[] {
  const all = geoAllKeys(kind);
  const g = geoGroupOf(kind, ans);
  const same = all.filter((k) => k !== ans && geoGroupOf(kind, k) === g);
  const pool = (lv === 1 || same.length < 3)
    ? all.filter((k) => k !== ans && geoGroupOf(kind, k) !== g)
    : same;
  let pick = shuffle(pool).slice(0, 3);
  if (pick.length < 3) {
    const more = shuffle(all.filter((k) => k !== ans && pick.indexOf(k) < 0));
    pick = pick.concat(more.slice(0, 3 - pick.length));
  }
  return shuffle(pick.concat([ans]));
}

/* 高学年の拡大枠。「正解が 画面の 1/9 くらいに見える大きさ」を基準に窓を作り、ランダムにずらす */
export function geoViewFor(kind: GeoKind, ans: string, regionKeys: string[] | null): VB {
  const src = geoSrc(kind);
  const full = geoFullVB(kind);
  const region = regionKeys && regionKeys.length ? bboxOf(src, regionKeys, kind === 'world' ? 18 : 16) : full;
  const ab = bboxOf(src, [ans], 0);
  const size = Math.max(ab[2], ab[3]);
  const maxW = Math.max(region[2], region[3]);
  const minW = Math.max(full[2], full[3]) / 7;
  const w = Math.min(maxW, Math.max(size * 9, minW));
  let cx = ab[0] + ab[2] / 2, cy = ab[1] + ab[3] / 2;
  const slackX = Math.max(0, (w - ab[2]) / 2 - w * 0.08);
  const slackY = Math.max(0, (w - ab[3]) / 2 - w * 0.08);
  cx += (rng() * 2 - 1) * slackX;
  cy += (rng() * 2 - 1) * slackY;
  const box: VB = [cx - w / 2, cy - w / 2, w, w];
  if (ab[0] < box[0]) box[0] = ab[0] - w * 0.04;
  if (ab[1] < box[1]) box[1] = ab[1] - w * 0.04;
  if (ab[0] + ab[2] > box[0] + w) box[0] = ab[0] + ab[2] - w + w * 0.04;
  if (ab[1] + ab[3] > box[1] + w) box[1] = ab[1] + ab[3] - w + w * 0.04;
  return box;
}

/** 表示用の枠。枠が 地図の外まで はみ出すと 海だけの帯ができるので 地図の中に 寄せる */
export function geoFitVB(kind: GeoKind, base: VB, w: number, h: number, ans: string | null): VB {
  const fit = fitVB(base, w, h);
  const full = geoFullVB(kind);
  if (fit[2] <= full[2]) fit[0] = Math.min(Math.max(fit[0], full[0]), full[0] + full[2] - fit[2]);
  if (fit[3] <= full[3]) fit[1] = Math.min(Math.max(fit[1], full[1]), full[1] + full[3] - fit[3]);
  if (ans) {
    const ab = bboxOf(geoSrc(kind), [ans], 0);
    if (ab[0] < fit[0]) fit[0] = ab[0] - fit[2] * 0.04;
    if (ab[1] < fit[1]) fit[1] = ab[1] - fit[3] * 0.04;
    if (ab[0] + ab[2] > fit[0] + fit[2]) fit[0] = ab[0] + ab[2] - fit[2] + fit[2] * 0.04;
    if (ab[1] + ab[3] > fit[1] + fit[3]) fit[1] = ab[1] + ab[3] - fit[3] + fit[3] * 0.04;
  }
  return fit;
}

/** 1問ぶんの 出題情報 */
export interface GeoQ { ans: string; scope: string[] | null; vb: VB | null; opts: string[]; sub: string }
export function geoQuestion(kind: GeoKind, lv: Level, k: string): GeoQ {
  let scope: string[] | null = null, vb: VB | null = null;
  if (lv !== 1) {
    const sc = geoAllKeys(kind).filter((x) => geoGroupOf(kind, x) === geoGroupOf(kind, k));
    if (sc.length >= 4) { scope = sc; vb = geoViewFor(kind, k, sc); }   /* その地方だけで4たくが作れるときだけ 拡大 */
  }
  const sub = (lv === 1 || !vb)
    ? (kind === 'world' ? '世界地図の 赤いところは どこ？' : '日本地図の 赤いところは どこ？')
    : geoGroupOf(kind, k) + (kind === 'world' ? '' : '地方') + 'の 赤いところは どこ？';
  return { ans: k, scope, vb, opts: geoChoices(kind, lv, k), sub };
}

/* 2本指で 拡大・回転（見たいときだけ） */
export interface View { k: number; deg: number; tx: number; ty: number }
export const viewZero = (): View => ({ k: 1, deg: 0, tx: 0, ty: 0 });
export function viewChanged(v: View) { return v.k !== 1 || v.deg !== 0 || v.tx !== 0 || v.ty !== 0; }
export function viewClamp(v: View, b: VB): View {
  const k = Math.min(6, Math.max(1, v.k));
  const lim = Math.max(b[2], b[3]) * (0.18 + (k - 1) * 0.6);
  const tx = Math.min(lim, Math.max(-lim, v.tx));
  const ty = Math.min(lim, Math.max(-lim, v.ty));
  let d = ((v.deg % 360) + 360) % 360;
  for (const t of [0, 90, 180, 270, 360]) if (Math.abs(d - t) < 8) d = t === 360 ? 0 : t;
  return { k, deg: d, tx, ty };
}
export function viewTransform(v: View, b: VB): string {
  const cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2;
  return 'translate(' + v.tx.toFixed(2) + ' ' + v.ty.toFixed(2) + ') '
    + 'translate(' + cx.toFixed(2) + ' ' + cy.toFixed(2) + ') '
    + 'rotate(' + v.deg.toFixed(2) + ') scale(' + v.k.toFixed(3) + ') '
    + 'translate(' + (-cx).toFixed(2) + ' ' + (-cy).toFixed(2) + ')';
}
