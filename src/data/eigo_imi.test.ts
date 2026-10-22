/* えいごの 逆向き（英単語 → 日本語）で つかう いみの テスト */
import { describe, it, expect } from 'vitest';
import { EIGO_IMI } from './eigo_imi';
import { relayDeck } from '../game/decks';

const lv2 = relayDeck('eigo', 2);
const lv1 = relayDeck('eigo', 1);

describe('英単語の 日本語の いみ', () => {
  it('高学年（5・6年）で 出る ことばは ぜんぶ いみを 持っている', () => {
    const none = lv2.filter((q) => !EIGO_IMI[q.name]).map((q) => q.name);
    expect(none, 'いみが ない: ' + none.join(', ')).toEqual([]);
    expect(lv2.length).toBeGreaterThan(100);
  });
  it('いみが かぶっていない（4たくで 同じ こたえが 2つ 出ない）', () => {
    const v = Object.values(EIGO_IMI);
    const dup = v.filter((x, i) => v.indexOf(x) !== i);
    expect(dup, 'かぶり: ' + dup.join(', ')).toEqual([]);
  });
  it('いみに 英語（アルファベット）が まざっていない', () => {
    const bad = Object.entries(EIGO_IMI).filter(([, v]) => /[A-Za-z]/.test(v));
    expect(bad).toEqual([]);
  });
  it('いみは みじかい（早押しで 読める 長さ）', () => {
    const long = Object.entries(EIGO_IMI).filter(([, v]) => [...v].length > 10);
    expect(long, '長すぎる: ' + long.map(([k, v]) => k + '=' + v).join(', ')).toEqual([]);
  });
  it('低学年の ことばは 入れない（ヒントに こたえが 書いてあるので）', () => {
    /* 低学年は ヒントに「日本語で「りんご」」が あり、逆向きだと こたえが ばれる */
    const leaked = lv1.filter((q) => EIGO_IMI[q.name] && q.hints.some((h) => h.includes('日本語で')));
    expect(leaked.map((q) => q.name)).toEqual([]);
  });
  it('いらない ことばが 入っていない（デッキに ない語）', () => {
    const names = new Set(lv1.concat(lv2).map((q) => q.name));
    const extra = Object.keys(EIGO_IMI).filter((k) => !names.has(k));
    expect(extra, 'デッキに ない: ' + extra.join(', ')).toEqual([]);
  });
});
