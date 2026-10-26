/* 音（ファイルなし。その場で作る。設定でオフにできる）と 振動 */
import { store } from './storage';

let AC: AudioContext | null = null;

/* ===== 音の 大きさ（4だんかい）=====
   体育館は ざわざわ して 聞こえにくい 一方、家や 静かな 教室では 大きすぎる。
   0 = なし ／ 1 = 小 ／ 2 = ふつう ／ 3 = 大。効果音と BGM を べつべつに 決める。 */
export type Vol = 0 | 1 | 2 | 3;
export const VOL_MUL: Record<Vol, number> = { 0: 0, 1: 0.45, 2: 1, 3: 1.7 };
const asVol = (v: string | null, old1: Vol, old0: Vol): Vol => {
  /* 前の ばん（'1'／'0' の 2だんかい）で 保存した ものも そのまま つかえるように する */
  if (v === '2' || v === '3') return Number(v) as Vol;
  if (v === '1') return old1;
  if (v === '0') return old0;
  return v === null ? old1 : old1;
};
let SFX: Vol = asVol(store('oyako-sound'), 2, 0);
let BGMV: Vol = store('oyako-bgm') === null ? 0 : asVol(store('oyako-bgm'), 2, 0);
/* 早押し中だけ 鳴る 音楽。たのんで 入れた ものなので はじめから「ふつう」 */
let BTV: Vol = store('oyako-bgm-battle') === null ? 2 : asVol(store('oyako-bgm-battle'), 2, 0);

export function sfxVol(): Vol { return SFX; }
export function setSfxVol(v: Vol) {
  SFX = v; store('oyako-sound', String(v));
  if (v > 0) { ac(); beep(880, 0, 0.1, 0.16); }   /* 押した合図に 1音（いまの 大きさで 鳴る） */
}
export function bgmVol(): Vol { return BGMV; }
export function setBgmVol(v: Vol) {
  BGMV = v; store('oyako-bgm', String(v));
  bgmGain(); if (v > 0) startBgm(); else stopBgm();
}

export function battleVol(): Vol { return BTV; }
export function setBattleVol(v: Vol) {
  BTV = v; store('oyako-bgm-battle', String(v));
  btGain();
  if (v <= 0) stopBattleBgm();
  else if (btPlaying) startBattleBgm();   /* 鳴っている さいちゅうなら そのまま つづける */
}

export function soundOn(): boolean { return SFX > 0; }
export function setSound(on: boolean) { setSfxVol(on ? 2 : 0); }
export function ac(): AudioContext | null {
  if (SFX <= 0) return null;
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
/* ===== 大きさ =====
   体育館や 教室は ざわざわ しているので、スマホの スピーカーでも 聞こえる 大きさに する。
   ただ 大きくすると 音が かさなった ときに われる（ひずむ）ので、
   ぜんぶの 音を 1つの つまみ（master）と リミッター（compressor）に 通してから 出す。 */
export const BOOST = 3.2;    /* 1つ1つの 音の 大きさ。ここを 変えると ぜんたいが 変わる */
export const MASTER = 0.9;   /* さいごの つまみ */
let master: GainNode | null = null;
let masterOf: AudioContext | null = null;
/** 音の 出口。かさなっても われないように リミッターを 通す */
export function out(c: AudioContext): AudioNode {
  if (master && masterOf === c) return master;
  const g = c.createGain();
  g.gain.setValueAtTime(MASTER, c.currentTime);
  const lim = c.createDynamicsCompressor();
  lim.threshold.setValueAtTime(-14, c.currentTime);
  lim.knee.setValueAtTime(18, c.currentTime);
  lim.ratio.setValueAtTime(12, c.currentTime);
  lim.attack.setValueAtTime(0.003, c.currentTime);
  lim.release.setValueAtTime(0.18, c.currentTime);
  g.connect(lim); lim.connect(c.destination);
  master = g; masterOf = c;
  return g;
}

export function beep(freq: number, at: number, dur: number, vol?: number) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + at;
  const v = Math.min(0.95, (vol || 0.16) * BOOST * VOL_MUL[SFX]);
  if (v <= 0) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'triangle'; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(out(c));
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
/* ===== しゅうりょうの 笛（「ピピー」） =====
   本物の 笛は 中の 玉が まわって 音が こまかく ふるえる。
   ・2000Hz ふきんの 2つの 音を かさねる（ぴったりでは ない ほうが 笛らしい）
   ・その 高さを 小きざみに ゆらす（玉の ふるえ）
   ・みじかい「ピ」の あと、長めの「ピー」で おわる
   音の 大きさは せっていの「効果音」で 変わる */
const WH_LO = 2050, WH_HI = 2730;
function whistleNote(c: AudioContext, at: number, dur: number, vol: number) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.014);
  g.gain.setValueAtTime(vol, at + Math.max(0.03, dur - 0.06));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  g.connect(out(c));
  /* 玉の ふるえ：音の 高さを 上下に ゆらす */
  const lfo = c.createOscillator(), lfoG = c.createGain();
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(32, at);
  lfoG.gain.setValueAtTime(48, at);
  lfo.connect(lfoG);
  [WH_LO, WH_HI].forEach((f, i) => {
    const o = c.createOscillator(), og = c.createGain();
    o.type = i ? 'sine' : 'triangle';
    o.frequency.setValueAtTime(f, at);
    lfoG.connect(o.frequency);
    og.gain.setValueAtTime(i ? 0.4 : 1, at);
    o.connect(og); og.connect(g);
    o.start(at); o.stop(at + dur + 0.02);
  });
  lfo.start(at); lfo.stop(at + dur + 0.02);
}
/** ゲームの おわりに 鳴らす 笛。「ピ」＋「ピー」 */
export function sndWhistle() {
  const c = ac(); if (!c) return;
  const v = Math.min(0.95, 0.12 * BOOST * VOL_MUL[SFX]);
  if (v <= 0) return;
  const t = c.currentTime + 0.03;
  whistleNote(c, t, 0.14, v);
  whistleNote(c, t + 0.21, 0.52, v);
}

/* ===== おてつきの 音（テレビの クイズ番組の「ブッブー」） =====
   ピーという きれいな音では なく、ざらっとした 低い ブザーに する。
   ・のこぎり波を 3つ かさねる（ぴったり 同じ音に せず すこし ずらすと「ブー」と うなる）
   ・高い音を けずって、耳に ささらない 太い音に する
   ・立ち上がりと 切れを するどく（ピーではなく ブッ）
   ・みじかい「ブッ」の あと、すこし 低い「ブー」を 長めに 鳴らす */
export const NG_HITS: [number, number, number][] = [
  /* [はじまる 時刻, ながさ, 高さ] */
  [0, 0.17, 196],
  [0.22, 0.46, 165],
];
function buzzHit(c: AudioContext, at: number, dur: number, freq: number, vol0: number) {
  const vol = Math.min(0.95, vol0 * VOL_MUL[SFX]);
  if (vol <= 0) return;
  const t = c.currentTime + at;
  const g = c.createGain();
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(1200, t);
  lp.Q.setValueAtTime(0.7, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);   /* するどく 立ち上げる */
  g.gain.setValueAtTime(vol, t + Math.max(0.02, dur - 0.04));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);  /* するどく 切る */
  g.connect(lp); lp.connect(out(c));
  /* 本体・すこし ずらした音（うなり）・1オクターブ下（太さ） */
  for (const [mul, v] of [[1, 0.55], [1.007, 0.4], [0.5, 0.28]] as const) {
    const o = c.createOscillator(), og = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(freq * mul, t);
    og.gain.setValueAtTime(v, t);
    o.connect(og); og.connect(g);
    o.start(t); o.stop(t + dur + 0.02);
  }
}
export function sndNG() {
  const c = ac(); if (!c) return;
  for (const [at, dur, f] of NG_HITS) buzzHit(c, at, dur, f, 0.9);
}
export function buzz(ms: number | number[]) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* 対応なし */ } }


/* 早押しの 音楽が 鳴っているか（下の「早押しの 音楽」で 使う）。
   ふつうの BGM と 重ならないように、ここで 先に 持っておく */
let btPlaying = false;

/* ================= BGM（ファイルなし。その場で 作る しずかな くりかえし） ================= */
/* はじめは オフ（会場で うるさく ならないように）。大きさは BGMV で 決める */
let bgmG: GainNode | null = null;
let bgmGOf: AudioContext | null = null;
/** BGM だけの つまみ。効果音の じゃまを しない 高さに して おく */
function bgmOut(c: AudioContext): AudioNode {
  if (!bgmG || bgmGOf !== c) {
    bgmG = c.createGain(); bgmGOf = c;
    bgmG.connect(out(c));
  }
  bgmG.gain.setValueAtTime(VOL_MUL[BGMV], c.currentTime);
  return bgmG;
}
/** せっていで 大きさを かえたら すぐ 反映する */
function bgmGain() {
  const c = AC; if (!c || !bgmG || bgmGOf !== c) return;
  bgmG.gain.setValueAtTime(VOL_MUL[BGMV], c.currentTime);
}
let bgmTimer: number | null = null;
let bgmStep = 0;
/* 4小節ぶんの やさしい 和音。1拍 = 0.5秒 */
const BGM_CHORD: number[][] = [
  [262, 330, 392], [294, 349, 440], [220, 262, 330], [247, 311, 392],
];

export function bgmOn(): boolean { return BGMV > 0; }
export function setBgm(on: boolean) { setBgmVol(on ? 2 : 0); }
/** 画面を さわった あとに よぶ（さわる前は ブラウザが 音を 出させてくれない） */
export function startBgm() {
  /* 早押しの 音楽が 鳴っている あいだは 重ねない */
  if (BGMV <= 0 || bgmTimer || btPlaying) return;
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
  o.connect(g); g.connect(bgmOut(c));   /* BGM だけの つまみを 通してから 出口へ */
  o.start(t); o.stop(t + 0.95);
}

/* ================= 早押しの 音楽（対決らしく、少し せかす） =================
   クイズ番組の「考えている あいだ」の 音を ねらう。
   ・低い音を 1拍ずつ 刻みつづける（時計のように せかす）
   ・上に 短調の 音を のせる（明るくしない＝きんちょう感）
   ・4小節ごとに 1音ずつ 上がって、もどる（じわじわ 追いこまれる感じ）
   まちがい直しでは 鳴らさない（早さを きそう ものでは ないので）。 */
const BT_STEP_MS = 280;          /* 1拍。ふつうの BGM（500）より ずっと 速い */
const BT_BASS = [110, 110, 164.81, 110];              /* ラ ラ ミ ラ（低い刻み） */
const BT_TOP = [440, 523.25, 587.33, 523.25];         /* ラ ド レ ド（短調） */
const BT_RISE = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4];  /* 終わりで 半音ずつ 上がる */
const semi = (f: number, n: number) => f * Math.pow(2, n / 12);

let btG: GainNode | null = null;
let btGOf: AudioContext | null = null;
let btTimer: number | null = null;
let btStep = 0;

/** 早押しの 音楽だけの つまみ */
function btOut(c: AudioContext): AudioNode {
  if (!btG || btGOf !== c) {
    btG = c.createGain(); btGOf = c;
    btG.connect(out(c));
  }
  btG.gain.setValueAtTime(VOL_MUL[BTV], c.currentTime);
  return btG;
}
function btGain() {
  const c = AC; if (!c || !btG || btGOf !== c) return;
  btG.gain.setValueAtTime(VOL_MUL[BTV], c.currentTime);
}

/** 早押しが はじまったら よぶ。ふつうの BGM は 止める（重ならないように） */
export function startBattleBgm() {
  btPlaying = true;
  stopBgm();
  if (BTV <= 0 || btTimer) return;
  const c = actx(); if (!c) return;
  if (c.state === 'suspended') c.resume();
  btStep = 0;
  btTick();
  btTimer = window.setInterval(btTick, BT_STEP_MS);
}
/** 早押しが おわったら よぶ。ふつうの BGM に もどす */
export function stopBattleBgm() {
  btPlaying = false;
  if (btTimer) { clearInterval(btTimer); btTimer = null; }
  startBgm();
}
function btTick() {
  const c = actx(); if (!c) return;
  const i = btStep % 16;
  const up = BT_RISE[i];
  /* 低い刻み：毎拍。4拍目だけ 少し 強く（小節の 頭が わかる） */
  btNote(c, semi(BT_BASS[i % 4], up), i % 4 === 0 ? 0.085 : 0.055, 0.16, 'square', 420);
  /* 上の音：2拍に 1回 */
  if (i % 2 === 0) btNote(c, semi(BT_TOP[(i / 2) % 4], up), 0.05, 0.22, 'triangle', 2600);
  btStep = (btStep + 1) % 16;
}
function btNote(c: AudioContext, freq: number, vol: number, dur: number, type: OscillatorType, lp: number) {
  const t = c.currentTime;
  const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.setValueAtTime(lp, t); f.Q.setValueAtTime(0.6, t);
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);   /* するどく 立ち上げる＝刻みに 聞こえる */
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f); f.connect(g); g.connect(btOut(c));
  o.start(t); o.stop(t + dur + 0.02);
}
