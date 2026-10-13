/* 同期の テスト。Supabase は 偽物（メモリ上の 表）で 置きかえる */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setKV, memoryKV, store } from './storage';
import { setClient, type Client } from './supabase';
import { enqueue, flush, pullRecords, queueLength, startSync, enqueueScore, enqueueProfile, QUEUE_KEY } from './sync';
import { reloadRecords, markMiss, markHit, markSeen, missCount, statOf, mergeRemote, seenAt } from '../game/records';

/* ---- 偽 Supabase ---- */
type Row = Record<string, unknown>;
function fakeClient(opts: { uid?: string | null; failNet?: boolean } = {}) {
  const uid = opts.uid === undefined ? 'u-1' : opts.uid;
  const tables: Record<string, Row[]> = { question_stats: [], scores: [], profiles: [] };
  const netErr = () => { throw new Error('network'); };
  const from = (t: string) => ({
    upsert: async (rowsIn: Row | Row[]) => {
      if (opts.failNet) netErr();
      const rows = Array.isArray(rowsIn) ? rowsIn : [rowsIn];
      for (const r of rows) {
        const i = tables[t].findIndex((x) => t === 'profiles' ? x.id === r.id : (x.user_id === r.user_id && x.subject === r.subject && x.name === r.name));
        if (i >= 0) tables[t][i] = r; else tables[t].push(r);
      }
      return { error: null };
    },
    insert: async (row: Row) => { if (opts.failNet) netErr(); tables[t].push(row); return { error: null }; },
    select: () => ({ eq: async (_k: string, v: unknown) => { if (opts.failNet) netErr(); return { data: tables[t].filter((r) => r.user_id === v), error: null }; } }),
  });
  const c = {
    auth: {
      getSession: async () => ({ data: { session: uid ? { user: { id: uid } } : null } }),
      signInAnonymously: async () => (uid ? { data: { user: { id: uid } }, error: null } : { data: { user: null }, error: { message: 'no' } }),
    },
    from,
  } as unknown as Client;
  return { c, tables };
}

beforeEach(() => { setKV(memoryKV()); reloadRecords(); vi.useFakeTimers(); });

describe('送信キュー', () => {
  it('同じ問題は 最新だけ 残る', () => {
    enqueue({ k: 'stat', row: statOf('pref', '青森県') });
    enqueue({ k: 'stat', row: { ...statOf('pref', '青森県'), miss_count: 3 } });
    enqueue({ k: 'stat', row: statOf('rika', 'てこ') });
    expect(queueLength()).toBe(2);
    expect(JSON.parse(store(QUEUE_KEY)!)[0].row.miss_count).toBe(3);
  });
  it('つながらないときは 残り、つながったら 流れる', async () => {
    const bad = fakeClient({ failNet: true });
    setClient(bad.c);
    enqueue({ k: 'stat', row: { sub: 'pref', name: '青森県', miss_count: 1, last_seen_at: 10, last_missed_at: 10 } });
    expect(await flush()).toBe(false);
    expect(queueLength()).toBe(1);
    const good = fakeClient();
    setClient(good.c);
    expect(await flush()).toBe(true);
    expect(queueLength()).toBe(0);
    expect(good.tables.question_stats).toEqual([{ user_id: 'u-1', subject: 'pref', name: '青森県', miss_count: 1, last_seen_at: new Date(10).toISOString(), last_missed_at: new Date(10).toISOString() }]);
  });
  it('ログインできないときは 送らない（キューは 残る）', async () => {
    setClient(fakeClient({ uid: null }).c);
    enqueue({ k: 'score', id: 's1', row: { event_code: 'home', mode: 'pref', level: 2, seconds: 90, score: 5, rank_i: 2, nickname: 'てすと' } });
    expect(await flush()).toBe(false);
    expect(queueLength()).toBe(1);
  });
  it('名前は 最新だけ 残り、点数より 先に 送られる', async () => {
    const f = fakeClient();
    setClient(f.c);
    enqueueScore({ event_code: 'home', mode: 'pref', level: 2, seconds: 90, score: 5, rank_i: 2, nickname: 'たろう' });
    enqueueProfile('たろう', 2); enqueueProfile('じろう', 2);
    expect(queueLength()).toBe(2);
    expect(await flush()).toBe(true);
    expect(f.tables.profiles).toEqual([{ id: 'u-1', nickname: 'じろう', level: 2 }]);
    expect(f.tables.scores.length).toBe(1);
    expect(f.tables.scores[0]).toMatchObject({ user_id: 'u-1', nickname: 'たろう', score: 5 });
  });
  it('記録が 変わると キューに 積まれる', () => {
    setClient(fakeClient().c);
    startSync();
    markMiss('pref', '北海道'); markSeen('rika', 'てこ');
    expect(queueLength()).toBe(2);
  });
});

describe('サーバーの記録を 取りこむ', () => {
  it('新しいほうが 勝つ（当てて 消えたのも 反映）', () => {
    markMiss('pref', '青森県');                       // いま
    const rows = [
      { sub: 'pref', name: '青森県', miss_count: 3, last_seen_at: 0, last_missed_at: Date.now() - 100000 },   // 古い → 負け
      { sub: 'pref', name: '秋田県', miss_count: 2, last_seen_at: 5, last_missed_at: Date.now() + 1000 },     // 新しい → 採用
      { sub: 'rika', name: 'てこ', miss_count: 0, last_seen_at: 7, last_missed_at: Date.now() + 1000 },       // 消えた しるし
    ];
    markMiss('rika', 'てこ');
    expect(mergeRemote(rows)).toBe(4);   // 秋田: miss+seen、てこ: miss+seen
    expect(statOf('pref', '青森県').miss_count).toBe(1);
    expect(statOf('pref', '秋田県').miss_count).toBe(2);
    expect(statOf('rika', 'てこ').miss_count).toBe(0);
    expect(missCount()).toBe(2);
    expect(seenAt('pref', '秋田県')).toBe(5);
  });
  it('初回は 端末の記録を 全部 送り、2回目は 送らない', async () => {
    const f = fakeClient();
    setClient(f.c);
    markMiss('pref', '北海道'); markHit('pref', '北海道');   // n=0 の しるし も 送る
    markSeen('eigo', 'apple');
    f.tables.question_stats.push({ user_id: 'u-1', subject: 'kokugo', name: 'x', miss_count: 1, last_seen_at: null, last_missed_at: new Date(Date.now() + 5000).toISOString() });
    store(QUEUE_KEY, '[]');
    expect(await pullRecords()).toBe(1);
    expect(missCount()).toBe(1);                      // kokugo:x が 取りこまれた
    expect(queueLength()).toBe(2);                    // 北海道・apple を 送る
    await flush();
    expect(f.tables.question_stats.length).toBe(3);
    store(QUEUE_KEY, '[]');
    await pullRecords();
    expect(queueLength()).toBe(0);                    // 2回目は 積まない
  });
});

/* ===== サーバーが 古いとき（SQL 007 が まだ）=====
   scores.seat_no が 無いサーバーに 番号つきで 送ると 1行まるごと ことわられる。
   記録が 消えてしまうので、番号ぬきで 送りなおす。 */
import { scoreRow } from './sync';
import { resetSchema, seatUsable } from './schema';

/** 受付番号の 列を 知らない 古いサーバー */
function oldServer() {
  const rows: Row[] = [];
  const c = {
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'u-1' } } } }),
      signInAnonymously: async () => ({ data: { user: { id: 'u-1' } }, error: null }),
    },
    from: () => ({
      insert: async (row: Row) => {
        if ('seat_no' in row) return { error: { code: 'PGRST204', message: "Could not find the 'seat_no' column of 'scores' in the schema cache" } };
        rows.push(row); return { error: null };
      },
      upsert: async () => ({ error: null }),
      select: () => ({ eq: async () => ({ data: [], error: null }) }),
    }),
  } as unknown as Client;
  return { c, rows };
}

const SCORE = { event_code: 'home', mode: 'battle1', level: 2 as const, seconds: 90, score: 7, rank_i: 2, nickname: 'そら' };

describe('受付番号の 列が 無いサーバー', () => {
  beforeEach(() => resetSchema());

  it('番号ぬきで 送りなおして、記録を 落とさない', async () => {
    const { c, rows } = oldServer();
    setClient(c);
    enqueueScore({ ...SCORE, seat_no: 12 });
    await vi.runAllTimersAsync();
    expect(await flush()).toBe(true);
    expect(rows.length, '記録が 1行も 入っていない').toBe(1);
    expect(rows[0]).toMatchObject({ user_id: 'u-1', mode: 'battle1', score: 7 });
    expect('seat_no' in rows[0]).toBe(false);
    expect(queueLength(), 'キューに 残ったまま').toBe(0);
    expect(seatUsable(), '2回目からは 送らない').toBe(false);
  });

  it('1回 わかれば つぎの 記録は はじめから 番号ぬき（やりとりが 1回ですむ）', async () => {
    const { c, rows } = oldServer();
    setClient(c);
    enqueueScore({ ...SCORE, seat_no: 12 });
    await vi.runAllTimersAsync(); await flush();
    enqueueScore({ ...SCORE, seat_no: 13, score: 9 });
    await vi.runAllTimersAsync();
    expect(await flush()).toBe(true);
    expect(rows.length).toBe(2);
    expect(rows.every((r) => !('seat_no' in r))).toBe(true);
  });
});

describe('scoreRow（送る かたち）', () => {
  beforeEach(() => resetSchema());
  it('番号を もらった ときだけ 付ける', () => {
    expect(scoreRow('u-1', { ...SCORE, seat_no: 12 })).toMatchObject({ user_id: 'u-1', seat_no: 12 });
  });
  it('家で あそぶ ぶん（番号なし）は 付けない＝古いサーバーでも そのまま 入る', () => {
    for (const v of [null, undefined, 0]) {
      expect('seat_no' in scoreRow('u-1', { ...SCORE, seat_no: v as number | null }), String(v)).toBe(false);
    }
  });
  it('ことわられた あとは 付けない', () => {
    expect('seat_no' in scoreRow('u-1', { ...SCORE, seat_no: 12 })).toBe(true);
    resetSchema();
    expect(scoreRow('u-1', { ...SCORE, seat_no: 12 }, true).seat_no).toBeUndefined();
  });
});
