/* 受付番号を きく シート。受付で 渡した 番号札（例「6-12」）の うしろの 数だけを 入れてもらう。
   ほんとうの なまえは どこにも 入れない（名簿は 番号で 突き合わせる）。
   小さい子でも 押せるように、キーボードを 出さず 大きな テンキーに する */
import { useEffect, useState } from 'react';
import type { Level } from '../game/types';
import { parseSeat, SEAT_NONE } from '../lib/seat';

export function SeatSheet({ open, level, onDone }: {
  open: boolean; level: Level; onDone: (no: number) => void;
}) {
  const [v, setV] = useState('');
  useEffect(() => { if (open) setV(''); }, [open, level]);
  const no = parseSeat(v);
  const push = (d: string) => setV((t) => (t.length >= 3 ? t : (t + d).replace(/^0+/, '')));
  return (
    <div className="overlay" id="seat-ov" hidden={!open} role="dialog" aria-modal="true" aria-labelledby="seat-title">
      <div className="sheet seatsheet">
        <h2 className="display" id="seat-title">ばんごうふだは？</h2>
        <p className="seatwarn">ほんとうの なまえは いれないでね</p>
        <p className="seatlede">うけつけで もらった ふだの、うしろの かずを おしてね。</p>
        <div className="seatview" id="seat-view" aria-live="polite">
          <b>{level}</b><i>-</i><span className={v ? '' : 'yet'}>{v || '？'}</span>
        </div>
        <div className="seatpad" id="seat-pad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button type="button" key={d} className="skey" id={'seat-' + d} onClick={() => push(d)}>{d}</button>
          ))}
          <button type="button" className="skey sub" id="seat-clear" onClick={() => setV('')}>ぜんぶ<small>けす</small></button>
          <button type="button" className="skey" id="seat-0" onClick={() => push('0')}>0</button>
          <button type="button" className="skey sub" id="seat-back" onClick={() => setV((t) => t.slice(0, -1))}>←<small>1つ けす</small></button>
        </div>
        <button className="btn btn-ok" id="btn-seat-ok" disabled={!no} onClick={() => { if (no) onDone(no); }}>これで！</button>
        <button className="btn btn-ghost" id="btn-seat-skip" onClick={() => onDone(SEAT_NONE)}>ふだを もっていない</button>
      </div>
    </div>
  );
}
