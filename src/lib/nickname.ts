/* ランキングに出す名前。ひらがなだけ・2〜6文字。
   本名らしさは 機械では 防げないので、画面には「ほんとうの なまえは いれないでね」を 常に 出す。
   NGワードは ①この中の表 ②サーバーの ng_words（起動時に 取りこむ。Dashboard から 足せる）の 両方で 見る。
   サーバー側にも 同じ判定（supabase/002_nickname.sql）が あるので、ここを すりぬけても 表には 出ない */
import { store } from './storage';
import { rng } from '../game/util';

export const NICK_KEY = 'oyako-nick';
export const NG_KEY = 'oyako-ng';          /* サーバーの NGワード（JSON 配列）の 控え */
export const NICK_MIN = 2, NICK_MAX = 6;

/* ぁ〜ん・ー・ゔ。小書きも ふくむ */
const HIRA = /^[ぁ-ゖー]+$/;

/* 部分一致で はじく。下品な語・性的な語・病気・差別語・傷つける語・自傷。足すときは ひらがなで。
   短すぎる語は ふつうの名前まで はじくので 入れない（例：「がん」は「がんばる」に 当たる） */
export const NG_WORDS = [
  /* 暴力・自傷 */
  'しね', 'ころす', 'ころし', 'ぶっころ', 'じさつ', 'しにたい', 'きえろ', 'くたばれ', 'ひとごろし', 'ころせ',
  /* 侮辱 */
  'ばか', 'あほ', 'くそ', 'くず', 'ごみ', 'ぶす', 'でぶ', 'はげ', 'きもい', 'きもちわる', 'ぶさいく', 'ぶさ', 'ぼけ', 'まぬけ', 'のろま', 'うすのろ', 'へたくそ', 'ぶた', 'くさい', 'うざい', 'うぜえ', 'だっさ', 'ださい',
  /* 排泄 */
  'うんこ', 'うんち', 'おしっこ', 'しっこ', 'げり', 'げろ', 'おなら', 'けつ', 'ちんかす',
  /* 性的 */
  'ちんこ', 'ちんちん', 'ちんぽ', 'まんこ', 'おっぱい', 'ぱいおつ', 'せっくす', 'せくす', 'ぺにす', 'ちくび', 'きんたま', 'おなに', 'えっち', 'えろ', 'ぼっき', 'あなる', 'ふぇら', 'れいぷ', 'ごうかん', 'ちかん', 'ろりこん', 'ほうけい', 'いんもう', 'ふうぞく', 'ふぁっく', 'びっち', 'そーぷ', 'あいじん',
  /* 病気（ふざけて 入れる人が いる） */
  'りんびょう', 'ばいどく', 'えいず', 'えぼら', 'ころな', 'せいびょう', 'こうもん', 'ぺすと', 'びょうき', 'しょうがい', 'にんちしょう', 'せいしんびょう',
  /* 差別 */
  'きちがい', 'びっこ', 'かたわ', 'つんぼ', 'めくら', 'くろんぼ', 'どじん', 'とうさつ',
];

/* 判定用の 正規化：小書き→大きく、ー と 空白を 消す、のばす音を 消す（「びょう」→「びよ」、「せい」→「せ」）。
   「りんびょー」「りんびょう」「リンビョウ」「りんびよう」が ぜんぶ 同じに なる。
   supabase/002_nickname.sql の nick_norm() と 同じ 手順にしてある（片方を 変えたら もう片方も） */
const SMALL: Record<string, string> = { 'ぁ': 'あ', 'ぃ': 'い', 'ぅ': 'う', 'ぇ': 'え', 'ぉ': 'お', 'ゃ': 'や', 'ゅ': 'ゆ', 'ょ': 'よ', 'っ': 'つ', 'ゎ': 'わ' };
const ROWS: [string, string][] = [
  ['あかさたなはまやらわがざだばぱ', 'あ'], ['いきしちにひみりぎじぢびぴ', 'い'], ['うくすつぬふむゆるぐずづぶぷゔ', 'う'],
  ['えけせてねへめれげぜでべぺ', 'いえ'], ['おこそとのほもよろをごぞどぼぽ', 'うお'],
];
export function toHira(s: string): string { return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60)); }
export function normNick(s: string): string {
  let v = toHira(s || '').replace(/[\s　ー]/g, '').replace(/[ぁぃぅぇぉゃゅょっゎ]/g, (c) => SMALL[c] || c);
  for (const [cls, vow] of ROWS) v = v.replace(new RegExp('([' + cls + '])[' + vow + ']+', 'g'), '$1');
  return v;
}

let extraNg: string[] = [];
function loadExtra(): string[] { try { const a = JSON.parse(store(NG_KEY) || '[]'); return Array.isArray(a) ? a.map(String) : []; } catch { return []; } }
/** サーバーの NGワードを 差しかえる（sync が 起動時に 呼ぶ）。localStorage にも 控える */
export function setExtraNg(words: string[]) {
  extraNg = words.map(normNick).filter(Boolean);
  try { store(NG_KEY, JSON.stringify(words)); } catch { /* 容量 */ }
}
const NG_NORM = NG_WORDS.map(normNick);
export function isNg(v: string): boolean {
  const n = normNick(v);
  if (!extraNg.length) extraNg = loadExtra().map(normNick);
  return NG_NORM.some((w) => n.includes(w)) || extraNg.some((w) => w && n.includes(w));
}

export type NickCheck = { ok: true; value: string } | { ok: false; reason: string };

/** 入力を ととのえて 判定する。カタカナは ひらがなに、空白は 取りのぞく */
export function checkNick(raw: string): NickCheck {
  const v = toHira((raw || '').replace(/[\s　]/g, ''));
  if (!v) return { ok: false, reason: 'なまえを いれてね' };
  if (!HIRA.test(v)) return { ok: false, reason: 'ひらがなだけで いれてね' };
  if (v.length < NICK_MIN) return { ok: false, reason: NICK_MIN + 'もじ いじょうに してね' };
  if (v.length > NICK_MAX) return { ok: false, reason: NICK_MAX + 'もじ までに してね' };
  if (isNg(v)) return { ok: false, reason: 'そのことばは つかえないよ' };
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
