/* 小さな部品 */
import { useEffect, useRef, type ReactNode } from 'react';
import { plowMark } from '../data/logo';
import { CONFIG } from '../data/texts';

/** SVG文字列などを そのまま入れる */
export function Raw({ html, as: Tag = 'span', className, id, hidden, style }: { html: string; as?: keyof HTMLElementTagNameMap; className?: string; id?: string; hidden?: boolean; style?: React.CSSProperties }) {
  const T = Tag as unknown as 'span';
  return <T id={id} className={className} hidden={hidden} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** 2〜4列の えらぶボタン */
export function PickGrid<T extends string | number>({ id, label, cols, value, options, onPick, className }: {
  id: string; label: string; cols: 2 | 3 | 4; value: T;
  options: { v: T; b: ReactNode; s?: ReactNode }[]; onPick: (v: T) => void; className?: string;
}) {
  return (
    <div className={'pickrow' + (className ? ' ' + className : '')} id={'row-' + id.replace(/^seg-/, '')}>
      <span className="picklabel">{label}</span>
      <div className={'pickgrid c' + cols} id={id} role="group" aria-label={label}>
        {options.map((o) => (
          <button type="button" key={String(o.v)} aria-pressed={o.v === value} onClick={() => onPick(o.v)} data-v={String(o.v)}>
            {o.s ? <><b>{o.b}</b><small>{o.s}</small></> : o.b}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PauseButton({ id, onClick }: { id: string; onClick: () => void }) {
  return (
    <button className="iconbtn" id={id} type="button" aria-label="一時停止" onClick={onClick}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="5" height="16" rx="1.5" /><rect x="14" y="4" width="5" height="16" rx="1.5" /></svg>
    </button>
  );
}

export function Hud({ fillId, timeId, scoreId, ratio, warn, timeText, score, onPause, pauseId, chipRef }: {
  fillId: string; timeId: string; scoreId: string; ratio: number; warn: boolean; timeText: string | number; score: string | number; onPause: () => void; pauseId: string; chipRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="hud">
      <div className="timerwrap">
        <div className="timerbar"><div className={'timerfill' + (warn ? ' warn' : '')} id={fillId} style={{ width: (ratio * 100).toFixed(1) + '%' }} /></div>
        <span className="timertext" id={timeId}>{timeText}</span>
      </div>
      <div className="scorechip" ref={chipRef}><span id={scoreId}>{score}</span><span style={{ fontSize: 13 }}> もん</span></div>
      <PauseButton id={pauseId} onClick={onPause} />
    </div>
  );
}

/** 一時ていし */
export function PauseOverlay({ open, info, onResume, onRestart, onQuit }: { open: boolean; info: string; onResume: () => void; onRestart: () => void; onQuit: () => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) btn.current?.focus(); }, [open]);
  return (
    <div className="overlay" id="overlay" hidden={!open} role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <div className="sheet">
        <h2 className="display" id="pause-title">一時ていし中</h2>
        <p id="pause-info">{info}</p>
        <button className="btn btn-ok" id="btn-resume" style={{ fontSize: 19 }} ref={btn} onClick={onResume}>つづける</button>
        <button className="btn btn-sea" id="btn-restart" onClick={onRestart}>さいしょから やりなおす</button>
        <button className="btn btn-ghost" id="btn-quit" onClick={onQuit}>タイトルにもどる</button>
        <small>やりなおす・もどると、いまの点数は消えます</small>
      </div>
    </div>
  );
}

export function Promo({ prefix = '' }: { prefix?: string }) {
  return (
    <div className="promo">
      <b id={prefix + 'promo-name'}><Raw as="span" className="footmark" html={plowMark(17)} />{CONFIG.schoolName}</b>
      <p id={prefix + 'promo-text'}>{CONFIG.promoText}</p>
    </div>
  );
}

export function Hee({ name, text, prefix = '' }: { name: string; text: string; prefix?: string }) {
  return (
    <div className="hee">
      <p className="eyebrow">きょうの へぇ</p>
      <p className="hee-name display" id={prefix + 'hee-name'}>{name}</p>
      <p id={prefix + 'hee-text'}>{text}</p>
    </div>
  );
}

/** 結果画面が出たばかりのあいだ ボタンを押せなくする（連打で結果を飛ばさないため） */
export function useResultLock(ms: number): number {
  const [left, setLeft] = useState(Math.ceil(ms / 1000));
  useEffect(() => {
    setLeft(Math.ceil(ms / 1000));
    const iv = setInterval(() => { setLeft((l) => { if (l <= 1) { clearInterval(iv); return 0; } return l - 1; }); }, 1000);
    return () => clearInterval(iv);
  }, [ms]);
  return left;
}
import { useState } from 'react';

/** Escape で 一時停止/再開、タブが隠れたら 一時停止 */
export function usePauseKeys(paused: boolean, pause: () => void, resume: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; if (paused) resume(); else pause(); };
    const onVis = () => { if (document.hidden) pause(); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis); };
  }, [paused, pause, resume]);
}
