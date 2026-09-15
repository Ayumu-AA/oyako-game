/* ちずクイズ（地図で 色のついた所を 4たくで 答える） */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { capOf, geoDeck, geoFitVB, geoFullVB, geoNameOf, geoQuestion, jpSVG, wSVG, viewClamp, viewChanged, viewTransform, viewZero, type GeoKind, type GeoQ, type VB, type View } from '../game/geo';
import { markHit, markMiss, subjOf } from '../game/records';
import type { Level, Mode } from '../game/types';
import { celebrate, fxClear, streakReset } from '../lib/fx';
import { sndNG, buzz } from '../lib/sound';
import { Hud, PauseOverlay, usePauseKeys } from './parts';
import type { PlayResult } from './state';

export interface GeoProps {
  mode: Mode; level: Level; seconds: number;
  onFinish: (r: Omit<PlayResult, 'newBest'>) => void;
  onRestart: () => void; onQuit: () => void;
}

export function GeoScreen({ mode, level, seconds, onFinish, onRestart, onQuit }: GeoProps) {
  const kind: GeoKind = mode === 'geoflag' ? 'world' : 'jp';
  const deck = useRef<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [q, setQ] = useState<GeoQ | null>(null);
  const [locked, setLocked] = useState(false);
  const [pick, setPick] = useState<string | null>(null);   // 押した答え（null = パス）
  const [score, setScore] = useState(0);
  const got = useRef<string[]>([]);
  const [left, setLeft] = useState(seconds * 1000);
  const [paused, setPaused] = useState(false);
  const endAt = useRef(0), remain = useRef(0), timer = useRef<number | null>(null);
  const finished = useRef(false);
  const onFinishRef = useRef(onFinish); onFinishRef.current = onFinish;
  const mapEl = useRef<HTMLDivElement>(null);
  const view = useRef<View>(viewZero());
  const vbFit = useRef<VB | null>(null);
  const [viewOn, setViewOn] = useState(false);
  const fxLayer = useRef<HTMLDivElement>(null), fxStamp = useRef<HTMLDivElement>(null), fxMain = useRef<HTMLElement>(null), fxSub = useRef<HTMLElement>(null);
  const chip = useRef<HTMLDivElement>(null);
  const nextTimer = useRef<number | null>(null);
  const [bar, setBar] = useState<{ cls: string; text: string }>({ cls: '', text: '下の 4つから えらんでね' });

  const stopTimer = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  const finish = useCallback(() => {
    if (finished.current) return; finished.current = true;
    stopTimer(); if (nextTimer.current) clearTimeout(nextTimer.current);
    fxClear({ layer: fxLayer.current, stamp: fxStamp.current }); streakReset();
    onFinishRef.current({ mode, score: got.current.length, seconds, got: [], geoKind: kind, geoGot: got.current.slice() });
  }, [mode, seconds, kind]);
  const tick = useCallback(() => {
    const l = Math.max(0, endAt.current - Date.now());
    setLeft(l);
    if (l <= 0) finish();
  }, [finish]);
  const startTimer = useCallback((ms: number) => { endAt.current = Date.now() + ms; tick(); timer.current = window.setInterval(tick, 100); }, [tick]);

  useEffect(() => {
    deck.current = geoDeck(kind, level); got.current = []; finished.current = false; streakReset();
    setIdx(0);
    startTimer(seconds * 1000);
    return () => { stopTimer(); if (nextTimer.current) clearTimeout(nextTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 出題 */
  useEffect(() => {
    const d = deck.current; if (!d.length) return;
    const k = d[idx % d.length];
    setQ(geoQuestion(kind, level, k));
    setLocked(false); setPick(null);
    view.current = viewZero(); setViewOn(false);
    setBar({ cls: '', text: '下の 4つから えらんでね' });
  }, [idx, kind, level]);

  /* 地図を描く（問題・こたえ合わせ・リサイズ で） */
  const draw = useCallback(() => {
    const el = mapEl.current; if (!el || !q) return;
    const r = el.getBoundingClientRect();
    const base: VB = q.vb ? q.vb : geoFullVB(kind);
    const fit = geoFitVB(kind, base, r.width, r.height, q.vb ? q.ans : null);
    vbFit.current = fit;
    const marks = { [q.ans]: 'hit' as const };
    const ring = locked ? null : q.ans;      /* こたえ合わせの前だけ 目じるしを出す */
    const capsOn = locked && kind === 'jp';
    el.innerHTML = kind === 'world' ? wSVG(marks, fit, { zoom: view.current.k, ring })
      : jpSVG(marks, fit, { caps: capsOn ? 'all' : null, capLab: capsOn ? [q.ans] : [], zoom: view.current.k, ring });
    const svg = el.querySelector('svg');
    if (svg && q.scope && q.scope.length) {
      svg.querySelectorAll<SVGElement>('[data-k]').forEach((p) => { if (q.scope!.indexOf(p.dataset.k || '') < 0) p.classList.add('off'); });
    }
    applyView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, locked, kind]);
  const applyView = () => {
    const el = mapEl.current; const b = vbFit.current; if (!el || !b) return;
    const grp = el.querySelector('.mapg'); if (!grp) return;
    grp.setAttribute('transform', viewTransform(view.current, b));
    setViewOn(viewChanged(view.current));
  };
  useLayoutEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draw]);

  /* 地図の 指の操作：1本指 … 動かす／2本指 … 拡大・縮小・回転 */
  useEffect(() => {
    const el = mapEl.current; if (!el) return;
    const PTR = new Map<number, { x: number; y: number }>();
    let gest: { n: number; d0: number; r0: number; cx: number; cy: number; k0: number; deg0: number; tx0: number; ty0: number } | null = null;
    const two = () => { const a = [...PTR.values()]; return { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2, d: Math.hypot(a[1].x - a[0].x, a[1].y - a[0].y), r: Math.atan2(a[1].y - a[0].y, a[1].x - a[0].x) }; };
    const one = () => { const a = [...PTR.values()][0]; return { x: a.x, y: a.y, d: 1, r: 0 }; };
    const px2map = () => {
      const svg = el.querySelector('svg'); const b = vbFit.current; if (!svg || !b) return 1;
      const rect = svg.getBoundingClientRect();
      return 1 / Math.min(rect.width / b[2], rect.height / b[3]);
    };
    const start = () => { const c = PTR.size >= 2 ? two() : one(); const v = view.current; gest = { n: PTR.size, d0: c.d, r0: c.r, cx: c.x, cy: c.y, k0: v.k, deg0: v.deg, tx0: v.tx, ty0: v.ty }; };
    const down = (e: PointerEvent) => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch { /* 無視 */ } PTR.set(e.pointerId, { x: e.clientX, y: e.clientY }); start(); };
    const move = (e: PointerEvent) => {
      if (!PTR.has(e.pointerId) || !gest) return;
      PTR.set(e.pointerId, { x: e.clientX, y: e.clientY });
      e.preventDefault();
      const u = px2map(); const v = { ...view.current };
      if (PTR.size >= 2 && gest.n >= 2) {
        const c = two();
        v.k = gest.k0 * (c.d / Math.max(1, gest.d0));
        v.deg = gest.deg0 + (c.r - gest.r0) * 180 / Math.PI;
        v.tx = gest.tx0 + (c.x - gest.cx) * u; v.ty = gest.ty0 + (c.y - gest.cy) * u;
      } else if (PTR.size === 1 && gest.n === 1) {
        const c = one();
        v.tx = gest.tx0 + (c.x - gest.cx) * u; v.ty = gest.ty0 + (c.y - gest.cy) * u;
      } else return;
      view.current = viewClamp(v, vbFit.current || geoFullVB(kind)); applyView();
    };
    const up = (e: PointerEvent) => { PTR.delete(e.pointerId); if (PTR.size === 0) gest = null; else start(); };
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
  }, [kind]);

  const pause = useCallback(() => { if (paused || !timer.current) return; setPaused(true); remain.current = Math.max(0, endAt.current - Date.now()); stopTimer(); }, [paused]);
  const resume = useCallback(() => { if (!paused) return; setPaused(false); startTimer(remain.current); }, [paused, startTimer]);
  usePauseKeys(paused, pause, resume);
  const pausedRef = useRef(paused); pausedRef.current = paused;

  const scheduleNext = () => {
    nextTimer.current = window.setTimeout(() => {
      if (finished.current || pausedRef.current) return;
      setIdx((i) => i + 1);
    }, 1600);
  };
  const answer = (p: string) => {
    if (!q || locked) return;
    setLocked(true); setPick(p);
    const ok = p === q.ans;
    if (ok) {
      got.current.push(q.ans); setScore(got.current.length);
      markHit(subjOf(mode), geoNameOf(kind, q.ans));
      celebrate({ layer: fxLayer.current, stamp: fxStamp.current, main: fxMain.current, sub: fxSub.current }, null, chip.current, false);
    } else {
      markMiss(subjOf(mode), geoNameOf(kind, q.ans));
      streakReset(); sndNG(); buzz(60);
    }
    const cap = kind === 'world' ? null : capOf(q.ans);
    setBar({ cls: ok ? 'ok' : 'ng', text: (ok ? 'せいかい！　' : 'ざんねん。こたえは ') + geoNameOf(kind, q.ans) + (cap ? '（県庁所在地は ' + cap[2] + '）' : '') });
    scheduleNext();
  };
  const pass = () => {
    if (!q || locked) return;
    setLocked(true); setPick(null); streakReset();
    markMiss(subjOf(mode), geoNameOf(kind, q.ans));
    const cc = kind === 'world' ? null : capOf(q.ans);
    setBar({ cls: 'ng', text: 'こたえは ' + geoNameOf(kind, q.ans) + (cc ? '（県庁所在地は ' + cc[2] + '）' : '') });
    scheduleNext();
  };

  const ratio = left / (seconds * 1000);
  return (
    <section className="screen on" id="s-geo">
      <Hud fillId="geo-fill" timeId="geo-time" scoreId="geo-score" ratio={ratio} warn={left <= 10000} timeText={Math.ceil(left / 1000)} score={score} onPause={pause} pauseId="btn-gpause" chipRef={chip} />

      <div className="geoq">
        <p className="geoq-sub" id="geo-sub">{q?.sub}</p>
        <p className="geoq-name display" id="geo-name"></p>
      </div>

      <div className="fx" id="fx2" aria-hidden="true" ref={fxLayer}>
        <div className="fxstamp" id="fx2-stamp" ref={fxStamp}><b id="fx2-main" ref={fxMain}>せいかい！</b><span id="fx2-sub" ref={fxSub}></span></div>
      </div>

      <div className="geowrap">
        <div className="geomap" id="geo-map" ref={mapEl}></div>
        <button type="button" className="greset" id="btn-greset" hidden={!viewOn} onClick={() => { view.current = viewZero(); applyView(); }}>もとに もどす</button>
      </div>

      <div className={'geobar' + (bar.cls ? ' ' + bar.cls : '')} id="geo-bar"><span id="geo-bartext">{bar.text}</span></div>

      <div className="gchoices" id="geo-choices">
        {q && q.opts.map((o) => (
          <button type="button" key={o} className={'gchoice' + (locked && o === q.ans ? ' right' : '') + (locked && pick === o && o !== q.ans ? ' wrong' : '')} data-k={o} disabled={locked} onClick={() => answer(o)}>{geoNameOf(kind, o)}</button>
        ))}
      </div>

      <div className="playbtns">
        <button className="btn btn-ghost" id="btn-gpass" onClick={pass}>わからない（パス）</button>
      </div>

      <PauseOverlay open={paused} info={'のこり ' + Math.ceil(remain.current / 1000) + '秒 ／ いま ' + score + 'もん'} onResume={resume} onRestart={() => { setPaused(false); stopTimer(); onRestart(); }} onQuit={() => { setPaused(false); stopTimer(); onQuit(); }} />
    </section>
  );
}
