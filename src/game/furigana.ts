/* ふりがな。データの文には 「漢字{よみ}」の形で 読みが 入っている。
   plain() は かっこを はずすだけ、furi() は ルビ（HTML）に 変える。 */
import { esc } from './util';

export const FURI_RE = /([一-鿿々〆ヶ]+)\{([ぁ-ゟー]+)\}/g;

export function plain(str: string | undefined | null): string {
  return (str || '').replace(FURI_RE, '$1');
}

export function furi(str: string | undefined | null): string {
  if (!str) return '';
  let out = '', last = 0, m: RegExpExecArray | null;
  const re = new RegExp(FURI_RE.source, 'g');
  while ((m = re.exec(str)) !== null) {
    out += esc(str.slice(last, m.index));
    out += '<ruby>' + esc(m[1]) + '<rt>' + esc(m[2]) + '</rt></ruby>';
    last = m.index + m[0].length;
    /* 「南部鉄器（なんぶてっき）」のように 後ろに 同じ読みの かっこが 続くときは
       ルビと 二重になるので かっこのほうを 消す */
    const par = /^[（(]([^）)]*)[）)]/.exec(str.slice(last));
    if (par && par[1].replace(/\s|　/g, '') === m[2].replace(/\s|　/g, '')) last += par[0].length;
  }
  out += esc(str.slice(last));
  return out;
}

/** こたえは yomi を そのまま ルビに（データに 読みが 入っている） */
export function furiName(name: string, yomi: string): string {
  return /[一-鿿]/.test(name) ? '<ruby>' + esc(name) + '<rt>' + esc(yomi) + '</rt></ruby>' : esc(name);
}

/** 親子ヒントリレーの こたえ表示（v1 の nameHTML と同じ。エスケープはしない） */
export function nameHTML(name: string, yomi: string): string {
  return /[一-鿿]/.test(name) ? '<ruby>' + name + '<rt>' + yomi + '</rt></ruby>' : name;
}
