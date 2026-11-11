/* 学年に あわせて 漢字か ひらがなかを 決める。
   きまり：ふりがな記法「漢字{よみ}」の かたまりごとに、
   ・その学年までに ならう 漢字だけ なら → 漢字 を そのまま 出す
   ・1字でも まだ ならっていない 漢字が あれば → ひらがな（よみ）で 出す
   こうすると 1年生は ほとんど ひらがな、6年生は ほとんど 漢字に なる。
   ルビ（ふりがな）は 出さない。読めない字を 出さない のが ねらい。 */
import { KANJI_BY_GRADE } from '../data/kanji-grades';
import type { Level } from './types';

/* その学年までに ならう 漢字（1年＝80字、6年＝1026字） */
const UPTO: Record<number, Set<string>> = (() => {
  const m: Record<number, Set<string>> = {};
  let all = '';
  for (let g = 1; g <= 6; g++) { all += KANJI_BY_GRADE[g] || ''; m[g] = new Set(all); }
  return m;
})();

/* いま あそんでいる 学年。画面を 出す たびに App が 入れなおす */
let G: Level = 6;
export function setGrade(g: Level) { G = g; }
export function gradeNow(): Level { return G; }

/** その学年までに ならう 漢字だけで できているか（漢字が 無ければ true） */
export function readable(s: string, g: Level = G): boolean {
  const set = UPTO[g] || UPTO[6];
  for (const c of s) if (/[一-鿿]/.test(c) && !set.has(c)) return false;
  return true;
}

/** 小学校（1〜6年）で ならう 漢字だけで できているか。
    「鎌」「江」「秀」のような 中学いじょうの 漢字が 入っていると false。
    こういう ことばは 歴史の 教科書でも 漢字で 書くので、ひらがなに せず
    漢字の 上に 読みがなを つけて 出す。 */
export function schoolKanji(s: string): boolean {
  const all = UPTO[6];
  for (const c of s) if (/[一-鿿]/.test(c) && !all.has(c)) return false;
  return true;
}

/** その ことばを どう 出すか
    'kanji' … 漢字の まま（その学年までに ならう 字だけ）
    'kana'  … ひらがな（小学校で ならう 字だが まだ ならっていない）
    'ruby'  … 漢字＋読みがな（小学校で ならわない 字を ふくむ） */
export type Show = 'kanji' | 'kana' | 'ruby';
export function showAs(s: string, g: Level = G): Show {
  if (readable(s, g)) return 'kanji';
  return schoolKanji(s) ? 'kana' : 'ruby';
}
