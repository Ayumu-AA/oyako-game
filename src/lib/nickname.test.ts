import { describe, it, expect } from 'vitest';
import { checkNick, suggestNick, NICK_MAX } from './nickname';

describe('なまえ', () => {
  it('ひらがな 2〜6文字だけ 通る', () => {
    expect(checkNick('みどりのかに')).toEqual({ ok: true, value: 'みどりのかに' });
    expect(checkNick('ぱんだ')).toEqual({ ok: true, value: 'ぱんだ' });
    expect(checkNick('らーめん')).toEqual({ ok: true, value: 'らーめん' });
    expect(checkNick('あ').ok).toBe(false);
    expect(checkNick('あいうえおかき').ok).toBe(false);
    expect(checkNick('taro').ok).toBe(false);
    expect(checkNick('太郎').ok).toBe(false);
    expect(checkNick('').ok).toBe(false);
  });
  it('カタカナ・空白は ととのえる', () => {
    expect(checkNick(' パンダ ')).toEqual({ ok: true, value: 'ぱんだ' });
    expect(checkNick('ね こ')).toEqual({ ok: true, value: 'ねこ' });
  });
  it('NGワードは 部分一致で はじく', () => {
    expect(checkNick('しねねこ').ok).toBe(false);
    expect(checkNick('ばかもの').ok).toBe(false);
    expect(checkNick('うんこまん').ok).toBe(false);
  });
  it('候補は いつも 通る', () => {
    for (let i = 0; i < 50; i++) { const s = suggestNick(); expect(checkNick(s).ok).toBe(true); expect(s.length).toBeLessThanOrEqual(NICK_MAX); }
  });
});
