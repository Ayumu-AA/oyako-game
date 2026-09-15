/* 同期の テスト。Supabase は 偽物（メモリ上の 表）で 置きかえる */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setKV, memoryKV, store } from './storage';
import { setClient, type Client } from './supabase';
import { enqueue, flush, pullRecords, queueLength, startSync, QUEUE_KEY } from './sync';
import { reloadRecords, markMiss, markHit, markSeen, missCount, statOf, mergeRemote, seenAt } from '../game/records';

/* ---- 偽 Supabase ---- */
type Row = Record<string, unknown>;
function fakeClient(opts: { uid?: string | null; failNet?: boolean } = {}) {
  const uid = opts.uid === undefined ? 'u-1' : opts.uid;
  const tables: Record<string, Row[]> = { question_stats: [], scores: [] };
  const netErr = () => { throw new Error('network'); };
  const from = (t: string) => ({
    upsert: async (rows: Row[]) => {
      if (opts.failNet) netErr();
      for (const r of rows) {
        const i = tables[t].findIndex((x) => x.user_id === r.user_id && x.subject === r.subject && x.name === r.name);
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
