/* 受付番号。実名は 端末にも サーバーにも 入れない。
   受付で 渡した 番号札（例「6-12」）の うしろの 数だけを あずかり、イベント・学年ごとに 1つ 覚える。
   番号と 実名の 対応表は 紙（または 学校の Excel）で PTA が 持つ。アプリは 誰かを 知らない。 */
import { store } from './storage';
import type { Level } from '../game/types';

export const SEAT_MAX = 999;
export const SEAT_NONE = 0;      /* 「ふだを もっていない」で すすんだとき */
export const seatKey = (ev: string, lv: Level) => 'oyako-seat-' + ev + '-' + lv;

/** 受付番号を きく イベントか（家で あそぶ ぶんは きかない） */
export const seatAsk = (ev: string) => ev !== 'home';

/** その イベント・学年で 入れた 番号。まだ きいていなければ null */
export function getSeat(ev: string, lv: Level): number | null {
  const v = store(seatKey(ev, lv));
  if (v === null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= SEAT_MAX ? n : null;
}
export function setSeat(ev: string, lv: Level, no: number) {
  store(seatKey(ev, lv), String(Math.max(0, Math.min(SEAT_MAX, Math.trunc(no)))));
}

/** 入力を 数に する。全角も うけつける。空・0・4けた・数字以外は null */
export function parseSeat(t: string): number | null {
  const s = (t || '').trim().replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  if (!/^\d{1,3}$/.test(s)) return null;
  const n = Number(s);
  return n >= 1 && n <= SEAT_MAX ? n : null;
}
