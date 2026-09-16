/* 記録の同期。
   - 記録は まず localStorage に書く（ゲームは 一度も 止めない）
   - 同時に 送信キュー（oyako-queue）に積み、つながっているとき Supabase に流す
   - ログインできたら サーバーの記録を 取りこんで、端末の記録と 新しいほうを 採用する
   - Supabase を「正」とするのは このため。端末の記録が 消えても サーバーから 戻る */
import { store } from './storage';
import { ensureUser, getClient } from './supabase';
import { onRecordChange, mergeRemote, allStats, type StatRow } from '../game/records';
import { getNick, setNickLocal, setExtraNg } from './nickname';

export const QUEUE_KEY = 'oyako-queue';
export const QUEUE_MAX = 500;

export interface ScoreRow {
  event_code: string; mode: string; level: 1 | 2; seconds: number; score: number; rank_i: number; nickname: string;
}
export type QueueOp =
  | { k: 'stat'; row: StatRow }
  | { k: 'score'; row: ScoreRow; id: string }
  | { k: 'profile'; nickname: string; level: 1 | 2 };

function loadQ(): QueueOp[] { try { return JSON.parse(store(QUEUE_KEY) || '[]') || []; } catch { return []; } }
function saveQ(q: QueueOp[]) { try { store(QUEUE_KEY, JSON.stringify(q)); } catch { /* 容量切れ */ } }
export function queueLength(): number { return loadQ().length; }

export function enqueue(op: QueueOp) {
  let q = loadQ();
  if (op.k === 'stat') q = q.filter((x) => !(x.k === 'stat' && x.row.sub === op.row.sub && x.row.name === op.row.name));   /* 同じ問題は 最新だけ */
  if (op.k === 'profile') q = q.filter((x) => x.k !== 'profile');   /* 名前も 最新だけ */
  q.push(op);
  if (q.length > QUEUE_MAX) q = q.slice(q.length - QUEUE_MAX);
  saveQ(q);
  scheduleFlush();
}

const iso = (ms: number) => (ms ? new Date(ms).toISOString() : null);

let flushing: Promise<boolean> | null = null;
let timer: number | null = null;
function scheduleFlush() {
  if (typeof window === 'undefined') return;
  if (timer) clearTimeout(timer);
  timer = window.setTimeout(() => { timer = null; void flush(); }, 800);
}

/** キューを 送る。戻り値は 全部 送れたか */
export function flush(): Promise<boolean> {
  if (flushing) return flushing;
  flushing = (async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
      const c = getClient(); if (!c) return false;
      const uid = await ensureUser(); if (!uid) return false;
      const q = loadQ(); if (!q.length) return true;
      const stats = q.filter((x): x is Extract<QueueOp, { k: 'stat' }> => x.k === 'stat');
      const scores = q.filter((x): x is Extract<QueueOp, { k: 'score' }> => x.k === 'score');
      const profs = q.filter((x): x is Extract<QueueOp, { k: 'profile' }> => x.k === 'profile');
      const sentStat = new Set<string>(), sentScore = new Set<string>();
      let sentProfile = false;
      /* 名前は 先に 送る（点数の 行が 名前を 持つので） */
      if (profs.length) {
        const pr = profs[profs.length - 1];
        const { error } = await c.from('profiles').upsert({ id: uid, nickname: pr.nickname, level: pr.level }, { onConflict: 'id' });
        if (!error) sentProfile = true;
      }
      if (stats.length) {
        const rows = stats.map((s) => ({
          user_id: uid, subject: s.row.sub, name: s.row.name,
          miss_count: s.row.miss_count, last_seen_at: iso(s.row.last_seen_at), last_missed_at: iso(s.row.last_missed_at),
        }));
        const { error } = await c.from('question_stats').upsert(rows, { onConflict: 'user_id,subject,name' });
        if (!error) stats.forEach((s) => sentStat.add(s.row.sub + ':' + s.row.name));
      }
      for (const s of scores) {
        const { error } = await c.from('scores').insert({ user_id: uid, ...s.row });
        if (!error || /duplicate|23505/.test(error.message)) sentScore.add(s.id);
      }
      const rest = loadQ().filter((x) => x.k === 'stat' ? !sentStat.has(x.row.sub + ':' + x.row.name) : x.k === 'score' ? !sentScore.has(x.id) : !sentProfile);
      saveQ(rest);
      return rest.length === 0;
    } catch { return false; }
    finally { flushing = null; }
  })();
  return flushing;
}

/** サーバーの記録を 取りこむ。初回は 端末の記録も 全部 送る */
export async function pullRecords(): Promise<number> {
  try {
    const c = getClient(); if (!c) return 0;
    const uid = await ensureUser(); if (!uid) return 0;
    const { data, error } = await c.from('question_stats').select('subject,name,miss_count,last_seen_at,last_missed_at').eq('user_id', uid);
    if (error || !data) return 0;
    const rows: StatRow[] = data.map((r) => ({
      sub: r.subject as string, name: r.name as string, miss_count: (r.miss_count as number) || 0,
      last_seen_at: r.last_seen_at ? Date.parse(r.last_seen_at as string) : 0,
      last_missed_at: r.last_missed_at ? Date.parse(r.last_missed_at as string) : 0,
    }));
    const n = mergeRemote(rows);
    /* この端末の記録を まだ 送っていなければ 全部 送る（1回だけ） */
    const flag = 'oyako-synced-' + uid;
    if (!store(flag)) {
      const have = new Set(rows.map((r) => r.sub + ':' + r.name));
      let q = loadQ();
      for (const s of allStats()) {
        if (have.has(s.sub + ':' + s.name)) continue;
        q = q.filter((x) => !(x.k === 'stat' && x.row.sub === s.sub && x.row.name === s.name));
        q.push({ k: 'stat', row: s });
      }
      saveQ(q.slice(-QUEUE_MAX));
      store(flag, '1');
      scheduleFlush();
    }
    return n;
  } catch { return 0; }
}

/** 1プレイの点数を 送る（名前が あるときだけ 呼ぶ） */
export function enqueueScore(row: ScoreRow) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  enqueue({ k: 'score', row, id });
}
export function enqueueProfile(nickname: string, level: 1 | 2) { enqueue({ k: 'profile', nickname, level }); }

/** サーバーの 名前を 取りこむ。端末に 無ければ そのまま、あれば サーバーが 正（NGワードで 置きかえられた ときに そろう）。
    送りかけの 名前が キューに 残っているときは 触らない。戻り値は 取りこんで 変わった 名前 */
export async function pullProfile(): Promise<string | null> {
  try {
    const c = getClient(); if (!c) return null;
    const uid = await ensureUser(); if (!uid) return null;
    if (loadQ().some((x) => x.k === 'profile')) return null;
    const { data } = await c.from('profiles').select('nickname').eq('id', uid).maybeSingle();
    const n = data?.nickname as string | undefined;
    if (n && n !== getNick()) { setNickLocal(n); return n; }
    return null;
  } catch { return null; }
}

/** サーバーの NGワードを 取りこむ（Dashboard から 足したものが アプリにも きく） */
export async function pullNgWords(): Promise<number> {
  try {
    const c = getClient(); if (!c) return 0;
    const { data } = await c.from('ng_words').select('word');
    if (!data) return 0;
    const words = data.map((r) => String(r.word)).filter(Boolean);
    setExtraNg(words);
    return words.length;
  } catch { return 0; }
}

let started = false;
/** アプリ起動時に 1回。記録が 変わるたび キューに積み、つながったら 流す */
export function startSync(onPulled?: (n: number) => void, onNick?: (nick: string) => void) {
  if (started) return; started = true;
  onRecordChange((row) => enqueue({ k: 'stat', row }));
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => { void flush(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) void flush(); });
  }
  void (async () => {
    void pullNgWords();
    const n = await pullRecords();
    if (n && onPulled) onPulled(n);
    await flush();                        /* 送りかけの 名前を 先に 届けてから */
    const nick = await pullProfile();     /* サーバーの 名前に そろえる */
    if (nick && onNick) onNick(nick);
  })();
}
