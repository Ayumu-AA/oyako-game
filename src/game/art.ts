/* 絵（国旗・イラスト）を SVG/IMG の文字列にする。描画側は dangerouslySetInnerHTML で入れる */
import { flagSVG } from '../data/flags';
import { IMAGES } from '../data/images';
import { ART } from '../data/questions';
import type { Art } from './types';

export { flagSVG };

export function artSVG(key: string): string {
  const img = (IMAGES as Record<string, string>)[key];
  if (img) return '<img src="' + img + '" alt="">';
  return '<svg viewBox="0 0 60 60" role="img" aria-label="絵">' + ((ART as Record<string, string>)[key] || '') + '</svg>';
}

export function hasArt(key: string | undefined): boolean {
  if (!key) return false;
  return !!((IMAGES as Record<string, string>)[key] || (ART as Record<string, string>)[key]);
}

export function artHTML(art: Art | null | undefined): string {
  if (!art) return '';
  return art.t === 'flag' ? flagSVG(art.k) : artSVG(art.k);
}
