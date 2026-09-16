import { describe, it, expect } from 'vitest';
import { checkNick, suggestNick, NICK_MAX, normNick, setExtraNg, NG_WORDS } from './nickname';
import { setKV, memoryKV } from './storage';
import { beforeEach } from 'vitest';

beforeEach(() => { setKV(memoryKV()); setExtraNg([]); });

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
    expect(checkNick('りんびょう').ok).toBe(false);
  });
  it('のばし棒・小書き・カタカナで ごまかしても はじく', () => {
    expect(normNick('リンビョー')).toBe('りんびよ');   // ー・のばす音は 消える
    expect(normNick('りんびょう')).toBe('りんびよ');
    expect(normNick('ばーか')).toBe('ばか'); expect(normNick('ばあか')).toBe('ばか');
    expect(normNick('おしっこ')).toBe('おしつこ');
    expect(normNick('せんせい')).toBe('せんせ'); expect(normNick('とうきょう')).toBe('ときよ');
    for (const v of ['りんびょー', 'リンビョウ', 'ばーか', 'バカ', 'ば か', 'うんこー', 'ちんちん', 'えっちねこ', 'ぶさいくさん']) expect(checkNick(v).ok, v).toBe(false);
  });
  it('ふつうの名前は 通る（短すぎる語を NG に 入れていない）', () => {
    for (const v of ['がんばる', 'きもち', 'ちびねこ', 'かすてら', 'はかせ', 'あおいとり', 'きょうこ', 'せいこう', 'しつじ']) expect(checkNick(v), v).toMatchObject({ ok: true });
    expect(NG_WORDS.every((w) => w.length >= 2)).toBe(true);
  });
  it('サーバーの NGワードも きく', () => {
    expect(checkNick('ぴよぴよ').ok).toBe(true);
    setExtraNg(['ピヨ']);
    expect(checkNick('ぴよぴよ').ok).toBe(false);
    expect(checkNick('ぴーよ').ok).toBe(false);
    setExtraNg([]);
    expect(checkNick('ぴよぴよ').ok).toBe(true);
  });
  it('候補は いつも 通る', () => {
    for (let i = 0; i < 50; i++) { const s = suggestNick(); expect(checkNick(s).ok).toBe(true); expect(s.length).toBeLessThanOrEqual(NICK_MAX); }
  });
});
