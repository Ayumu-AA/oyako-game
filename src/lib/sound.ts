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
  return actx();
}
/** 音を 出す もと。効果音の オン・オフとは 切りはなす（BGM が つかう） */
export function actx(): AudioContext | null {
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
/* 連続正解で 音が どんどん 豪華になる。1〜2＝みじかい2音、3〜4＝3音、5〜6＝4音の 上がり、
   7〜9＝さらに 高いところまで、10以上＝きらきらの 仕上げ音つき */
export function sndOK(n: number) {
  if (n >= 10) {
    [784, 988, 1175, 1568, 1976, 2349].forEach((f, i) => beep(f, i * 0.055, 0.26, 0.15));
    [2637, 3136].forEach((f, i) => beep(f, 0.40 + i * 0.07, 0.34, 0.10));   /* きらきら */
    beep(392, 0, 0.5, 0.07);                                                /* 下ざさえ */
  } else if (n >= 7) {
    [784, 988, 1175, 1568, 1976].forEach((f, i) => beep(f, i * 0.065, 0.24, 0.15));
    beep(392, 0, 0.42, 0.06);
  } else if (n >= 5) {
    [784, 988, 1175, 1568].forEach((f, i) => beep(f, i * 0.075, 0.22, 0.15));
  } else if (n >= 3) {
    beep(784, 0, 0.12, 0.16); beep(1175, 0.085, 0.22, 0.15);
  } else {
    beep(659, 0, 0.10, 0.15); beep(988, 0.075, 0.18, 0.14);
  }
}
export function sndNG() { beep(196, 0, 0.16, 0.12); }
export function buzz(ms: number | number[]) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* 対応なし */ } }


/* ================= BGM（ファイルなし。その場で 作る しずかな くりかえし） ================= */
let BGM = store('oyako-bgm') === '1';   /* 会場で うるさくならないよう、はじめは オフ */
let bgmTimer: number | null = null;
let bgmStep = 0;
/* 4小節ぶんの やさしい 和音。1拍 = 0.5秒 */
const BGM_CHORD: number[][] = [
  [262, 330, 392], [294, 349, 440], [220, 262, 330], [247, 311, 392],
];

export function bgmOn(): boolean { return BGM; }
export function setBgm(on: boolean) {
  BGM = on; store('oyako-bgm', on ? '1' : '0');
  if (on) startBgm(); else stopBgm();
}
/** 画面を さわった あとに よぶ（さわる前は ブラウザが 音を 出させてくれない） */
export function startBgm() {
  if (!BGM || bgmTimer) return;
  const c = actx(); if (!c) return;
  if (c.state === 'suspended') c.resume();
  bgmTick();
  bgmTimer = window.setInterval(bgmTick, 500);
}
export function stopBgm() {
  if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
}
function bgmTick() {
  const c = actx(); if (!c) return;
  const chord = BGM_CHORD[Math.floor(bgmStep / 4) % BGM_CHORD.length];
  const note = chord[bgmStep % 3];
  bgmNote(c, note, bgmStep % 4 === 0 ? 0.055 : 0.032);
  if (bgmStep % 4 === 0) bgmNote(c, chord[0] / 2, 0.04);   /* 小節あたまに 低い音 */
  bgmStep = (bgmStep + 1) % 16;
}
function bgmNote(c: AudioContext, freq: number, vol: number) {
  const t = c.currentTime;
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.06);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  o.connect(g); g.connect(c.destination);
  o.start(t); o.stop(t + 0.95);
}
