/* ふりがな。データの文には 「漢字{よみ}」の形で 読みが 入っている。
   plain() は かっこを はずすだけ（記録の キーなどに つかう ので 学年で 変わらない）。
   gradeText() は 学年に あわせて 漢字か ひらがなかを えらぶ（src/game/grade.ts）。
   画面に 出すものは すべて gradeText() を 通る。 */
import { esc } from './util';
import { showAs } from './grade';

export const FURI_RE = /([一-鿿々〆ヶ]+)\{([ぁ-ゟー]+)\}/g;

export function plain(str: string | undefined | null): string {
  return (str || '').replace(FURI_RE, '$1');
}

/** 文を「ふつうの 文字」と「漢字の かたまり」に 分ける。
    かたまりは 学年に あわせて 漢字／ひらがな／漢字＋読みがな の どれかに なる */
export interface Piece { text: string; ruby?: string }
export function pieces(str: string | undefined | null): Piece[] {
  const out: Piece[] = [];
  if (!str) return out;
  let last = 0, m: RegExpExecArray | null;
  const re = new RegExp(FURI_RE.source, 'g');
  while ((m = re.exec(str)) !== null) {
    if (m.index > last) out.push({ text: str.slice(last, m.index) });
    const how = showAs(m[1]);
    out.push(how === 'kana' ? { text: m[2] } : how === 'ruby' ? { text: m[1], ruby: m[2] } : { text: m[1] });
    last = m.index + m[0].length;
    /* 「南部鉄器{なんぶてっき}（なんぶてっき）」のように 後ろに 同じ読みの かっこが 続くとき、
       ひらがなに したり 読みがなを つけたり すると 二重に なるので かっこを 消す。
       漢字の ままの ときは 読みが どこにも 出ないので のこす */
    const par = /^[（(]([^）)]*)[）)]/.exec(str.slice(last));
    if (par && par[1].replace(/\s|　/g, '') === m[2].replace(/\s|　/g, '') && how !== 'kanji') last += par[0].length;
  }
  if (last < str.length) out.push({ text: str.slice(last) });
  return out;
}

/** 画面に 出る 文字（読みがなは 数に 入れない） */
export function gradeText(str: string | undefined | null): string {
  return pieces(str).map((p) => p.text).join('');
}

function html(ps: Piece[]): string {
  return ps.map((p) => p.ruby ? '<ruby>' + esc(p.text) + '<rt>' + esc(p.ruby) + '</rt></ruby>' : esc(p.text)).join('');
}

export function furi(str: string | undefined | null): string {
  return html(pieces(str));
}

/** こたえの 表示（文字だけ）。ひらがなに するのは 小学校で ならう 字の ときだけ */
export function gradeName(name: string, yomi: string | undefined | null): string {
  if (!yomi || !/[一-鿿]/.test(name)) return name;
  return showAs(name) === 'kana' ? yomi : name;
}

/** こたえの 表示（HTML）。小学校で ならわない 字を ふくむ ことばは 漢字＋読みがな */
export function furiName(name: string, yomi: string): string {
  if (!yomi || !/[一-鿿]/.test(name)) return esc(name);
  const how = showAs(name);
  return how === 'kana' ? esc(yomi)
    : how === 'ruby' ? '<ruby>' + esc(name) + '<rt>' + esc(yomi) + '</rt></ruby>'
      : esc(name);
}

/** 親子ヒントリレーの こたえ表示（エスケープはしない。中身は 同じ きまり） */
export function nameHTML(name: string, yomi: string): string {
  return furiName(name, yomi);
}

/** 画面に 出る 文字数（少しずつ 出すときの ものさし）。学年で 変わる */
export function plainLen(str: string | undefined | null): number {
  return gradeText(str).length;
}

/** 先頭から n文字ぶんだけ 切り出す。ルビは 途中で 割らずに まるごと 出す。
    クイズ番組のように 問題文を 左から 少しずつ 出すために つかう */
export function cutFuri(str: string | undefined | null, n: number): string {
  if (!str || n <= 0) return '';
  const ps = pieces(str);
  const out: Piece[] = [];
  let used = 0;
  for (const p of ps) {
    if (used >= n) break;
    if (p.ruby) { out.push(p); used += p.text.length; continue; }   /* 読みがなつきは 割らずに まるごと */
    const room = n - used;
    if (p.text.length <= room) { out.push(p); used += p.text.length; }
    else { out.push({ text: p.text.slice(0, room) }); used = n; }
  }
  return html(out);
}
