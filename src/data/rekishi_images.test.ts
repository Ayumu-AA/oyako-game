import { describe, expect, it } from 'vitest';
import { REKISHI_IMAGE_FILES } from './rekishi_images';
import { relayDeck } from '../game/decks';
import { BattleSession } from '../game/battle';

/* 似顔絵の 名前が 問題データと ずれると、絵が だまって 出なくなる */
describe('れきしの 似顔絵', () => {
  const people = relayDeck('rekishi', 1).concat(relayDeck('rekishi', 2)).filter((q) => q.tag === '人物');

  it('登録した 名前は ぜんぶ 問題データの 人物に ある', () => {
    const names = new Set(people.map((q) => q.name));
    for (const name of Object.keys(REKISHI_IMAGE_FILES)) expect(names.has(name), name).toBe(true);
  });

  it('ファイルが public/rekishi に ある（よけいな ファイルも ない）', () => {
    const files = Object.keys(import.meta.glob('../../public/rekishi/*'))
      .map((p) => p.replace(/^.*\/(.+)\.webp$/, '$1')).sort();
    expect(files).toEqual(Object.values(REKISHI_IMAGE_FILES).sort());
  });

  it('絵の ある 人物は デッキで 絵を 持ち、はやおしの 問題でも 絵が 出る', () => {
    const p = people.find((q) => q.name === '織田信長')!;
    expect(p.art).toEqual({ t: 'icon', k: '織田信長' });
    const s = new BattleSession({ level: 6, bsubj: 'rekishi', handi: 1, goal: 0, players: 1 });
    const q = s.buildQ('rekishi', p, people);
    expect(q.art).toEqual({ t: 'icon', k: '織田信長' });
  });

  it('人物は ぜんいん 絵が ある（人物を 足したら 絵も 足す）', () => {
    expect(people.filter((q) => !q.art).map((q) => q.name)).toEqual([]);
  });

  it('人物 いがい（できごと・たてもの など）には 絵を つけない', () => {
    const others = relayDeck('rekishi', 1).concat(relayDeck('rekishi', 2)).filter((q) => q.tag !== '人物');
    expect(others.length).toBeGreaterThan(0);
    expect(others.filter((q) => q.art).map((q) => q.name)).toEqual([]);
  });
});
