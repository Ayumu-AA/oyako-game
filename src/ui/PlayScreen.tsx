/* 親子ヒントリレー・まちがい直し・10を作る の プレイ画面 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deckFor, hints3 } from '../game/decks';
import { checkMath, type Token } from '../game/math10';
import { furi, nameHTML } from '../game/furigana';
import { artHTML, preloadArt } from '../game/art';
import { markSeen, markHit, markMiss } from '../game/records';
import { capOf, capSameName, jpSVG, wSVG } from '../game/geo';
import { isMathQ, type DeckItem, type Level, type MathQ, type Mode, type RelayQ } from '../game/types';
import { celebrate, fxClear, streakReset, type StreakWord } from '../lib/fx';
import { sndNG, buzz } from '../lib/sound';
import { Hud, PauseOverlay, Raw, usePauseKeys } from './parts';
import type { PlayResult } from './state';

export interface PlayProps {
  mode: Mode; level: Level; seconds: number; role: 'child' | 'adult';
  onFinish: (r: Omit<PlayResult, 'newBest'>) => void;
  onRestart: () => void; onQuit: () => void; onEmpty: () => void;
}

function mapHasQ(q: DeckItem | undefined): q is RelayQ { return !!(q && !isMathQ(q) && q.mk && (q.sub === 'pref' || q.sub === 'flag')); }

export function PlayScreen({ mode, level, seconds, role, onFinish, onRestart, onQuit, onEmpty }: PlayProps) {
  const isMath = mode === 'math';
  const deck = useMemo(() => deckFor(mode, level), [mode, level]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const got = useRef<DeckItem[]>([]);
  const [left, setLeft] = useState(seconds * 1000);
  const [paused, setPaused] = useState(false);
  const endAt = useRef(0), remain = useRef(0), timer = useRef<number | null>(null);
  const finished = useRef(false);
  const onFinishRef = useRef(onFinish); onFinishRef.current = onFinish;
  const [h3, setH3] = useState<{ k: number; v: string[] }>({ k: -1, v: [] });
  /* 10を作る */
  const [tokens, setTokens] = useState<Token[]>([]);
  const [locked, setLocked] = useState(false);
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null);
  const [sol, setSol] = useState(false);
  /* 演出 */
  const fxLayer = useRef<HTMLDivElement>(null), fxStamp = useRef<HTMLDivElement>(null), fxMain = useRef<HTMLElement>(null), fxSub = useRef<HTMLElement>(null);
  const okBtn = useRef<HTMLButtonElement>(null), chip = useRef<HTMLDivElement>(null), card = useRef<HTMLDivElement>(null);
  const [flash, setFlash] = useState<{ q: RelayQ; w: StreakWord | null } | null>(null);
  const flashTimer = useRef<number | null>(null);
  const [anim, setAnim] = useState(0);

  const q = deck[idx % Math.max(1, deck.length)];

  useEffect(() => { if (mode === 'miss' && !deck.length) onEmpty(); }, [mode, deck, onEmpty]);
  useEffect(() => { preloadArt(deck.map((q) => (isMathQ(q) ? null : q.art))); }, [deck]);

  const stopTimer = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  const finish = useCallback(() => {
    if (finished.current) return; finished.current = true;
    stopTimer(); fxClear({ layer: fxLayer.current, stamp: fxStamp.current }); streakReset();
    const g = got.current;
    const first = deck[0];
    onFinishRef.current({
      mode, score: g.length, seconds,
      got: g.map((x) => isMathQ(x) ? { name: x.nums.join(' '), fact: '', nums: x.nums } : { name: x.name, fact: x.fact, mk: x.mk }),
      firstName: first && !isMathQ(first) ? first.name : undefined, firstFact: first && !isMathQ(first) ? first.fact : undefined,
    });
  }, [deck, mode, seconds]);
  const tick = useCallback(() => {
    const l = Math.max(0, endAt.current - Date.now());
    setLeft(l);
    if (l <= 0) finish();
  }, [finish]);
  const startTimer = useCallback((ms: number) => {
    endAt.current = Date.now() + ms; tick();
    timer.current = window.setInterval(tick, 100);
  }, [tick]);

  /* 開始 */
  useEffect(() => {
    finished.current = false; got.current = []; streakReset();
    startTimer(seconds * 1000);
    return () => { stopTimer(); if (flashTimer.current) clearTimeout(flashTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 問題が変わったとき（v1 の render） */
  useEffect(() => {
    if (!q) return;
    setAnim((a) => a + 1);
    if (isMathQ(q)) { setTokens([]); setLocked(false); setVerdict(null); setSol(false); return; }
    setH3({ k: idx, v: hints3(q) });
    markSeen(q.sub || mode, q.name);
  }, [q, idx, mode]);

  const pause = useCallback(() => {
    if (paused || !timer.current) return;
    setPaused(true);
    remain.current = Math.max(0, endAt.current - Date.now());
    stopTimer();
  }, [paused]);
  const resume = useCallback(() => {
    if (!paused) return;
    setPaused(false);
    startTimer(remain.current);
  }, [paused, startTimer]);
  usePauseKeys(paused, pause, resume);

  const next = () => { hideFlash(); setIdx((i) => i + 1); };
  const hideFlash = () => { if (flashTimer.current) clearTimeout(flashTimer.current); setFlash(null); };

  const onOk = () => {
    if (isMathQ(q)) { doCheckMath(q); return; }
    got.current.push(q); setScore(got.current.length);
    markHit(q.sub || mode, q.name);
    const hasMap = mapHasQ(q);
    const w = celebrate({ layer: fxLayer.current, stamp: fxStamp.current, main: fxMain.current, sub: fxSub.current }, okBtn.current, chip.current, !hasMap);
    if (hasMap) {   /* 正解した場所を0.9秒だけ地図で見せる */
      if (flashTimer.current) clearTimeout(flashTimer.current);
      setFlash({ q, w });
      flashTimer.current = window.setTimeout(() => setFlash(null), 900);
    }
    setIdx((i) => i + 1);
  };
  const onPass = () => {
    hideFlash(); streakReset();
    if (!isMathQ(q)) markMiss(q.sub || mode, q.name);
    next();
  };
  const doCheckMath = (mq: MathQ) => {
    if (locked) return;
    const v = checkMath(mq, tokens);
    setVerdict(v);
    if (v.ok) {
      setLocked(true);
      got.current.push(mq); setScore(got.current.length);
      celebrate({ layer: fxLayer.current, stamp: fxStamp.current, main: fxMain.current, sub: fxSub.current }, okBtn.current, chip.current);
      const myIdx = idx;
      setTimeout(() => { if (!finished.current) setIdx((i) => (i === myIdx ? i + 1 : i)); }, 1200);
    } else if (v.kind === 'wrong') { streakReset(); sndNG(); buzz(60); }
  };
  const pushToken = (t: Token) => { if (locked) return; setTokens((x) => x.concat([t])); setVerdict(null); };

  const ratio = left / (seconds * 1000);
  const warn = left <= 10000;
  const pauseInfo = 'のこり ' + Math.ceil(remain.current / 1000) + '秒 ／ いま ' + score + 'もん';

  if (!q) return <section className="screen on" id="s-play" />;

  const mq = isMathQ(q) ? q : null;
  const rq = !isMathQ(q) ? q : null;
  const cardCls = 'card ' + (isMath ? 'pop' : 'slide') + (paused && !isMath ? ' hidden-answer' : '') + (flash ? ' veil' : '');

  return (
    <section className="screen on" id="s-play">
      <Hud fillId="timer-fill" timeId="timer-text" scoreId="score" ratio={ratio} warn={warn} timeText={Math.ceil(left / 1000)} score={score} onPause={pause} pauseId="btn-pause" chipRef={chip} />
      <p className="peek" id="peek-note" hidden={isMath}>画面を{role === 'child' ? 'おとな' : 'こども'}に見せないでね</p>

      <div className={cardCls} id="card" ref={card} key={anim}>
        <span className="regionchip" id="region">{mq ? (level === 1 ? '3つの数字' : '4つの数字') : rq!.tag}</span>
        {rq && rq.art ? <Raw as="div" className="flagbox" id="flagbox" html={artHTML(rq.art)} /> : <div className="flagbox" id="flagbox" hidden></div>}
        {mq && (
          <div id="mathpad">
            <p className="goal">ぜんぶ使って <b>10</b> を作ろう</p>
            <div className={'mexpr' + (tokens.length ? '' : ' empty')} id="mexpr">{tokens.length ? tokens.map((x) => x.v).join(' ') : '数字と記号をタップして 式を作ろう'}</div>
            <div className="numtiles" id="numtiles">
              {mq.nums.map((n, i) => (
                <button type="button" key={i} data-i={i} className={tokens.some((x) => x.t === 'n' && x.i === i) ? 'used' : ''} onClick={() => pushToken({ t: 'n', i, v: n })}>{n}</button>
              ))}
            </div>
            <div className="ops" id="ops">
              {((level === 1) ? ['＋', '−'] : ['＋', '−', '×', '÷', '(', ')']).map((o) => (
                <button type="button" key={o} data-op={o} onClick={() => pushToken((o === '(' || o === ')') ? { t: 'p', v: o } : { t: 'o', v: o as '＋' })}>{o}</button>
              ))}
            </div>
            <div className="edit">
              <button type="button" id="btn-undo" onClick={() => { if (locked) return; setTokens((x) => x.slice(0, -1)); setVerdict(null); }}>1つもどす</button>
              <button type="button" id="btn-clear" onClick={() => { setTokens([]); setLocked(false); setVerdict(null); }}>ぜんぶけす</button>
            </div>
            <p className={'verdict ' + (verdict ? (verdict.ok ? 'ok' : 'ng') : '')} id="verdict" hidden={!verdict}>{verdict?.text}</p>
          </div>
        )}
        {rq ? <Raw as="div" className="answer display" id="answer" html={nameHTML(rq.name, rq.yomi)} /> : <div className="answer display" id="answer"></div>}
        <p className="reading" id="reading" hidden={!(rq && (rq.sub || mode) === 'eigo')}>{rq?.yomi}</p>
        <div id="hintblock" hidden={!!mq}>
          <p className="hintlabel">ヒントのたね</p>
          {/* ヒントは スマホを持つ人（ふつうは こども）が 声に出して 読む。
              低学年でも 読めるように ルビを つける（データに 漢字{よみ} が 入っている） */}
          <ul className="hints" id="hints">{rq && h3.k === idx && h3.v.map((h, i) => <li key={i} dangerouslySetInnerHTML={{ __html: furi(h) }} />)}</ul>
        </div>
        <p className="solution" id="solution" hidden={!sol}>{mq && sol ? 'れい：' + mq.sol : ''}</p>
      </div>

      <div className="fx" id="fx" aria-hidden="true" ref={fxLayer}>
        <div className="fxstamp" id="fx-stamp" ref={fxStamp}><b id="fx-main" ref={fxMain}>せいかい！</b><span id="fx-sub" ref={fxSub}></span></div>
      </div>

      <MapFlash flash={flash} />

      <div className="playbtns">
        <button className="btn btn-ok" id="btn-ok" ref={okBtn} onClick={onOk}>{isMath ? 'できた！' : 'せいかい！'}</button>
        <button className="btn btn-ghost" id="btn-hint" hidden={!isMath} onClick={() => { if (!sol) setSol(true); else next(); }}>{sol ? 'つぎへ' : 'こたえを見る'}</button>
        <button className="btn btn-ghost" id="btn-pass" onClick={onPass}>パス</button>
      </div>

      <PauseOverlay open={paused} info={pauseInfo} onResume={resume} onRestart={() => { setPaused(false); stopTimer(); onRestart(); }} onQuit={() => { setPaused(false); stopTimer(); onQuit(); }} />
    </section>
  );
}

/* A-1：せいかいの瞬間、0.9秒だけ地図を出す（タップはさえぎらない） */
function MapFlash({ flash }: { flash: { q: RelayQ; w: StreakWord | null } | null }) {
  const q = flash?.q, w = flash?.w;
  const world = q?.sub === 'flag';
  const cap = q && q.sub === 'pref' && q.mk ? capOf(q.mk) : null;
  const marks = q && q.mk ? { [q.mk]: 'hit' as const } : {};
  const svg = q ? (world ? wSVG(marks) : jpSVG(marks, null, { caps: [q.mk!], capLab: [q.mk!] })) : '';
  return (
    <div className={'mapflash' + (world ? ' world' : '') + (flash ? ' on' : '')} id="mapflash" aria-hidden="true">
      <p className={'mf-badge' + (w && w.tone ? ' ' + w.tone : '')} id="mf-badge">{w ? (w.sub ? w.main + '　' + w.sub : w.main) : 'せいかい！'}</p>
      <p className="mf-name" id="mf-name">{q?.name}</p>
      <p className={'mf-cap' + (cap && q && !capSameName(q.mk!) ? ' diff' : '')} id="mf-cap" hidden={!cap}>{cap ? '県庁所在地　' + cap[2] : ''}</p>
      <Raw as="div" className="mf-box" id="mf-box" html={svg} />
    </div>
  );
}
