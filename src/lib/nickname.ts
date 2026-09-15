/* ランキングに出す名前。ひらがなだけ・2〜6文字。
   本名らしさは 機械では 防げないので、画面には「ほんとうの なまえは いれないでね」を 常に 出す */
import { store } from './storage';
import { rng } from '../game/util';

export const NICK_KEY = 'oyako-nick';
export const NICK_MIN = 2, NICK_MAX = 6;

/* ぁ〜ん・ー・ゔ。小書きも ふくむ */
const HIRA = /^[ぁ-ゖー]+$/;

/* 部分一致で はじく。下品な語・差別語・傷つける語。足すときは ひらがなで */
export const NG_WORDS = [
  'しね', 'ころす', 'ばか', 'あほ', 'くそ', 'うんこ', 'うんち', 'ちんこ', 'ちんちん', 'まんこ', 'おっぱい', 'せっくす',
  'きもい', 'きもち', 'ぶす', 'でぶ', 'はげ', 'ちび', 'くず', 'かす', 'ごみ', 'きちがい', 'びっこ', 'かたわ',
  'ぶさいく', 'ぶさ', 'しょうがい', 'びょうき', 'ころし', 'ぶっころ', 'じさつ', 'ふぁっく', 'ぺにす', 'ちくび',
];

export type NickCheck = { ok: true; value: string } | { ok: false; reason: string };

/** 入力を ととのえて 判定する。カタカナは ひらがなに、空白は 取りのぞく */
export function checkNick(raw: string): NickCheck {
  const v = (raw || '').replace(/[\s　]/g, '').replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  if (!v) return { ok: false, reason: 'なまえを いれてね' };
  if (!HIRA.test(v)) return { ok: false, reason: 'ひらがなだけで いれてね' };
  if (v.length < NICK_MIN) return { ok: false, reason: NICK_MIN + 'もじ いじょうに してね' };
  if (v.length > NICK_MAX) return { ok: false, reason: NICK_MAX + 'もじ までに してね' };
  if (NG_WORDS.some((w) => v.includes(w))) return { ok: false, reason: 'そのことばは つかえないよ' };
  return { ok: true, value: v };
}

/* 最初に 入れておく 候補。「いろ＋いきもの」で 2〜6文字に おさまる 組み合わせだけ */
const COLORS = ['あか', 'あお', 'きいろ', 'みどり', 'しろ', 'くろ', 'もも', 'きん', 'ぎん', 'そら'];
const ANIMALS = ['かに', 'ねこ', 'いぬ', 'うさぎ', 'きつね', 'たぬき', 'くま', 'ぱんだ', 'ぺんぎん', 'りす', 'さる', 'ぞう', 'とり', 'かめ', 'らいおん'];
export function suggestNick(): string {
  for (let i = 0; i < 20; i++) {
    const c = COLORS[Math.floor(rng() * COLORS.length)], a = ANIMALS[Math.floor(rng() * ANIMALS.length)];
    const cands = [c + 'の' + a, c + a];
    for (const v of cands) if (v.length <= NICK_MAX && checkNick(v).ok) return v;
  }
  return 'みどりのかに';
}

export function getNick(): string | null { return store(NICK_KEY) || null; }
export function setNickLocal(v: string) { store(NICK_KEY, v); }
