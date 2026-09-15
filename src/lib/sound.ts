/* 音（ファイルなし。その場で作る。設定でオフにできる）と 振動 */
import { store } from './storage';

let AC: AudioContext | null = null;
let SOUND = store('oyako-sound') !== '0';

export function soundOn(): boolean { return SOUND; }
export function setSound(on: boolean) {
  SOUND = on; store('oyako-sound', on ? '1' : '0');
  if (on) { ac(); beep(880, 0, 0.1, 0.12); }     /* 押した合図に 1音 */
}
export function ac(): AudioContext | null {
  if (!SOUND) return null;
  try {
    const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const Ctor = W.AudioContext || W.webkitAudioContext;
    if (!Ctor) return null;
    if (!AC) AC = new Ctor();
    if (AC.state === 'suspended') AC.resume();
    return AC;
  } catch { return null; }
}
export function beep(freq: number, at: number, dur: number, vol?: number) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + at;
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'triangle'; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol || 0.16, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
export function sndOK(n: number) {
  if (n >= 5) { [784, 988, 1175, 1568].forEach((f, i) => { beep(f, i * 0.075, 0.22, 0.15); }); }
  else if (n >= 3) { beep(784, 0, 0.12, 0.16); beep(1175, 0.085, 0.22, 0.15); }
  else { beep(659, 0, 0.10, 0.15); beep(988, 0.075, 0.18, 0.14); }
}
export function sndNG() { beep(196, 0, 0.16, 0.12); }
export function buzz(ms: number | number[]) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* 対応なし */ } }
