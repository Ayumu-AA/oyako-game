/* 出題デッキ。モードと学年から その回に出す問題の並びを作る */
import { PCODE, PREF, FLAG, KOKUGO, RIKA, REKISHI, EIGO, LV1_PREF, LV1_FLAG, HINT2 } from '../data/questions';
import { hasArt } from './art';
import { makePuzzle } from './math10';
import { orderBySeen, missKeys } from './records';
import { pickN } from './util';
import type { DeckItem, Level, Mode, RelayQ, Subject } from './types';

type Row = [string, string, string, string[], string, number, string?];
const HINT2_MAP = HINT2 as Record<string, Record<string, string[]>>;
const SRC: Record<string, Row[]> = { kokugo: KOKUGO as Row[], rika: RIKA as Row[], eigo: EIGO as Row[], rekishi: REKISHI as Row[] };
const LV1_PREF_SET = LV1_PREF as Set<string>;
const LV1_FLAG_SET = LV1_FLAG as Set<string>;

/** 親子ヒントリレー系（pref/flag/kokugo/rika/rekishi/eigo）のデッキ */
export function relayDeck(sub: Subject, lv: Level): RelayQ[] {
  if (sub === 'pref') {
    return orderBySeen('pref', (PREF as Row[]).map((q, i) => [q, PCODE(i) as string] as const)
      .filter((p) => lv === 1 ? LV1_PREF_SET.has(p[0][0]) : !LV1_PREF_SET.has(p[0][0]))
      .map((p) => { const q = p[0]; return { name: q[0], yomi: q[1], tag: q[2] + '地方', hints: q[3].concat(HINT2_MAP.pref[q[0]] || []), fact: q[4], art: null, mk: p[1], sub: 'pref' as const }; }));
  }
  if (sub === 'flag') {
    type FRow = [string, string, string, string, string[], string];
    return orderBySeen('flag', (FLAG as FRow[]).filter((q) => lv === 1 ? LV1_FLAG_SET.has(q[0]) : !LV1_FLAG_SET.has(q[0]))
      .map((q) => ({ name: q[0], yomi: q[1], tag: q[2], hints: q[4].concat(HINT2_MAP.flag[q[0]] || []), fact: q[5], art: { t: 'flag' as const, k: q[3] }, mk: q[3], sub: 'flag' as const })));
  }
  const src = SRC[sub];
  if (!src) return [];
  return orderBySeen(sub, src.filter((q) => {
    if (q[5] !== lv) return false;
    /* 英語モードは 絵が用意できている単語だけ出す（IMAGES に足せば自動で仲間入り） */
    if (sub === 'eigo') return hasArt(q[6]);
    return true;
  }).map((q) => ({ name: q[0], yomi: q[1], tag: q[2], hints: q[3].concat((HINT2_MAP[sub] || {})[q[0]] || []), fact: q[4], art: q[6] ? { t: 'icon' as const, k: q[6] } : null, sub })));
}

/* まちがい直しのデッキを 作るための 問題さがし（学年をまたいで さがす） */
const ITEMCACHE: Record<string, Record<string, RelayQ>> = {};
export function findItem(sub: string, name: string): RelayQ | undefined {
  if (!ITEMCACHE[sub]) {
    const m: Record<string, RelayQ> = {};
    for (const lv of [1, 2] as Level[]) {
      try { relayDeck(sub as Subject, lv).forEach((q) => { if (!m[q.name]) m[q.name] = q; }); } catch { /* 教科が無い */ }
    }
    ITEMCACHE[sub] = m;
  }
  return ITEMCACHE[sub][name];
}

/** まちがえた問題だけを 集める。多くまちがえたものを 先に */
export function missDeck(): RelayQ[] {
  const out: RelayQ[] = [];
  for (const { sub, name } of missKeys()) {
    const it = findItem(sub, name);
    if (it) out.push({ ...it, sub: sub as Subject });
  }
  return out;
}

export function deckFor(mode: Mode, lv: Level): DeckItem[] {
  if (mode === 'miss') return missDeck();
  if (mode === 'math') { const a = []; for (let i = 0; i < 40; i++) a.push(makePuzzle(lv)); return a; }
  if (mode === 'battle' || mode === 'cross' || mode === 'numcross' || mode === 'geopref' || mode === 'geoflag') return [];
  return relayDeck(mode as Subject, lv);
}

/** ヒントのたねは 出題ごとに 3つを 抽選する（同じ問題の再描画では 呼び出し側が結果を保つ） */
export function hints3(q: RelayQ): string[] {
  const pool = q.hints || [];
  return pool.length <= 3 ? pool.slice() : pickN(pool, 3);
}
