/* 親子クロスワード ／ けいさんクロス（1人用） ／ 完成画面 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KBD } from '../data/cross';
import { newCross, cwCells, cwKey, cwLeft, cwAllOk, wordsAt, wordOk, cwSelectWord, cwSelectWordKeepPos, cwTapCell, cwInput, cwModify, cwCycle, cwDelete, cwHint, type CwState } from '../game/cross';
import { FlickPad } from './FlickPad';
import { newNum, ncLeft, ncMarks, ncAllOk, ncKey, NC_KEYS, NC_POS, type NcState, type NcKey } from '../game/numcross';
import { fmtTime } from '../game/util';
import { store } from '../lib/storage';
import type { Level } from '../game/types';
import { NC_TIPS } from './texts';
import { Hee, PauseButton, PauseOverlay, Promo, usePauseKeys } from './parts';
import type { CrossResult } from './state';

/** 経過時間（一時停止で止まる） */
function useElapsed() {
  const acc = useRef(0), t0 = useRef(0);
  const [ms, setMs] = useState(0);
  const timer = useRef<number | null>(null);
  const now = useCallback(() => acc.current + (t0.current ? Date.now() - t0.current : 0), []);
  const start = useCallback(() => { t0.current = Date.now(); if (!timer.current) timer.current = window.setInterval(() => setMs(now()), 250); }, [now]);
  const stop = useCallback(() => { acc.current = now(); t0.current = 0; if (timer.current) { clearInterval(timer.current); timer.current = null; } }, [now]);
  const reset = useCallback(() => { acc.current = 0; t0.current = 0; setMs(0); }, []);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  return { ms, now, start, stop, reset, running: () => !!timer.current };
}

const KB = KBD as string[][];

export function CrossScreen({ level, kana, prevIdx, forceIdx = null, onIdx, onFinish, onRestart, onQuit }: { level: Level; kana: 'R' | 'L' | 'F'; prevIdx: number | null; forceIdx?: number | null; onIdx?: (idx: number) => void; onFinish: (r: CrossResult) => void; onRestart: () => void; onQuit: () => void }) {
  const [cw] = useState<CwState>(() => newCross(level, prevIdx, forceIdx));
  const onIdxRef = useRef(onIdx); onIdxRef.current = onIdx;
  useEffect(() => { if (onIdxRef.current) onIdxRef.current(cw.idx); }, [cw]);   /* App が「さいしょから やりなおす」で 同じ問題を 出すため */
  const [, bump] = useState(0);
  const redraw = () => bump((x) => x + 1);
  const [clues, setClues] = useState(false);
  const [paused, setPaused] = useState(false);
  const el = useElapsed();
  const finished = useRef(false);
  const onFinishRef = useRef(onFinish); onFinishRef.current = onFinish;

  useEffect(() => { el.reset(); el.start(); finished.current = false; return () => el.stop(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cw]);

  const pause = useCallback(() => { if (paused || finished.current) return; setPaused(true); el.stop(); }, [paused, el]);
  const resume = useCallback(() => { if (!paused) return; setPaused(false); el.start(); }, [paused, el]);
  usePauseKeys(paused, pause, resume);

  const after = () => {
    redraw();
    if (cwLeft(cw) === 0 && cwAllOk(cw) && !finished.current) {
      finished.current = true; el.stop();
      const ms = el.now();
      const w = cw.puz.w[Math.floor(Math.random() * cw.puz.w.length)];
      const key = 'oyako-cross-' + level;
      const prev = Number(store(key) || 0);
      if (!prev || ms < prev) store(key, String(ms));
      onFinishRef.current({ kind: 'cross', ms, hints: cw.hints, heeName: w.w, heeText: w.q + '、でした。', idx: cw.idx });
    }
  };

  const puz = cw.puz, sel = cw.sel, selW = puz.w[sel.i], selCells = cwCells(selW), selPos = selCells[sel.pos];
  const left = cwLeft(cw);
  const cellPx = Math.min(46, Math.floor((Math.min(window.innerWidth, 520) - 40 - 3 * (cw.C - 1)) / cw.C));
  const nowWords = selPos ? wordsAt(cw, selPos[0], selPos[1]) : [];
  const info = 'かかった時間 ' + fmtTime(el.now()) + ' ／ のこり ' + left + 'マス';

  const clueGroup = (dir: 'A' | 'D', label: string, cls: string) => (
    <div className="cluegrp"><p className={'cluehead ' + cls}>{label}</p>
      {puz.w.map((w, i) => w.d === dir && (
        <button type="button" key={i} className={'clue' + (wordOk(cw, w) ? ' ok' : '') + (i === sel.i ? ' sel' : '')} data-i={i} onClick={() => { cwSelectWord(cw, i); redraw(); }}>
          <b>{cw.nums[cwKey(w.r, w.c)]}</b><span>{w.q}（{w.w.length}文字）</span>
        </button>
      ))}
    </div>
  );

  return (
    <section className="screen on" id="s-cross">
      <div className="cwhud">
        <span className="cwstat">じかん <b id="cw-time">{fmtTime(el.ms)}</b></span>
        <span className="cwstat">のこり <b id="cw-left">{left}</b>マス</span>
        <div className="spacer"></div>
        <PauseButton id="btn-cpause" onClick={pause} />
      </div>
      <div className="rolebar">
        <span className="yoko">ヨコ → こども</span>
        <span className="tate">タテ ↓ おとな</span>
      </div>
      <div className="cwscroll">
        <div className="cwgrid" id="cwgrid" style={{ gridTemplateColumns: 'repeat(' + cw.C + ',var(--cw))', ['--cw' as string]: cellPx + 'px' }}>
          {puz.g.map((row, r) => row.split('').map((ch, c) => {
            if (ch === '#') return <div className="cwcell black" key={r + '_' + c}></div>;
            const no = cw.nums[cwKey(r, c)];
            const sa = puz.w.some((w) => w.d === 'A' && w.r === r && w.c === c);
            const sd = puz.w.some((w) => w.d === 'D' && w.r === r && w.c === c);
            const inw = selCells.some((p) => p[0] === r && p[1] === c);
            const cls = 'cwcell' + (sa ? ' sa' : '') + (sd ? ' sd' : '') + (inw ? ' inword' : '') + (inw && selW.d === 'A' ? ' wa' : '') + (inw && selW.d === 'D' ? ' wd' : '') + (selPos && selPos[0] === r && selPos[1] === c ? ' sel' : '');
            return (
              <button type="button" key={r + '_' + c} className={cls} data-r={r} data-c={c} onClick={() => { cwTapCell(cw, r, c); redraw(); }}>
                {no ? <span className="no">{no}</span> : null}<span className="ch">{cw.letters[cwKey(r, c)] || ''}</span>
              </button>
            );
          }))}
        </div>
        <button type="button" className="cluetoggle" id="btn-cluelist" onClick={() => setClues((x) => !x)}>{clues ? 'カギの一覧を とじる' : 'カギの一覧を ひらく'}</button>
        <div className="clues" id="cwclues" hidden={!clues}>
          {clueGroup('A', 'ヨコのカギ　こどもが かんがえる', 'yoko')}
          {clueGroup('D', 'タテのカギ　おとなが かんがえる', 'tate')}
        </div>
      </div>
      <div className="cwnow" id="cwnow">
        {!selPos ? <p className="none">マスか カギを タップしてね</p> : nowWords.map((i) => {
          const w = puz.w[i];
          return (
            <button type="button" key={i} data-i={i} className={(i === sel.i ? 'sel ' : '') + (wordOk(cw, w) ? 'ok' : '')} onClick={() => { cwSelectWordKeepPos(cw, i); redraw(); }}>
              <span className={'tag ' + (w.d === 'A' ? 'yoko' : 'tate')}>{w.d === 'A' ? 'ヨコ' : 'タテ'} {cw.nums[cwKey(w.r, w.c)]}</span>
              <span className="txt">{w.q}（{w.w.length}文字）</span>
            </button>
          );
        })}
      </div>
      <div className="cwpad">
        {kana === 'F' ? <FlickPad onChar={(k) => { cwInput(cw, k); after(); }} onCycle={() => { cwCycle(cw); after(); }} /> : (
          <div className="kbd" id="kbd">
            {KB.map((row0, ri) => (kana === 'R' ? row0.slice().reverse() : row0).map((k, ci) => (
              k ? <button type="button" key={ri + '_' + ci} data-k={k} onClick={() => { cwInput(cw, k); after(); }}>{k}</button>
                : <button className="blank" tabIndex={-1} key={ri + '_' + ci}></button>
            )))}
          </div>
        )}
        <div className="kbd2">
          <button type="button" data-k="゛" onClick={() => { cwModify(cw, '゛'); after(); }}>てんてん</button>
          <button type="button" data-k="゜" onClick={() => { cwModify(cw, '゜'); after(); }}>まる</button>
          <button type="button" data-k="小" onClick={() => { cwModify(cw, '小'); after(); }}>小さく</button>
          <button type="button" className="wide" data-k="del" onClick={() => { cwDelete(cw); redraw(); }}>1つけす</button>
          <button type="button" className="wide" data-k="hint" onClick={() => { cwHint(cw); after(); }}>ここを開く</button>
        </div>
      </div>
      <PauseOverlay open={paused} info={info} onResume={resume} onRestart={() => { setPaused(false); el.stop(); onRestart(); }} onQuit={() => { setPaused(false); el.stop(); onQuit(); }} />
    </section>
  );
}

export function NumCrossScreen({ level, onFinish, onRestart, onQuit }: { level: Level; onFinish: (r: CrossResult) => void; onRestart: () => void; onQuit: () => void }) {
  const [nc] = useState<NcState>(() => newNum(level));
  const [, bump] = useState(0);
  const redraw = () => bump((x) => x + 1);
  const [msg, setMsg] = useState<{ cls: string; text: string }>({ cls: '', text: 'たて・よこ ぜんぶの 計算が 合うように 数を入れよう' });
  const [paused, setPaused] = useState(false);
  const el = useElapsed();
  const finished = useRef(false);
  const onFinishRef = useRef(onFinish); onFinishRef.current = onFinish;
  useEffect(() => { el.reset(); el.start(); finished.current = false; return () => el.stop(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pause = useCallback(() => { if (paused || finished.current) return; setPaused(true); el.stop(); }, [paused, el]);
  const resume = useCallback(() => { if (!paused) return; setPaused(false); el.start(); }, [paused, el]);
  usePauseKeys(paused, pause, resume);

  const cellAt = useMemo(() => { const m: Record<string, NcKey> = {}; NC_KEYS.forEach((k) => { m[NC_POS[k][0] + '_' + NC_POS[k][1]] = k; }); return m; }, []);
  const left = ncLeft(nc);
  const { good, bad } = ncMarks(nc);

  const check = () => {
    const empty = ncLeft(nc);
    if (empty > 0) { nc.checked = false; setMsg({ cls: 'ng', text: 'まだ 空いているマスが ' + empty + 'こ あるよ' }); redraw(); return; }
    nc.checked = true;
    if (ncAllOk(nc)) {
      finished.current = true; el.stop();
      const ms = el.now();
      const key = 'oyako-numcross-' + level;
      const prev = Number(store(key) || 0);
      if (!prev || ms < prev) store(key, String(ms));
      onFinishRef.current({ kind: 'numcross', ms, hints: 0, heeName: 'けいさんクロスの コツ', heeText: NC_TIPS[Math.floor(Math.random() * NC_TIPS.length)] + '。' });
      return;
    }
    setMsg({ cls: 'ng', text: 'ふせいかい。赤い列の 計算が 合っていないよ' }); redraw();
  };
  const key = (n: string) => { if (!nc.sel) return; ncKey(nc, n); setMsg({ cls: '', text: 'たて・よこ ぜんぶの 計算が 合うように 数を入れよう' }); redraw(); };

  const cells: React.ReactNode[] = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
    const k = cellAt[r + '_' + c];
    if (k) {
      const open = nc.puz.hide.indexOf(k) >= 0;
      cells.push(<button type="button" key={k} className={'nccell ' + (open ? 'open' : 'fixed') + (k === nc.sel ? ' sel' : '') + (bad[k] ? ' bad' : '') + (!bad[k] && good[k] ? ' good' : '')} data-k={k} disabled={!open}
        onClick={() => { if (!open) return; nc.sel = k; redraw(); }}>{open ? nc.val[k] : nc.puz.v[k]}</button>);
    } else if (r % 2 === 0 && c % 2 === 1) cells.push(<span className="ncop" key={r + '_' + c}>{c === 3 ? '＝' : '＋'}</span>);
    else if (r % 2 === 1 && c % 2 === 0) cells.push(<span className="ncop" key={r + '_' + c}>{r === 3 ? '＝' : '＋'}</span>);
    else cells.push(<span className="ncblank" key={r + '_' + c}></span>);
  }
  return (
    <section className="screen on" id="s-numcross">
      <div className="cwhud">
        <span className="cwstat">じかん <b id="nc-time">{fmtTime(el.ms)}</b></span>
        <span className="cwstat">のこり <b id="nc-left">{left}</b>マス</span>
        <div className="spacer"></div>
        <PauseButton id="btn-npause" onClick={pause} />
      </div>
      <div className="ncwrap"><div className="ncgrid" id="ncgrid">{cells}</div></div>
      <p className={'ncmsg' + (msg.cls ? ' ' + msg.cls : '')} id="ncmsg">{msg.text}</p>
      <div className="ncpad">
        <div className="ncnum" id="ncnum">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((n) => <button type="button" key={n} data-n={n} onClick={() => key(n)}>{n}</button>)}
          <button type="button" data-n="del" style={{ gridColumn: 'span 5', fontSize: 15, fontFamily: 'inherit', fontWeight: 700, color: 'var(--muted)' }} onClick={() => key('del')}>1つけす</button>
        </div>
        <button className="btn btn-ok" id="btn-nccheck" style={{ fontSize: 19, padding: '15px 20px' }} onClick={check}>こたえあわせ</button>
      </div>
      <PauseOverlay open={paused} info={'かかった時間 ' + fmtTime(el.now()) + ' ／ のこり ' + left + 'マス'} onResume={resume} onRestart={() => { setPaused(false); el.stop(); onRestart(); }} onQuit={() => { setPaused(false); el.stop(); onQuit(); }} />
    </section>
  );
}

export function CResultScreen({ r, onAgain, onTitle }: { r: CrossResult; onAgain: () => void; onTitle: () => void }) {
  const msg = r.kind === 'numcross' ? 'たて・よこ ぜんぶの 計算が そろいました。' : r.hints === 0 ? 'ヒントなしで かんせい！おみごと。' : 'マスを ' + r.hints + '回 開けて かんせい！';
  return (
    <section className="screen on" id="s-cresult">
      <div className="rankcard">
        <span className="rankbadge" id="cwbadge" style={{ background: '#C9961F' }}>かんせい！</span>
        <div className="bignum display" id="cw-final">{fmtTime(r.ms)}</div>
        <p className="lede" id="cw-msg" style={{ margin: 0 }}>{msg}</p>
      </div>
      <Hee prefix="cw" name={r.heeName} text={r.heeText} />
      <Promo prefix="c" />
      <button className="btn btn-go" id="btn-cagain" onClick={onAgain}>べつのもんだい</button>
      <button className="btn btn-ghost" data-back="s-title" onClick={onTitle}>さいしょの画面へ</button>
    </section>
  );
}
