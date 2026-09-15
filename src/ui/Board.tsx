/* 掲示用：全ゲームの 上位を 自動で 切りかえて 表示。新しい点数が 入った瞬間に 動く（Realtime） */
import { useEffect, useRef, useState } from 'react';
import { RANKS } from '../data/texts';
import { CONFIG } from './texts';
import { eventCode } from '../lib/config';
import { getClient } from '../lib/supabase';
import { fetchAll, RANK_MODES, type RankRow } from '../lib/ranking';

const RANKS_T = RANKS as { n: string; c: string }[];
const CYCLE_MS = 8000;
const POLL_MS = 30000;
const LEVELS = [{ lv: 2, label: 'こうがくねん' }, { lv: 1, label: 'ていがくねん' }];

type Key = { mode: string; label: string; lv: number; lvLabel: string };
const ALL_KEYS: Key[] = RANK_MODES.flatMap((m) => LEVELS.map((l) => ({ mode: m.mode, label: m.label, lv: l.lv, lvLabel: l.label })));

export function Board() {
  const ev = eventCode();
  const [tables, setTables] = useState<Record<string, RankRow[]>>({});
  const [i, setI] = useState(0);
  const [toast, setToast] = useState<{ text: string; n: number } | null>(null);
  const [online, setOnline] = useState(true);
  const [tick, setTick] = useState(0);
  const toastN = useRef(0);

  /* 取りなおし */
  const reload = async () => {
    const t = await fetchAll(ev, 5);
    setOnline(Object.keys(t).length > 0 || navigator.onLine);
    setTables(t);
  };
  useEffect(() => { void reload(); const iv = setInterval(() => void reload(), POLL_MS); return () => clearInterval(iv); }, [ev]);  // eslint-disable-line react-hooks/exhaustive-deps

  /* Realtime：scores に 行が 入ったら すぐ 取りなおして、お知らせを 出す */
  useEffect(() => {
    const c = getClient(); if (!c) return;
    const ch = c.channel('board-' + ev)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scores', filter: 'event_code=eq.' + ev }, (payload) => {
        const r = payload.new as { nickname: string; score: number; mode: string; level: number };
        const m = RANK_MODES.find((x) => x.mode === r.mode)?.label || r.mode;
        toastN.current++;
        setToast({ text: `${r.nickname} さんが ${m} で ${r.score}もん！`, n: toastN.current });
        void reload();
        /* その表へ 飛ぶ */
        const k = ALL_KEYS.findIndex((x) => x.mode === r.mode && x.lv === r.level);
        if (k >= 0) { setI(k); setTick((t) => t + 1); }
      })
      .subscribe();
    return () => { void c.removeChannel(ch); };
  }, [ev]);  // eslint-disable-line react-hooks/exhaustive-deps

  /* 自動切りかえ：データの ある表だけを 順に */
  const keys = ALL_KEYS.filter((k) => (tables[k.mode + '-' + k.lv] || []).length > 0);
  useEffect(() => {
    const iv = setInterval(() => setI((x) => x + 1), CYCLE_MS);
    return () => clearInterval(iv);
  }, [tick]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 6000); return () => clearTimeout(t); }, [toast]);

  const cur = keys.length ? keys[((i % keys.length) + keys.length) % keys.length] : null;
  const rows = cur ? tables[cur.mode + '-' + cur.lv] : [];

  return (
    <div className="board">
      <header className="bhead">
        <div className="bbrand"><span className="pin" aria-hidden="true"></span><span>{CONFIG.schoolName}</span></div>
        <h1 className="display">親子ゲーム ランキング</h1>
        <span className="bev">{ev === 'home' ? 'おうち' : ev}</span>
      </header>
      {cur ? (
        <main className="bmain" key={cur.mode + cur.lv + i}>
          <div className="btitle">
            <span className="blv">{cur.lvLabel}</span>
            <h2 className="display">{cur.label}</h2>
          </div>
          <ol className="brows">
            {rows.map((r, k) => {
              const rk = RANKS_T[r.rank_i] || RANKS_T[0];
              return (
                <li key={k} className={'brow top' + (k + 1)}>
                  <span className="bno">{k + 1}</span>
                  <span className="bname">{r.nickname}</span>
                  <span className="bbadge" style={{ background: rk.c }}>{rk.n}級</span>
                  <span className="bscore">{r.score}<small>もん</small>{cur.mode === 'battle' && <em>{r.seconds}秒</em>}</span>
                </li>
              );
            })}
          </ol>
          <div className="bdots" aria-hidden="true">{keys.map((k, n) => <i key={k.mode + k.lv} className={k === cur ? 'on' : ''} style={{ animationDuration: n === keys.indexOf(cur) ? CYCLE_MS + 'ms' : undefined }} />)}</div>
        </main>
      ) : (
        <main className="bmain empty">
          <p className="display">{online ? 'まだ だれも あそんでいません' : 'つながると 出ます'}</p>
          <p>いちばんのりを ねらおう！</p>
        </main>
      )}
      <footer className="bfoot">
        <span>QRコードを 読んで、じぶんの スマホで あそべます</span>
        <span className="burl">ayumu-aa.github.io/oyako-game/</span>
      </footer>
      {toast && <div className="btoast" key={toast.n}>🎉 {toast.text}</div>}
    </div>
  );
}
