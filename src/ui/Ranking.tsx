/* ランキング：名前入力の シート と 一覧の 画面 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { RANKS } from '../data/texts';
import { checkNick, suggestNick, NICK_MAX, getNick, setNickLocal } from '../lib/nickname';
import { enqueueProfile } from '../lib/sync';
import { cachedTable, fetchTable, RANK_MODES, type RankTable } from '../lib/ranking';
import { eventCode } from '../lib/config';
import { CONFIG } from './texts';
import type { Level, Mode } from '../game/types';
import { PickGrid } from './parts';

const RANKS_T = RANKS as { n: string; c: string }[];

/* ===== 名前入力 ===== */
export function NameSheet({ open, level, initial, onDone, onCancel }: { open: boolean; level: Level; initial?: string | null; onDone: (nick: string) => void; onCancel: () => void }) {
  const [v, setV] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const inp = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    setV(initial || getNick() || suggestNick()); setErr(null);
    setTimeout(() => inp.current?.focus(), 50);
  }, [open, initial]);
  const submit = () => {
    const r = checkNick(v);
    if (!r.ok) { setErr(r.reason); return; }
    setNickLocal(r.value); enqueueProfile(r.value, level);
    onDone(r.value);
  };
  return (
    <div className="overlay" id="name-ov" hidden={!open} role="dialog" aria-modal="true" aria-labelledby="name-title" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="sheet namesheet">
        <h2 className="display" id="name-title">ランキングの なまえ</h2>
        <p className="namewarn">ほんとうの なまえは いれないでね</p>
        <div className="namein">
          <input ref={inp} id="nick-input" type="text" value={v} maxLength={NICK_MAX + 2} lang="ja" autoComplete="off" autoCapitalize="off" spellCheck={false}
            placeholder="ひらがな 2〜6もじ" onChange={(e) => { setV(e.target.value); setErr(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
          <button type="button" className="namedice" id="btn-nick-dice" onClick={() => { setV(suggestNick()); setErr(null); }} aria-label="べつの なまえ">🎲</button>
        </div>
        <p className={'namehint' + (err ? ' ng' : '')} id="nick-hint">{err || 'ひらがなだけ。2〜6もじ'}</p>
        <button className="btn btn-ok" id="btn-nick-ok" style={{ fontSize: 18, padding: '15px 18px' }} onClick={submit}>これで！</button>
        <button className="btn btn-ghost" id="btn-nick-cancel" onClick={onCancel}>やめる</button>
      </div>
    </div>
  );
}

/* ===== 一覧 ===== */
function fmtRow(mode: Mode, r: { score: number; seconds: number }) {
  return mode === 'battle' ? `${r.score}もん ／ ${r.seconds}秒` : `${r.score}もん`;
}
export function RankingScreen({ mode0, level0, nick, onBack, onName }: { mode0: Mode; level0: Level; nick: string | null; onBack: () => void; onName: () => void }) {
  const [mode, setMode] = useState<Mode>(mode0);
  const [level, setLevel] = useState<Level>(level0);
  const ev = eventCode();
  const [t, setT] = useState<RankTable | null>(() => cachedTable(ev, mode0, level0));
  const [state, setState] = useState<'loading' | 'ok' | 'offline'>('loading');
  const load = useCallback(async (m: Mode, l: Level) => {
    setState('loading');
    setT(cachedTable(ev, m, l));
    /* つながらない回線で 待たせすぎない：8秒で あきらめて「つながると 出ます」 */
    const r = await Promise.race([fetchTable(ev, m, l), new Promise<null>((res) => setTimeout(() => res(null), 8000))]);
    if (r) { setT(r); setState('ok'); } else setState('offline');
  }, [ev]);
  useEffect(() => { void load(mode, level); }, [mode, level, load]);
  useEffect(() => {
    const on = () => { void load(mode, level); };
    window.addEventListener('online', on);
    return () => window.removeEventListener('online', on);
  }, [mode, level, load]);

  const rows = t?.rows || [];
  const mine = t?.mine || null;
  const inTop = mine ? rows.some((r) => r.user_id && mine.row && r.nickname === mine.row.nickname && r.score === mine.row.score && r.seconds === mine.row.seconds) : false;
  return (
    <section className="screen on" id="s-rank">
      <div className="howhead">
        <div className="howttl">
          <p className="eyebrow">ランキング<span className="lvchip" id="rank-ev">{ev === 'home' ? 'おうち' : ev}</span></p>
          <h2 id="rank-title">{RANK_MODES.find((m) => m.mode === mode)?.label}</h2>
        </div>
        <button type="button" className="rulesbtn" id="btn-rank-name" onClick={onName}>
          <span className="qm" aria-hidden="true">✎</span>{nick ? nick : 'なまえ'}
        </button>
      </div>

      <PickGrid id="seg-rank-mode" label="ゲーム" cols={2} value={mode} onPick={(m) => setMode(m)}
        options={RANK_MODES.map((m) => ({ v: m.mode, b: m.label }))} />
      <PickGrid id="seg-rank-level" label="がくねん" cols={2} value={level} onPick={(l) => setLevel(l)}
        options={[{ v: 1 as Level, b: 'ていがくねん' }, { v: 2 as Level, b: 'こうがくねん' }]} />

      <div className="ranklist" id="rank-list">
        {state === 'offline' && <p className="rankmsg" id="rank-offline">{t ? 'いまは つながっていません。前に見た表です' : 'つながると 出ます'}</p>}
        {state === 'loading' && !t && <p className="rankmsg">よみこみ中…</p>}
        {t && rows.length === 0 && state !== 'loading' && <p className="rankmsg">まだ だれも あそんでいません。いちばんのりを ねらおう！</p>}
        {rows.length > 0 && (
          <ol className="ranktbl">
            {rows.map((r, i) => {
              const me = mine && r.nickname === mine.row.nickname && r.score === mine.row.score && r.seconds === mine.row.seconds && i + 1 === mine.rank;
              const rk = RANKS_T[r.rank_i] || RANKS_T[0];
              return (
                <li key={i} className={'rankrow' + (me ? ' me' : '') + (i < 3 ? ' top' + (i + 1) : '')}>
                  <span className="rno">{i + 1}</span>
                  <span className="rname">{r.nickname}</span>
                  <span className="rbadge" style={{ background: rk.c }}>{rk.n}</span>
                  <span className="rscore">{fmtRow(mode, r)}</span>
                </li>
              );
            })}
            {mine && !inTop && (
              <li className="rankrow me apart" id="rank-mine">
                <span className="rno">{mine.rank}</span>
                <span className="rname">{mine.row.nickname}</span>
                <span className="rbadge" style={{ background: (RANKS_T[mine.row.rank_i] || RANKS_T[0]).c }}>{(RANKS_T[mine.row.rank_i] || RANKS_T[0]).n}</span>
                <span className="rscore">{fmtRow(mode, mine.row)}</span>
              </li>
            )}
          </ol>
        )}
        {t && t.total > 0 && <p className="ranknote">{t.total}回 あそばれました</p>}
      </div>
      <p className="rm-brand">{CONFIG.schoolName}</p>
      <div className="spacer"></div>
      <button className="btn btn-ghost" id="btn-rank-back" onClick={onBack}>もどる</button>
    </section>
  );
}
