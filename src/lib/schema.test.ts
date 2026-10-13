import { describe, it, expect, beforeEach } from 'vitest';
import { isSeatMissing, noteSeatMissing, resetSchema, seatUsable, seatState } from './schema';

beforeEach(() => resetSchema());

describe('古いサーバーの 見分け', () => {
  it('列が 無い 返事を 見わける', () => {
    expect(isSeatMissing({ code: '42703', message: 'column scores.seat_no does not exist' })).toBe(true);
    expect(isSeatMissing({ code: 'PGRST204', message: "Could not find the 'seat_no' column of 'scores' in the schema cache" })).toBe(true);
    expect(isSeatMissing({ code: '42703', message: 'column best_scores.seat_no does not exist' })).toBe(true);
  });
  it('ほかの エラーは まきこまない', () => {
    expect(isSeatMissing(null)).toBe(false);
    expect(isSeatMissing({ message: 'network' })).toBe(false);
    expect(isSeatMissing({ code: '23505', message: 'duplicate key value' })).toBe(false);
    expect(isSeatMissing({ code: '23514', message: 'new row violates check constraint "scores_level_check"' })).toBe(false);
    expect(isSeatMissing({ code: 'PGRST205', message: "Could not find the table 'public.entries' in the schema cache" })).toBe(false);
  });
  it('1回 ことわられたら その セッションは 送らない', () => {
    expect(seatState()).toBe(null);
    expect(seatUsable()).toBe(true);
    noteSeatMissing();
    expect(seatState()).toBe(false);
    expect(seatUsable()).toBe(false);
    resetSchema();
    expect(seatUsable()).toBe(true);
  });
});
