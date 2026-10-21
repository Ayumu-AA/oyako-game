import { describe, it, expect } from 'vitest';
import { autoScale, scaleOf, FIXED, MIN, MAX } from './uiscale';

describe('画面の 大きさ', () => {
  it('もとに した 画面（390x760）では 1倍', () => {
    expect(autoScale(390, 760)).toBe(1);
  });
  it('小さい スマホでは 小さく なる（1画面に おさまりやすく）', () => {
    expect(autoScale(360, 640)).toBeLessThan(1);
    expect(autoScale(320, 568)).toBeLessThan(1);
  });
  it('タブレットでは 大きく なる', () => {
    expect(autoScale(768, 1024)).toBeGreaterThan(1);
    expect(autoScale(820, 1180)).toBeGreaterThan(1);
  });
  it('小さく なりすぎ・大きく なりすぎは しない', () => {
    expect(autoScale(200, 300)).toBe(MIN);
    expect(autoScale(3000, 3000)).toBe(MAX);
  });
  it('幅と 高さの きびしい ほうに あわせる（よこに はみ出さない）', () => {
    /* よこは 広いが たてが みじかい（よこむきの スマホ） */
    expect(autoScale(844, 390)).toBeLessThan(1);
  });
  it('手動は 画面の 大きさに よらず 同じ', () => {
    for (const w of [320, 390, 768]) {
      expect(scaleOf('S', w, 700)).toBe(FIXED.S);
      expect(scaleOf('M', w, 700)).toBe(FIXED.M);
      expect(scaleOf('L', w, 700)).toBe(FIXED.L);
    }
  });
  it('小さめ < ふつう < 大きめ', () => {
    expect(FIXED.S).toBeLessThan(FIXED.M);
    expect(FIXED.M).toBeLessThan(FIXED.L);
  });
});
