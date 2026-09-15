/* はやおし親子バトル */
import { useCallback, useEffect, useRef, useState } from 'react';
import { BattleSession, BATTLE_CAP, NUMKEYS } from '../game/battle';
import { furi, furiName } from '../game/furigana';
import { artHTML } from '../game/art';
import { rankOf, rankNext, rankLine } from '../game/rank';
import type { BattleQ, Level, Side } from '../game/types';
import type { BattleSubj } from '../game/battle';
import { Hee, PauseButton, PauseOverlay, Promo, Raw, usePauseKeys, useResultLock } from './parts';
import type { BattleResult } from './state';

export interface BattleProps {
  level: Level; seconds: number; bsubj: BattleSubj; handi: number; goal: number;
  onFinish: (r: BattleResult) => void; onRestart: () => void; onQuit: () => void;
}

type SideUI = { opts: string[]; flash: boolean; locked: boolean; waiting: boolean; input: string };
const sideZero = (): SideUI => ({ opts: [], flash: false, locked: false, waiting: false, input: '' });

export function BattleScreen({ level, seconds, bsubj, handi, goal, onFinish, onRestart, onQuit }: BattleProps) {
  const sess = useRef<BattleSession | null>(null);
  const [q, setQ] = useState<BattleQ | null>(null);
  const [ui, setUi] = useState<Record<Side, SideUI>>({ adult: sideZero(), child: sideZero() });
  const [score, setScore] = useState({ adult: '0', child: '0' });
  const [left, setLeft] = useState(seconds * 1000);
  const [paused, setPaused] = useState(false);
  const [fin, setFin] = useState(false);
  const endAt = useRef(0), remain = useRef(0), timer = useRef<number | null>(null), t0 = useRef(0);
  const capSec = goal ? BATTLE_CAP : seconds;
  const finished = useRef(false);
  const timers = useRef<number[]>([]);
  const root = useRef<HTMLElement>(null);
  const onFinishRef = useRef(onFinish); onFinishRef.current = onFinish;
  const pausedRef = useRef(paused); pausedRef.current = paused;
  const later = (fn: () => void, ms: number) => { const id = window.setTimeout(fn, ms); timers.current.push(id); };

  const stopTimer = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } };
  const setSide = (side: Side, p: Partial<SideUI>) => setUi((u) => ({ ...u, [side]: { ...u[side], ...p } }));
  const drawScore = (s: BattleSession) => setScore({ adult: s.scoreText('adult'), child: s.scoreText('child') });

  /* バトルは 時間切れの瞬間に 全画面の「しゅうりょう！」で タップを受けとめてから結果へ */
  const battleFinish = useCallback(() => {
    if (finished.current) return; finished.current = true;
    const s = sess.current!;
    s.done = true;
    stopTimer();
    setSide('adult', { waiting: false });
    setFin(true);
    later(() => {
      setFin(false);
      const sec = goal ? Math.max(1, Math.round((Date.now() - (t0.current || Date.now())) / 1000)) : seconds;
      onFinishRef.current({ adult: s.score.adult, child: s.score.child, goal, seconds: sec, last: s.last ? { answer: s.last.answer, fact: s.last.fact || '' } : null });
    }, 1400);
  }, [goal, seconds]);

  const tick = useCallback(() => {
    const l = Math.max(0, endAt.current - Date.now());
    setLeft(l);
    if (l <= 0) { stopTimer(); battleFinish(); }
  }, [battleFinish]);
  const startTimer = useCallback((ms: number) => { endAt.current = Date.now() + ms; tick(); timer.current = window.setInterval(tick, 100); }, [tick]);

  const nextBattle = useCallback(() => {
    const s = sess.current!;
    const { q, opts, wait } = s.next();
    setQ(q);
    setUi({
      adult: { opts: opts.adult, flash: false, locked: false, waiting: wait > 0, input: '' },
      child: { opts: opts.child, flash: false, locked: false, waiting: false, input: '' },
    });
    /* けいさんは 選たく肢が ないので、ハンデは「おとなだけ しばらく テンキーを 押せない」にする */
    if (wait > 0) later(() => setSide('adult', { waiting: false }), wait);
  }, []);

  useEffect(() => {
    const s = new BattleSession({ level, bsubj, handi, goal });
    sess.current = s; finished.current = false;
    drawScore(s);
    nextBattle();
    t0.current = Date.now();
    startTimer(capSec * 1000);
    const tm = timers.current;
    return () => { stopTimer(); tm.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uiRef = useRef(ui); uiRef.current = ui;
  const battleCorrect = (side: Side) => {
    const s = sess.current!;
    const reached = s.correct(side);
    drawScore(s);
    setSide(side, { flash: true });
    if (reached) { stopTimer(); later(battleFinish, 420); return; }   /* 〇もん先取モードは とどいた時点で おわり */
    later(() => { if (!finished.current) nextBattle(); }, 420);
  };
  const battleWrong = (side: Side) => {
    const s = sess.current!;
    s.wrong(side);
    setSide(side, { locked: true, input: '' });
    later(() => setSide(side, { locked: false }), 1500);
  };
  const onChoice = (side: Side, a: string) => {
    const s = sess.current; if (!s || s.done || pausedRef.current || !s.q) return;
    if (uiRef.current[side].locked) return;
    if (a === s.q.answer) battleCorrect(side); else battleWrong(side);
  };

  /* テンキーは pointerdown で受ける。click だと 端末によって タッチ1回で 2回 発火することがある */
  useEffect(() => {
    const el = root.current; if (!el) return;
    let lastKeyAt = 0, lastKeyEl: Element | null = null;
    const onNumKey = (e: Event) => {
      const t = e.target as HTMLElement;
      const k = t.closest ? (t.closest('.numkey') as HTMLElement | null) : null;
      if (!k) return;
      if (e.cancelable) e.preventDefault();
      const now = (e.timeStamp || Date.now());
      if (k === lastKeyEl && now - lastKeyAt < 60) return;   /* 保険：同じキーの 60ミリ秒いないの 二重入力は 捨てる */
      lastKeyAt = now; lastKeyEl = k;
      const sideEl = k.closest('.side') as HTMLElement; const side = sideEl.dataset.side as Side;
      const s = sess.current;
      if (!s || !s.q || !s.q.num || s.done || pausedRef.current) return;
      const u = uiRef.current[side];
      if (u.locked || u.waiting) return;
      const res = s.key(side, k.dataset.k || '');
      setSide(side, { input: s.input[side] });
      if (res === 'ok') battleCorrect(side); else if (res === 'ng') battleWrong(side);
    };
    if (window.PointerEvent) { el.addEventListener('pointerdown', onNumKey, { passive: false }); return () => el.removeEventListener('pointerdown', onNumKey); }
    el.addEventListener('touchstart', onNumKey, { passive: false }); el.addEventListener('click', onNumKey);
    return () => { el.removeEventListener('touchstart', onNumKey); el.removeEventListener('click', onNumKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pause = useCallback(() => { if (paused || !timer.current) return; setPaused(true); remain.current = Math.max(0, endAt.current - Date.now()); stopTimer(); }, [paused]);
  const resume = useCallback(() => { if (!paused) return; setPaused(false); startTimer(remain.current); }, [paused, startTimer]);
  usePauseKeys(paused, pause, resume);

  const ratio = left / (capSec * 1000);
  const s = sess.current;
  const info = 'のこり ' + Math.ceil(remain.current / 1000) + '秒' + (s ? ' ／ おとな ' + s.score.adult + ' − こども ' + s.score.child : '');

  return (
    <section className="screen on" id="s-battle" ref={root}>
      <BattleSide side="adult" q={q} u={ui.adult} onChoice={onChoice} />
      <div className="mid">
        <span className="mscore"><span id="sc-adult">{score.adult}</span><small>おとな</small></span>
        <div className="mtimer"><div id="btimer" className={left <= 10000 ? 'warn' : ''} style={{ width: (ratio * 100).toFixed(1) + '%' }}></div></div>
        <span className="mscore"><span id="sc-child">{score.child}</span><small>こども</small></span>
        <PauseButton id="btn-bpause" onClick={pause} />
      </div>
      <BattleSide side="child" q={q} u={ui.child} onChoice={onChoice} />
      <div className={'bfin' + (fin ? ' on' : '')} id="bfin" aria-hidden="true">
        <div className="half up"><span className="big">しゅうりょう！</span><span className="sub">手を とめて けっかを 見よう</span></div>
        <div className="half"><span className="big">しゅうりょう！</span><span className="sub">手を とめて けっかを 見よう</span></div>
      </div>
      <PauseOverlay open={paused} info={info} onResume={resume} onRestart={() => { setPaused(false); stopTimer(); onRestart(); }} onQuit={() => { setPaused(false); stopTimer(); onQuit(); }} />
    </section>
  );
}

function BattleSide({ side, q, u, onChoice }: { side: Side; q: BattleQ | null; u: SideUI; onChoice: (side: Side, a: string) => void }) {
  const cls = 'side' + (u.flash ? ' flash' : '') + (u.locked ? ' locked' : '') + (u.waiting ? ' waiting' : '');
  const num = !!(q && q.num);
  return (
    <div className={cls} data-side={side} id={'side-' + side}>
      <span className="sidetag">{side === 'adult' ? 'おとな' : 'こども'}</span>
      {q && q.art ? <Raw as="div" className="qart" html={artHTML(q.art)} /> : <div className="qart" hidden></div>}
      {q && q.num ? <p className="qtext num">{q.text}</p> : <Raw as="p" className="qtext" html={q ? furi(q.text) : ''} />}
      <div className="numwrap" hidden={!num}>
        <div className={'numin' + (u.input ? ' filled' : '')}><span className="numval">{u.input}</span><span className="numcaret"></span></div>
        <div className="numpad">
          {NUMKEYS.map((k) => <button type="button" className="numkey" data-k={k} key={k}>{k}</button>)}
          <button type="button" className="numkey del" data-k="del">1つけす</button>
        </div>
        <div className="waitmsg">まって…</div>
      </div>
      <div className={'choices' + (u.opts.length <= 2 ? ' one' : '')} hidden={num}>
        {!num && u.opts.map((o) => {
          const y = q && q.yomi && q.yomi[o];
          return <ChoiceBtn key={o} a={o} html={y ? furiName(o, y) : furi(o)} onClick={() => onChoice(side, o)} />;
        })}
      </div>
      <div className="lockmsg">おてつき！</div>
    </div>
  );
}
function ChoiceBtn({ a, html, onClick }: { a: string; html: string; onClick: () => void }) {
  return <button type="button" className="choice" data-a={a} onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />;
}

/* ===== 結果 ===== */
export function BResultScreen({ r, onAgain, onTitle, onRank }: { r: BattleResult; onAgain: () => void; onTitle: () => void; onRank?: () => void }) {
  const a = r.adult, c = r.child;
  const win = a > c ? { t: 'おとなの かち', bg: '#1B4965', m: 'さすが。つぎはハンデを増やしてみよう。' }
    : c > a ? { t: 'こどもの かち', bg: '#E0452F', m: 'はやい！おとなに勝ったね。' }
      : { t: 'ひきわけ', bg: '#7E93A0', m: 'いい勝負。もう一回やって決着をつけよう。' };
  const tot = a + c;
  const rk = rankOf('battle', tot, r.seconds);
  const nx = rankNext('battle', tot, r.seconds);
  const lock = useResultLock(3000);
  return (
    <section className={'screen on' + (lock > 0 ? ' reslock' : '')} id="s-bresult">
      <div className="rankcard">
        <span className="rankbadge" id="bwin" style={{ background: win.bg }}>{win.t}</span>
        <div className="vs">
          <div><span className="n display" id="bs-adult">{a}</span><span className="who">おとな</span></div>
          <span className="dash">−</span>
          <div><span className="n display" id="bs-child">{c}</span><span className="who">こども</span></div>
        </div>
        <p className="lede" id="bmsg" style={{ margin: '10px 0 0' }}>{win.m}</p>
        <div className="ranksash">
          <span className="rankbadge" id="brank" style={{ background: rk.color }}>{rk.name}</span>
          <p className="rankpace" id="brank-pace">2人あわせて {rankLine(tot, r.seconds)}{r.goal ? '（' + r.goal + 'もん先取）' : ''}</p>
          <p className="ranknext" id="brank-next" hidden={!nx}>{nx ? 'あと ' + nx.more + 'もんで ' + nx.name : ''}</p>
        </div>
      </div>
      {r.last ? <Hee prefix="b" name={r.last.answer} text={r.last.fact + '。'} />
        : <Hee prefix="b" name="はやおしのコツ" text="あせってまちがえると1.5秒お休み。あわてず確実にいくほうが速いことが多い。" />}
      <Promo prefix="b" />
      <button className="btn btn-go" id="btn-bagain" onClick={onAgain} disabled={lock > 0}>{lock > 0 ? 'けっかを 見てね… ' + lock : 'もういちど'}</button>
      {onRank && <button className="btn btn-rank" id="btn-brank-view" onClick={onRank} disabled={lock > 0}>ランキングを 見る</button>}
      <button className="btn btn-ghost" data-back="s-title" onClick={onTitle}>さいしょの画面へ</button>
    </section>
  );
}
