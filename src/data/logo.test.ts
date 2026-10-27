import { describe, expect, it } from 'vitest';
import { PLOW_MARK } from './logo';

/* 葉の 輪郭は「M 始点 c 6つずつの 相対座標 … z」。
   数字が くっつくと 6つずつに 割りきれず、ブラウザが とちゅうで 描くのを やめる（葉が 欠ける） */
describe('プラウの ロゴ', () => {
  const paths = [...PLOW_MARK.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);

  it('葉は 5まい', () => { expect(paths.length).toBe(5); });

  it('どの 葉も 曲線を たどると 出発点に もどる', () => {
    for (const d of paths) {
      const nums = (d.match(/c([^z]+)z/)![1].match(/-?\d+/g) || []).map(Number);
      expect(nums.length % 6).toBe(0);
      let x = 0, y = 0;
      for (let i = 0; i < nums.length; i += 6) { x += nums[i + 4]; y += nums[i + 5]; }
      expect([x, y]).toEqual([0, 0]);
    }
  });
});
