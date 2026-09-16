/* ランキングの 取得。ゲーム×学年×イベント ごとの 上位10 と 自分の 順位。
   つながらないときは 最後に 取れた表を 出す（localStorage）。

   読むのは scores では なく best_scores（supabase/003_best_scores.sql）。
   scores は 1プレイ1行なので、そのまま 並べると 同じ人が 何度も 遊んだぶん 枠を 取ってしまい、
   自分の順位も「自分より上の【行】の数＋1」に なって 実際より 下に 見える。
   best_scores は 人ごとの ベスト 1行だけ。送るのは これまでどおり scores（insert 専用）。 */
import { store } from './storage';
import { ensureUser, getClient } from './supabase';
import type { Level, Mode } from '../game/types';

export interface RankRow { nickname: string; score: number; seconds: number; rank_i: number; played_at: string; user_id?: string }
export interface RankTable {
  rows: RankRow[];                                  // 上位10（1人1行）
  mine: { rank: number; row: RankRow } | null;      // 自分の ベストと 順位
  total: number;                                    // このゲーム×学年で あそんだ【人】の数（プレイ回数ではない）
  fetchedAt: number;
}

export const RANK_MODES: { mode: Mode; label: string }[] = [
  { mode: 'pref', label: '都道府県' }, { mode: 'flag', label: '世界の国旗' }, { mode: 'kokugo', label: 'ことば' },
  { mode: 'rika', label: 'りか' }, { mode: 'rekishi', label: 'れきし' }, { mode: 'eigo', label: 'えいご' },
  { mode: 'geopref', label: 'ちずクイズ 都道府県' }, { mode: 'geoflag', label: 'ちずクイズ 世界' },
  { mode: 'math', label: '10を作る' }, { mode: 'battle', label: 'はやおし親子バトル' },
];
/** ランキングに 出るモードか（クロスワード系は 時間制で 別ものなので 出さない） */
export function rankable(mode: Mode): boolean { return RANK_MODES.some((m) => m.mode === mode); }

const cacheKey = (ev: string, mode: string, lv: number) => 'oyako-rank-' + ev + '-' + mode + '-' + lv;
export function cachedTable(ev: string, mode: Mode, lv: Level): RankTable | null {
  try { return JSON.parse(store(cacheKey(ev, mode, lv)) || 'null'); } catch { return null; }
}

export const RANK_TABLE = 'best_scores';   /* 人ごとの ベスト 1行だけの view */

/** 上位10 と 自分の順位。自分の順位は「自分のベストより 上の【人】の数 + 1」 */
export async function fetchTable(ev: string, mode: Mode, lv: Level): Promise<RankTable | null> {
  const c = getClient(); if (!c) return null;
  try {
    const { data, error } = await c.from(RANK_TABLE)
      .select('nickname,score,seconds,rank_i,played_at,user_id')
      .eq('event_code', ev).eq('mode', mode).eq('level', lv)
      .order('score', { ascending: false }).order('seconds', { ascending: true }).order('played_at', { ascending: true })
      .limit(10);
    if (error || !data) return null;
    const rows = data as RankRow[];
    const { count } = await c.from(RANK_TABLE).select('id', { count: 'exact', head: true }).eq('event_code', ev).eq('mode', mode).eq('level', lv);
    const uid = await ensureUser();
    let mine: RankTable['mine'] = null;
    if (uid) {
      const { data: my } = await c.from(RANK_TABLE).select('nickname,score,seconds,rank_i,played_at')
        .eq('event_code', ev).eq('mode', mode).eq('level', lv).eq('user_id', uid)
        .order('score', { ascending: false }).order('seconds', { ascending: true }).limit(1);
      const best = my && my[0] as RankRow | undefined;
      if (best) {
        const { count: better } = await c.from(RANK_TABLE).select('id', { count: 'exact', head: true })
          .eq('event_code', ev).eq('mode', mode).eq('level', lv)
          .or(`score.gt.${best.score},and(score.eq.${best.score},seconds.lt.${best.seconds})`);
        mine = { rank: (better || 0) + 1, row: best };
      }
    }
    const t: RankTable = { rows, mine, total: count || rows.length, fetchedAt: Date.now() };
    try { store(cacheKey(ev, mode, lv), JSON.stringify(t)); } catch { /* 容量 */ }
    return t;
  } catch { return null; }
}

/** そのイベントで つかわれている 名前を 取ってくる（名前を 決めるとき かぶりを 教えるため）。
    1クエリ・名前だけ。取れなければ 空（＝かぶり判定なしで 素どおり） */
export async function fetchNames(ev: string, limit = 600): Promise<string[]> {
  const c = getClient(); if (!c) return [];
  try {
    const { data } = await c.from(RANK_TABLE).select('nickname').eq('event_code', ev).limit(limit);
    return [...new Set((data || []).map((r) => String((r as { nickname: string }).nickname)).filter(Boolean))];
  } catch { return []; }
}

/** 掲示用：全モード・両学年を まとめて 取る（こちらも 人ごとの ベストだけ） */
export async function fetchAll(ev: string, limit = 5): Promise<Record<string, RankRow[]>> {
  const c = getClient(); const out: Record<string, RankRow[]> = {};
  if (!c) return out;
  try {
    const { data } = await c.from(RANK_TABLE).select('mode,level,nickname,score,seconds,rank_i,played_at')
      .eq('event_code', ev).order('score', { ascending: false }).order('seconds', { ascending: true }).limit(2000);
    for (const r of (data || []) as (RankRow & { mode: string; level: number })[]) {
      const k = r.mode + '-' + r.level;
      (out[k] ||= []);
      if (out[k].length < limit) out[k].push(r);
    }
  } catch { /* 表示側で 空を 扱う */ }
  return out;
}
