/* はやおし親子バトル */
import { useCallback, useEffect, useRef, useState } from 'react';
import { BattleSession, BATTLE_CAP, NUMKEYS, ANSWER_MS } from '../game/battle';

const REVEAL_MS = 70;   /* 問題文を 1文字ずつ 出す はやさ（クイズ番組ふう） */
/** 少しずつ 出すのは けいさん いがい ぜんぶ（もじあて・国旗・えいごも 文は 少しずつ） */
const isProg = (q: BattleQ | null) => !!(q && !q.num);
import { furi, furiName, cutFuri, plainLen } from '../game/furigana';
import { esc } from '../game/util';
import { artHTML } from '../game/art';
import { rankOf, rankNext, rankLine, rankMsg } from '../game/rank';
import { missCount } from '../game/records';
import type { BattleQ, Level, Side } from '../game/types';
import type { BattleSubj } from '../game/battle';
import { Hee, PauseButton, PauseOverlay, Promo, Raw, usePauseKeys, useResultLock } from './parts';
import type { BattleResult } from './state';

export interface BattleProps {
  level: Level; seconds: number; bsubj: BattleSubj; handi: number; goal: number;
  players: 1 | 2;   /* 1 = ひとりモード。こども側だけを 回転なしで 出す */
  onFinish: (r: BattleResult) => void; onRestart: () => void; onQuit: () => void;
}

type SideUI = { opts: string[]; flash: boolean; locked: boolean; waiting: boolean; input: string };
const sideZero = (): SideUI => ({ opts: [], flash: false, locked: false, waiting: false, input: '' });
/** 回答権の ようす。2人のときだけ 意味がある */
type Turn = { owner: Side | null; tried: Record<Side, boolean>; reveal: boolean };

export function BattleScreen({ level, seconds, bsubj, handi, goal, players, onFinish, onRestart, onQuit }: BattleProps) {
  const solo = players === 1;
  const sess = useRef<BattleSession | null>(null);
  const [q, setQ] = useState<BattleQ | null>(null);
  const [ui, setUi] = useState<Record<Side, SideUI>>({ adult: sideZero(), child: sideZero() });
  const [score, setScore] = useState({ adult: '0', child: '0' });
  const [turn, setTurn] = useState<Turn>({ owner: null, tried: { adult: false, child: false }, reveal: false });
  const [ansLeft, setAnsLeft] = useState(0);            /* こたえる もちじかん（ミリ秒）。0 = はかっていない */
  const [rev, setRev] = useState(999);                  /* 問題文を 何文字 出したか */
  const revTimer = useRef<number | null>(null);
  const ansEnd = useRef(0), ansTimer = useRef<number | null>(null);
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
  const syncTurn = (s: BattleSession, reveal = false) => setTurn({ owner: s.owner, tried: { ...s.tried }, reveal });

  /* 問題文を 左から 少しずつ 出す。だれかが 赤いボタンを 取ったら 止める */
  const stopRev = useCallback(() => { if (revTimer.current) { clearInterval(revTimer.current); revTimer.current = null; } }, []);
  const revDoneRef = useRef<() => void>(() => undefined);
  const revPos = useRef(0);
  /** from を わたすと そこから、わたさないと 止まったところから つづける */
  const runRev = useCallback((q: BattleQ | null, from?: number) => {
    stopRev();
    if (!isProg(q)) { revPos.current = 999; setRev(999); revDoneRef.current(); return; }
    if (from !== undefined) { revPos.current = from; setRev(from); }
    const len = plainLen(q!.text);
    if (revPos.current >= len) { revDoneRef.current(); return; }
    revTimer.current = window.setInterval(() => {
      revPos.current += 1;
      setRev(revPos.current);
      if (revPos.current >= len) { stopRev(); revDoneRef.current(); }
    }, REVEAL_MS);
  }, [stopRev]);

  /* こたえる もちじかん（3秒）。赤いボタンを 取ったとき と、もじあての 1文字ごとに 動かす */
  const stopAns = useCallback(() => {
    if (ansTimer.current) { clearInterval(ansTimer.current); ansTimer.current = null; }
    setAnsLeft(0);
  }, []);
  const ansSideRef = useRef<Side | null>(null);
  const timeUpRef = useRef<(side: Side) => void>(() => undefined);
  const startAns = useCallback((side: Side) => {
    if (ansTimer.current) clearInterval(ansTimer.current);
    ansSideRef.current = side;
    ansEnd.current = Date.now() + ANSWER_MS;
    setAnsLeft(ANSWER_MS);
    ansTimer.current = window.setInterval(() => {
      const l = Math.max(0, ansEnd.current - Date.now());
      setAnsLeft(l);
      if (l <= 0) { stopAns(); const sd = ansSideRef.current; if (sd) timeUpRef.current(sd); }
    }, 100);
  }, [stopAns]);

  /* バトルは 時間切れの瞬間に 全画面の「しゅうりょう！」で タップを受けとめてから結果へ */
  const battleFinish = useCallback(() => {
    if (finished.current) return; finished.current = true;
    const s = sess.current!;
    s.done = true;
    stopTimer(); stopAns();
    setSide('adult', { waiting: false });
    setFin(true);
    later(() => {
      setFin(false);
      const sec = goal ? Math.max(1, Math.round((Date.now() - (t0.current || Date.now())) / 1000)) : seconds;
      onFinishRef.current({ adult: s.score.adult, child: s.score.child, goal, seconds: sec, players, miss: bsubj === 'miss', last: s.last ? { answer: s.last.answer, fact: s.last.fact || '' } : null });
    }, 1400);
  }, [goal, seconds, players, bsubj, stopAns, stopRev]);

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
    runRev(q, 0);
    syncTurn(s);
    setUi({
      adult: { opts: opts.adult, flash: false, locked: false, waiting: wait > 0, input: '' },
      child: { opts: opts.child, flash: false, locked: false, waiting: false, input: '' },
    });
    /* ハンデは「おとなだけ しばらく 赤いボタンを 押せない」にする（けいさんは 選たく肢が ないので） */
    if (wait > 0) later(() => setSide('adult', { waiting: false }), wait);
    /* ひとりモードは 赤いボタンが ないので、文が 出そろった 時点から 3秒 */
    stopAns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, startAns, stopAns, runRev]);

  useEffect(() => {
    const s = new BattleSession({ level, bsubj, handi, goal, players });
    sess.current = s; finished.current = false;
    drawScore(s);
    nextBattle();
    t0.current = Date.now();
    startTimer(capSec * 1000);
    const tm = timers.current;
    return () => { stopTimer(); stopAns(); stopRev(); tm.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uiRef = useRef(ui); uiRef.current = ui;
  const battleCorrect = (side: Side) => {
    const s = sess.current!;
    stopAns();
    const reached = s.correct(side);
    drawScore(s);
    setSide(side, { flash: true });
    if (reached) { stopTimer(); later(battleFinish, 420); return; }   /* 〇もん先取モードは とどいた時点で おわり */
    later(() => { if (!finished.current) nextBattle(); }, 420);
  };
  const battleWrong = (side: Side) => {
    const s = sess.current!;
    s.wrong(side);
    /* 2人とも まちがえたら こたえを 見せて つぎの問題へ。1人なら 同じ問題を もう一度 */
    const both = players === 2 && s.bothTried();
    stopAns();
    syncTurn(s, both);
    setSide(side, { locked: true, input: '' });
    later(() => {
      setSide(side, { locked: false });
      if (finished.current) return;
      /* ひとりモードは 3秒で 区切るので、まちがえたら つぎの問題へ（同じ問題を くり返さない） */
      if (both || players === 1) { nextBattle(); return; }
      /* 2人で 相手が まだ 押していないなら、問題文の つづきを 出す */
      if (isProg(sess.current && sess.current.q)) runRev(sess.current!.q);
    }, 1500);
  };
  const onChoice = (side: Side, a: string) => {
    const s = sess.current; if (!s || s.done || pausedRef.current || !s.q) return;
    if (uiRef.current[side].locked) return;
    if (players === 2 && s.owner !== side) return;   /* 回答権を 持っている人だけ */
    if (a === s.q.answer) battleCorrect(side); else battleWrong(side);
  };
  /* 赤いボタン：回答権を とる */
  const onBuzz = (side: Side) => {
    const s = sess.current; if (!s || s.done || pausedRef.current || !s.q) return;
    const u = uiRef.current[side];
    if (u.locked || u.waiting) return;
    if (s.claim(side)) { syncTurn(s); stopRev(); startAns(side); }   /* 取ったら 文は 止まり、3秒で こたえる */
  };
  /* もじあて：1文字えらぶ。合っていれば つぎの1文字へ（3秒 出しなおし） */
  const onChar = (side: Side, ch: string) => {
    const s = sess.current; if (!s || s.done || pausedRef.current || !s.q) return;
    if (uiRef.current[side].locked) return;
    if (players === 2 && s.owner !== side) return;
    const res = s.char(side, ch);
    setSide(side, { input: s.input[side] });
    if (res === 'ok') battleCorrect(side);
    else if (res === 'ng') battleWrong(side);
    else startAns(side);
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
      if (s.opts.players === 2 && s.owner !== side) return;
      const res = s.key(side, k.dataset.k || '');
      setSide(side, { input: s.input[side] });
      if (res === 'ok') battleCorrect(side); else if (res === 'ng') battleWrong(side);
    };
    if (window.PointerEvent) { el.addEventListener('pointerdown', onNumKey, { passive: false }); return () => el.removeEventListener('pointerdown', onNumKey); }
    el.addEventListener('touchstart', onNumKey, { passive: false }); el.addEventListener('click', onNumKey);
    return () => { el.removeEventListener('touchstart', onNumKey); el.removeEventListener('click', onNumKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* 3秒で こたえられなかった＝おてつき あつかい */
  timeUpRef.current = (side: Side) => { if (!finished.current && !pausedRef.current) battleWrong(side); };
  /* 文が 出そろったら、ひとりモードは そこから 3秒 */
  revDoneRef.current = () => {
    if (players !== 1 || finished.current || pausedRef.current) return;
    const s2 = sess.current; if (!s2 || !s2.q || s2.done) return;
    if (uiRef.current.child.locked) return;
    startAns('child');
  };
  const ansSide: Side | null = players === 1 ? 'child' : turn.owner;

  const pause = useCallback(() => {
    if (paused || !timer.current) return;
    setPaused(true); remain.current = Math.max(0, endAt.current - Date.now());
    stopTimer(); stopAns(); stopRev();
  }, [paused, stopAns, stopRev]);
  const resume = useCallback(() => {
    if (!paused) return;
    setPaused(false); startTimer(remain.current);
    /* こたえる もちじかんは 出しなおし（止めたぶん 得しないように 3秒から） */
    const s = sess.current;
    if (s && s.q && !s.done) {
      if (players === 2 && s.owner) startAns(s.owner);
      else if (players === 1) startAns('child');
      if (!(players === 2 && s.owner)) runRev(s.q);
    }
  }, [paused, startTimer, players, startAns, runRev]);
  usePauseKeys(paused, pause, resume);

  const ratio = left / (capSec * 1000);
  const s = sess.current;
  const info = 'のこり ' + Math.ceil(remain.current / 1000) + '秒'
    + (s ? (solo ? ' ／ とくてん ' + s.score.child : ' ／ おとな ' + s.score.adult + ' − こども ' + s.score.child) : '');

  return (
    <section className={'screen on' + (solo ? ' solo' : '')} id="s-battle" ref={root}>
      {/* 2人：こどもが 上（180度回転）、おとなが 下（スマホを持つ人。まん中の 時間・一時停止も おとな向き）
          ひとり：こども側 だけを 回転なしで 下に 出す（時間は 上） */}
      {!solo && <BattleSide side="child" q={q} u={ui.child} players={players} turn={turn} rev={rev} ans={ansSide === 'child' ? ansLeft : 0} onChoice={onChoice} onBuzz={onBuzz} onChar={onChar} />}
      <div className="mid">
        {!solo && <span className="mscore flip"><span id="sc-child">{score.child}</span><small>こども</small></span>}
        <div className="mtimer"><div id="btimer" className={left <= 10000 ? 'warn' : ''} style={{ width: (ratio * 100).toFixed(1) + '%' }}></div></div>
        <span className="mscore"><span id={solo ? 'sc-solo' : 'sc-adult'}>{solo ? score.child : score.adult}</span><small>{solo ? 'とくてん' : 'おとな'}</small></span>
        <PauseButton id="btn-bpause" onClick={pause} />
      </div>
      {solo ? <BattleSide side="child" q={q} u={ui.child} players={players} turn={turn} rev={rev} ans={ansLeft} onChoice={onChoice} onBuzz={onBuzz} onChar={onChar} tag="あなた" />
        : <BattleSide side="adult" q={q} u={ui.adult} players={players} turn={turn} rev={rev} ans={ansSide === 'adult' ? ansLeft : 0} onChoice={onChoice} onBuzz={onBuzz} onChar={onChar} />}
      <div className={'bfin' + (fin ? ' on' : '')} id="bfin" aria-hidden="true">
        {!solo && <div className="half up"><span className="big">しゅうりょう！</span><span className="sub">手を とめて けっかを 見よう</span></div>}
        <div className="half"><span className="big">しゅうりょう！</span><span className="sub">手を とめて けっかを 見よう</span></div>
      </div>
      <PauseOverlay open={paused} info={info} onResume={resume} onRestart={() => { setPaused(false); stopTimer(); onRestart(); }} onQuit={() => { setPaused(false); stopTimer(); onQuit(); }} />
    </section>
  );
}

function BattleSide({ side, q, u, players, turn, ans, rev, onChoice, onBuzz, onChar, tag }: {
  side: Side; q: BattleQ | null; u: SideUI; players: 1 | 2; turn: Turn; ans: number; rev: number;
  onChoice: (side: Side, a: string) => void; onBuzz: (side: Side) => void; onChar: (side: Side, ch: string) => void; tag?: string;
}) {
  /* こたえ見せの あいだは「おてつき！」を どけて、2人とも こたえが 読めるようにする */
  const cls = 'side' + (u.flash ? ' flash' : '') + (u.locked && !turn.reveal ? ' locked' : '') + (u.waiting ? ' waiting' : '');
  const num = !!(q && q.num);
  /* ひとりモードは 取り合う相手が いないので いつでも こたえられる。
     2人は 赤いボタンを おした人だけに こたえが 出る */
  const owned = players === 1 || turn.owner === side;
  const canBuzz = players === 2 && !turn.reveal && !turn.owner && !turn.tried[side] && !u.locked && !u.waiting;
  const bzLabel = u.waiting ? 'まって…'
    : turn.owner ? 'あいてが こたえ中…'
      : turn.tried[side] ? 'あいての ばん…'
        : 'はやおし！';
  const ansHTML = q ? (q.yomi && q.yomi[q.answer] ? furiName(q.answer, q.yomi[q.answer]) : furi(q.answer)) : '';
  /* もじあて：いま 何個目の ? を うめるところか と、そこの 選たく肢 */
  const mi = q && q.chars ? u.input.length : 0;
  const mopts = q && q.charOpts && mi < q.charOpts.length ? q.charOpts[mi] : null;
  const holeAt = (i: number) => (q && q.holes ? q.holes.indexOf(i) : -1);
  return (
    <div className={cls} data-side={side} id={'side-' + side}>
      <span className="sidetag">{tag || (side === 'adult' ? 'おとな' : 'こども')}</span>
      {/* こたえる もちじかん（3秒）。のこりが 見えるように */}
      <div className="anstimer" id={'anst-' + side} hidden={ans <= 0}>
        <div style={{ width: Math.max(0, Math.min(100, (ans / 3000) * 100)).toFixed(1) + '%' }}></div>
      </div>
      {q && q.art ? <Raw as="div" className="qart" html={artHTML(q.art)} /> : <div className="qart" hidden></div>}
      {q && q.num ? <p className="qtext num">{q.text}</p>
        : isProg(q) ? (
          /* 左から 少しずつ。高さが 動かないように 全文を 見えない字で 敷いておく */
          <div className="qprog">
            <Raw as="p" className={'qtext ghost' + (q && q.disp ? ' long' : '')} html={q ? furi(q.text) : ''} />
            <Raw as="p" className={'qtext live' + (q && q.disp ? ' long' : '')} html={q ? furi(cutFuri(q.text, rev)) : ''} />
          </div>
        ) : <Raw as="p" className={'qtext' + (q && q.disp ? ' long' : '')} html={q ? furi(q.text) : ''} />}
      {/* 「〇文字目が『が』の都道府県は？」の ときは、同じ条件の 仲間を 大きく 見せておく
          （写真の 山形・新潟 と 同じ。あてはまる 字は 赤く） */}
      {q && q.shown && q.shown.length ? (
        <div className="mshown">
          {q.shown.map((x) => <Raw as="span" className="ms" key={x.name} html={hitRuby(x.name, x.yomi, q.hit)} />)}
        </div>
      ) : null}
      {turn.reveal
        ? <div className="bans">こたえは <Raw as="b" html={ansHTML} /></div>
        : owned ? (<>
          {q && q.chars ? (
            <div className="mojiwrap">
              <div className="mojiword">
                {q.chars.map((c, i) => {
                  const h = holeAt(i);
                  if (h < 0) return <span key={i} className="mchar fix">{c}</span>;   /* はじめから 見えている文字 */
                  if (h < mi) return <span key={i} className="mchar on">{u.input[h]}</span>;
                  return <span key={i} className={'mchar q' + (h === mi ? ' cur' : '')}>？</span>;
                })}
                {q.tail ? <span className="mtail">{q.tail}</span> : null}
              </div>
              <div className={'choices moji' + ((mopts || []).length <= 2 ? ' two' : '')}>
                {(mopts || []).map((c) => (
                  <button type="button" className="choice mj" data-a={c} key={c} onClick={() => onChar(side, c)}>{c}</button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="numwrap" hidden={!num}>
            <div className={'numin' + (u.input ? ' filled' : '')}><span className="numval">{u.input}</span><span className="numcaret"></span></div>
            <div className="numpad">
              {NUMKEYS.map((k) => <button type="button" className="numkey" data-k={k} key={k}>{k}</button>)}
              <button type="button" className="numkey del" data-k="del">1つけす</button>
            </div>
            <div className="waitmsg">まって…</div>
          </div>
          <div className={'choices' + (u.opts.length <= 2 ? ' one' : '')} hidden={num || !!(q && q.chars)}>
            {!num && u.opts.map((o) => {
              const d = q && q.disp && q.disp[o];
              const y = q && q.yomi && q.yomi[o];
              return <ChoiceBtn key={o} a={o} imi={!!d} html={d ? furi(d) : y ? furiName(o, y) : furi(o)} onClick={() => onChoice(side, o)} />;
            })}
          </div>
        </>)
          : <button type="button" className="buzz" id={'buzz-' + side} disabled={!canBuzz} onClick={() => onBuzz(side)}>{bzLabel}</button>}
      <div className="lockmsg">おてつき！</div>
    </div>
  );
}
/** 名前＋よみ。よみの n文字目だけ 赤くする（「がた」の「が」） */
function hitRuby(name: string, yomi: string, hit?: number): string {
  const rt = hit === undefined || hit >= yomi.length
    ? esc(yomi)
    : esc(yomi.slice(0, hit)) + '<i class="hit">' + esc(yomi[hit]) + '</i>' + esc(yomi.slice(hit + 1));
  return '<ruby>' + esc(name) + '<rt>' + rt + '</rt></ruby>';
}

function ChoiceBtn({ a, html, imi, onClick }: { a: string; html: string; imi?: boolean; onClick: () => void }) {
  return <button type="button" className={'choice' + (imi ? ' imi' : '')} data-a={a} onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />;
}

/* ===== 結果 ===== */
export function BResultScreen({ r, onAgain, onMiss, onTitle, onRank }: { r: BattleResult; onAgain: () => void; onMiss: () => void; onTitle: () => void; onRank?: () => void }) {
  const a = r.adult, c = r.child;
  const missN = missCount();
  const solo = r.players === 1;
  /* ひとりモードは 勝ち負けが ないので、こども側の 点だけを 見る。
     くらいの ものさしは 2人ぶんの battle では きびしすぎるので relay（1人ぶん）を つかう */
  const win = a > c ? { t: 'おとなの かち', bg: '#1B4965', m: 'さすが。つぎはハンデを増やしてみよう。' }
    : c > a ? { t: 'こどもの かち', bg: '#E0452F', m: 'はやい！おとなに勝ったね。' }
      : { t: 'ひきわけ', bg: '#7E93A0', m: 'いい勝負。もう一回やって決着をつけよう。' };
  const kind = solo ? 'relay' : 'battle';
  const tot = solo ? c : a + c;
  const rk = rankOf(kind, tot, r.seconds);
  const nx = rankNext(kind, tot, r.seconds);
  const lock = useResultLock(3000);
  return (
    <section className={'screen on' + (lock > 0 ? ' reslock' : '')} id="s-bresult">
      <div className="rankcard">
        <span className="rankbadge" id="bwin" style={{ background: solo ? '#7E5BB5' : win.bg }}>{solo ? (r.miss ? 'まちがい直し' : 'ひとりで はやおし') : win.t}</span>
        {solo
          ? <div className="vs"><div><span className="n display" id="bs-solo">{c}</span><span className="who">せいかい</span></div></div>
          : <div className="vs">
            <div><span className="n display" id="bs-adult">{a}</span><span className="who">おとな</span></div>
            <span className="dash">−</span>
            <div><span className="n display" id="bs-child">{c}</span><span className="who">こども</span></div>
          </div>}
        <p className="lede" id="bmsg" style={{ margin: '10px 0 0' }}>{solo ? rankMsg('relay', rk.i) : win.m}</p>
        <div className="ranksash">
          <span className="rankbadge" id="brank" style={{ background: rk.color }}>{rk.name}</span>
          <p className="rankpace" id="brank-pace">{solo ? '' : '2人あわせて '}{rankLine(tot, r.seconds)}{r.goal ? '（' + r.goal + 'もん' + (solo ? 'で おわり' : '先取') + '）' : ''}</p>
          <p className="ranknext" id="brank-next" hidden={!nx}>{nx ? 'あと ' + nx.more + 'もんで ' + nx.name : ''}</p>
        </div>
      </div>
      {r.last ? <Hee prefix="b" name={r.last.answer} text={r.last.fact + '。'} />
        : <Hee prefix="b" name="はやおしのコツ" text="あせってまちがえると1.5秒お休み。あわてず確実にいくほうが速いことが多い。" />}
      <Promo prefix="b" />
      <button className="btn btn-go" id="btn-bagain" onClick={onAgain} disabled={lock > 0}>{lock > 0 ? 'けっかを 見てね… ' + lock : 'もういちど'}</button>
      {onRank && !solo && !r.miss && <button className="btn btn-rank" id="btn-brank-view" onClick={onRank} disabled={lock > 0}>ランキングを 見る</button>}
      <button className="btn btn-sea" id="btn-bmiss" hidden={missN === 0} onClick={onMiss} disabled={lock > 0}>まちがえた問題を もう一回</button>
      <button className="btn btn-ghost" data-back="s-title" onClick={onTitle}>さいしょの画面へ</button>
    </section>
  );
}
