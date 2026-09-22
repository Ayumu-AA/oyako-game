/* はやおし親子バトル */
import { useCallback, useEffect, useRef, useState } from 'react';
import { BattleSession, BATTLE_CAP, NUMKEYS, ANSWER_MS } from '../game/battle';
import { furi, furiName } from '../game/furigana';
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
  }, [goal, seconds, players, bsubj, stopAns]);

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
    syncTurn(s);
    setUi({
      adult: { opts: opts.adult, flash: false, locked: false, waiting: wait > 0, input: '' },
      child: { opts: opts.child, flash: false, locked: false, waiting: false, input: '' },
    });
    /* ハンデは「おとなだけ しばらく 赤いボタンを 押せない」にする（けいさんは 選たく肢が ないので） */
    if (wait > 0) later(() => setSide('adult', { waiting: false }), wait);
    /* ひとりモードの もじあては 赤いボタンが ないので、出たらすぐ 1文字目の 3秒がはじまる */
    stopAns();
    if (players === 1 && q.chars) startAns('child');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, startAns, stopAns]);

  useEffect(() => {
    const s = new BattleSession({ level, bsubj, handi, goal, players });
    sess.current = s; finished.current = false;
    drawScore(s);
    nextBattle();
    t0.current = Date.now();
    startTimer(capSec * 1000);
    const tm = timers.current;
    return () => { stopTimer(); stopAns(); tm.forEach(clearTimeout); };
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
      if (both && !finished.current) { nextBattle(); return; }
      /* ひとりモードの もじあては 同じ問題に もう一度 挑戦できるので、3秒も 出しなおす */
      if (players === 1 && sess.current && sess.current.q && sess.current.q.chars && !finished.current) startAns('child');
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
    if (s.claim(side)) { syncTurn(s); startAns(side); }   /* 取ったら 3秒で こたえる */
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
  const ansSide: Side | null = players === 1 ? 'child' : turn.owner;

  const pause = useCallback(() => {
    if (paused || !timer.current) return;
    setPaused(true); remain.current = Math.max(0, endAt.current - Date.now());
    stopTimer(); stopAns();
  }, [paused, stopAns]);
  const resume = useCallback(() => {
    if (!paused) return;
    setPaused(false); startTimer(remain.current);
    /* こたえる もちじかんは 出しなおし（止めたぶん 得しないように 3秒から） */
    const s = sess.current;
    if (s && s.q && !s.done) {
      if (players === 2 && s.owner) startAns(s.owner);
      else if (players === 1 && s.q.chars) startAns('child');
    }
  }, [paused, startTimer, players, startAns]);
  usePauseKeys(paused, pause, resume);

  const ratio = left / (capSec * 1000);
  const s = sess.current;
  const info = 'のこり ' + Math.ceil(remain.current / 1000) + '秒'
    + (s ? (solo ? ' ／ とくてん ' + s.score.child : ' ／ おとな ' + s.score.adult + ' − こども ' + s.score.child) : '');

  return (
    <section className={'screen on' + (solo ? ' solo' : '')} id="s-battle" ref={root}>
      {/* 2人：こどもが 上（180度回転）、おとなが 下（スマホを持つ人。まん中の 時間・一時停止も おとな向き）
          ひとり：こども側 だけを 回転なしで 下に 出す（時間は 上） */}
      {!solo && <BattleSide side="child" q={q} u={ui.child} players={players} turn={turn} ans={ansSide === 'child' ? ansLeft : 0} onChoice={onChoice} onBuzz={onBuzz} onChar={onChar} />}
      <div className="mid">
        {!solo && <span className="mscore flip"><span id="sc-child">{score.child}</span><small>こども</small></span>}
        <div className="mtimer"><div id="btimer" className={left <= 10000 ? 'warn' : ''} style={{ width: (ratio * 100).toFixed(1) + '%' }}></div></div>
        <span className="mscore"><span id={solo ? 'sc-solo' : 'sc-adult'}>{solo ? score.child : score.adult}</span><small>{solo ? 'とくてん' : 'おとな'}</small></span>
        <PauseButton id="btn-bpause" onClick={pause} />
      </div>
      {solo ? <BattleSide side="child" q={q} u={ui.child} players={players} turn={turn} ans={ansLeft} onChoice={onChoice} onBuzz={onBuzz} onChar={onChar} tag="あなた" />
        : <BattleSide side="adult" q={q} u={ui.adult} players={players} turn={turn} ans={ansSide === 'adult' ? ansLeft : 0} onChoice={onChoice} onBuzz={onBuzz} onChar={onChar} />}
      <div className={'bfin' + (fin ? ' on' : '')} id="bfin" aria-hidden="true">
        {!solo && <div className="half up"><span className="big">しゅうりょう！</span><span className="sub">手を とめて けっかを 見よう</span></div>}
        <div className="half"><span className="big">しゅうりょう！</span><span className="sub">手を とめて けっかを 見よう</span></div>
      </div>
      <PauseOverlay open={paused} info={info} onResume={resume} onRestart={() => { setPaused(false); stopTimer(); onRestart(); }} onQuit={() => { setPaused(false); stopTimer(); onQuit(); }} />
    </section>
  );
}

function BattleSide({ side, q, u, players, turn, ans, onChoice, onBuzz, onChar, tag }: {
  side: Side; q: BattleQ | null; u: SideUI; players: 1 | 2; turn: Turn; ans: number;
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
  /* もじあて：いま 何文字目か と、そこの 4たく */
  const mi = q && q.chars ? u.input.length : 0;
  const mopts = q && q.charOpts && mi < q.charOpts.length ? q.charOpts[mi] : null;
  return (
    <div className={cls} data-side={side} id={'side-' + side}>
      <span className="sidetag">{tag || (side === 'adult' ? 'おとな' : 'こども')}</span>
      {/* こたえる もちじかん（3秒）。のこりが 見えるように */}
      <div className="anstimer" id={'anst-' + side} hidden={ans <= 0}>
        <div style={{ width: Math.max(0, Math.min(100, (ans / 3000) * 100)).toFixed(1) + '%' }}></div>
      </div>
      {q && q.art ? <Raw as="div" className="qart" html={artHTML(q.art)} /> : <div className="qart" hidden></div>}
      {q && q.num ? <p className="qtext num">{q.text}</p> : <Raw as="p" className={'qtext' + (q && q.disp ? ' long' : '')} html={q ? furi(q.text) : ''} />}
      {turn.reveal
        ? <div className="bans">こたえは <Raw as="b" html={ansHTML} /></div>
        : owned ? (<>
          {q && q.chars ? (
            <div className="mojiwrap">
              <div className="mojiword">
                {q.chars.map((_c, i) => (
                  <span key={i} className={'mchar' + (i < mi ? ' on' : i === mi ? ' cur' : '')}>{i < mi ? u.input[i] : ''}</span>
                ))}
                {q.tail ? <span className="mtail">{q.tail}</span> : null}
              </div>
              <div className="choices moji">
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
