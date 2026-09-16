/* フリック入力（スマホの かなキーボードと 同じ 3×4）。
   キーを おして そのまま 上下左右に すべらせると い・う・え・お。おしただけなら あ。
   「゛゜小」は 直前の文字を は→ば→ぱ→は のように まわす。「ー」は のばす音 */
import { useRef, useState } from 'react';
import type { PointerEvent as RPointerEvent } from 'react';
import { FLICK } from '../data/cross';

const DIRS = ['', 'ひだり', 'うえ', 'みぎ', 'した'];   /* FLICK の [まん中, ひだり, うえ, みぎ, した] に 対応 */
const THRESH = 16;   /* これ以上 動かしたら フリック（ピクセル） */

export interface FlickPadProps { onChar: (ch: string) => void; onCycle: () => void }

export function FlickPad({ onChar, onCycle }: FlickPadProps) {
  const [act, setAct] = useState<{ ki: number; dir: number } | null>(null);
  const start = useRef<{ ki: number; x: number; y: number; id: number } | null>(null);

  const dirOf = (dx: number, dy: number): number => {
    if (Math.abs(dx) < THRESH && Math.abs(dy) < THRESH) return 0;
    if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 1 : 3;
    return dy < 0 ? 2 : 4;
  };
  /* その方向に 文字が 無ければ まん中に もどす（や の ひだり・みぎ など） */
  const valid = (ki: number, d: number) => (FLICK[ki][d] ? d : 0);

  const down = (ki: number) => (e: RPointerEvent<HTMLButtonElement>) => {
    if (e.cancelable) e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 合成イベントでは 失敗することがある */ }
    start.current = { ki, x: e.clientX, y: e.clientY, id: e.pointerId };
    setAct({ ki, dir: 0 });
  };
  const move = (e: RPointerEvent<HTMLButtonElement>) => {
    const s = start.current; if (!s || s.id !== e.pointerId) return;
    const d = valid(s.ki, dirOf(e.clientX - s.x, e.clientY - s.y));
    setAct((a) => (a && a.dir === d ? a : { ki: s.ki, dir: d }));
  };
  const up = (e: RPointerEvent<HTMLButtonElement>) => {
    const s = start.current; if (!s || s.id !== e.pointerId) return;
    start.current = null;
    const d = valid(s.ki, dirOf(e.clientX - s.x, e.clientY - s.y));
    setAct(null);
    const ch = FLICK[s.ki][d];
    if (!ch) return;
    if (ch === '゛') onCycle(); else onChar(ch);
  };
  const cancel = (e: RPointerEvent<HTMLButtonElement>) => {
    const s = start.current; if (!s || s.id !== e.pointerId) return;
    start.current = null; setAct(null);
  };
  /* PointerEvent が 無い 古い端末：おしただけの 文字だけ 入る */
  const legacy = typeof window !== 'undefined' && !window.PointerEvent;

  return (
    <div className="flick" id="flick">
      {FLICK.map((k, ki) => {
        const isMod = k[0] === '゛';
        const on = act && act.ki === ki;
        return (
          <button type="button" key={ki} className={'fkey' + (isMod ? ' mod' : '') + (on ? ' on' : '')} data-k={k[0]}
            onPointerDown={legacy ? undefined : down(ki)} onPointerMove={legacy ? undefined : move} onPointerUp={legacy ? undefined : up} onPointerCancel={legacy ? undefined : cancel}
            onClick={legacy ? () => (isMod ? onCycle() : onChar(k[0])) : undefined}>
            <b>{isMod ? '゛゜小' : k[0]}</b>
            {!isMod && k[1] + k[2] + k[3] + k[4] ? <small>{[k[1], k[2], k[3], k[4]].filter(Boolean).join(' ')}</small> : null}
            {on && !isMod && (
              <span className="flpop" aria-hidden="true">
                {[2, 1, 0, 3, 4].map((d) => (
                  <i key={d} className={'p' + d + (act!.dir === d ? ' sel' : '') + (k[d] ? '' : ' none')} title={DIRS[d]}>{k[d]}</i>
                ))}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
