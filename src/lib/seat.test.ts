import { describe, it, expect, beforeEach } from 'vitest';
import { setKV, memoryKV } from './storage';
import { getSeat, setSeat, parseSeat, seatAsk, seatKey, SEAT_MAX } from './seat';

beforeEach(() => setKV(memoryKV()));

describe('受付番号', () => {
  it('入れた番号を イベント・学年ごとに 覚える', () => {
    setSeat('T2026-12', 6, 12);
    expect(getSeat('T2026-12', 6)).toBe(12);
    expect(getSeat('T2026-12', 5)).toBe(null);      /* 学年が ちがえば 別 */
    expect(getSeat('home', 6)).toBe(null);          /* イベントが ちがえば 別 */
  });
  it('ふだなし（0）も 覚える＝二度 きかない', () => {
    setSeat('T2026-12', 1, 0);
    expect(getSeat('T2026-12', 1)).toBe(0);
  });
  it('大きすぎる値は 丸めて 入れる', () => {
    setSeat('T2026-12', 2, 9999);
    expect(getSeat('T2026-12', 2)).toBe(SEAT_MAX);
    setSeat('T2026-12', 3, -5);
    expect(getSeat('T2026-12', 3)).toBe(0);
  });
  it('キーに イベントと 学年が 入る', () => {
    expect(seatKey('T2026-12', 3)).toBe('oyako-seat-T2026-12-3');
  });
  it('家で あそぶ ときは きかない', () => {
    expect(seatAsk('home')).toBe(false);
    expect(seatAsk('T2026-12')).toBe(true);
  });
});

describe('parseSeat', () => {
  it('半角・全角の 1〜999 を うけつける', () => {
    expect(parseSeat('1')).toBe(1);
    expect(parseSeat('12')).toBe(12);
    expect(parseSeat('999')).toBe(999);
    expect(parseSeat('１２')).toBe(12);
    expect(parseSeat(' 7 ')).toBe(7);
  });
  it('空・0・4けた・数字以外は ことわる', () => {
    for (const t of ['', '0', '00', '1000', 'あ', '1a', '-3', '1.5']) expect(parseSeat(t)).toBe(null);
  });
});
