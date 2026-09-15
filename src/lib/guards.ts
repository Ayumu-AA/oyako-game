/* 画面が勝手に拡大しないようにする。
   2人で同時に連打すると 指2本＝ピンチ と判定されて 画面がズームしてしまう。
   ちずクイズの地図だけは 自前のピンチ処理があるので そこは通す。 */
import { ac } from './sound';

function inMap(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return !!(el && el.closest && el.closest('#geo-map,.mapsvg'));
}

let installed = false;
export function installGuards() {
  if (installed) return; installed = true;
  /* iOS Safari のピンチ拡大 */
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((t) => {
    document.addEventListener(t, (e) => { e.preventDefault(); }, { passive: false });
  });
  /* 指2本の動き（＝ピンチ）。地図の中は そのまま */
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1 && !inMap(e.target)) e.preventDefault();
  }, { passive: false });
  /* ダブルタップ拡大よけ。押した場所が違えば連打なので 止めない
     （同じボタンの連打は click を殺さないよう preventDefault しない） */
  let lastEnd = 0, lastX = 0, lastY = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now(), t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    const near = Math.abs(t.clientX - lastX) < 32 && Math.abs(t.clientY - lastY) < 32;
    const el = e.target as HTMLElement;
    if (now - lastEnd < 320 && near && !(el.closest && el.closest('button,input,textarea,[contenteditable]'))) {
      e.preventDefault();
    }
    lastEnd = now; lastX = t.clientX; lastY = t.clientY;
  }, { passive: false });
  /* iPhone は 画面を1回さわるまで 音を鳴らせないので、最初のタップで用意しておく */
  document.addEventListener('pointerdown', function once() { ac(); document.removeEventListener('pointerdown', once); });
}
