/* 画面をまたぐ 状態の型と 保存 */
import { store } from '../lib/storage';
import type { Level, Mode } from '../game/types';
import type { BattleSubj } from '../game/battle';

export type Group = 'relay' | 'geo' | 'solo';
export type Screen = 'title' | 'level' | 'games' | 'sub' | 'how' | 'count' | 'play' | 'geo' | 'battle' | 'cross' | 'numcross' | 'result' | 'bresult' | 'cresult' | 'rank';

export interface Settings {
  level: Level;
  seconds: number;
  role: 'child' | 'adult';   // スマホを持つ人（ヒントを出す人）
  bsubj: BattleSubj;
  handi: number;
  goal: number;              // 0 = じかん
  players: 1 | 2;            // はやおし：2人で対戦 ／ ひとりであそぶ
  kana: 'R' | 'L' | 'F';       // 50音の ならび：みぎから／ひだりから／フリック
}

export function loadSettings(): Settings {
  const g = store('oyako-goal');
  const k = store('oyako-kana');
  return {
    level: 2, seconds: 90, role: 'child', bsubj: 'mix', handi: 1, players: 2,
    goal: (g !== null && g !== '') ? Number(g) : 10,
    kana: (k === 'R' || k === 'L' || k === 'F') ? k : 'R',
  };
}

export function bestKey(mode: Mode, level: Level, seconds: number) { return 'oyako-' + mode + '-' + level + '-' + seconds; }

/** 結果画面へ渡すもの（親子ヒントリレー・10を作る・ちずクイズ・まちがい直し） */
export interface PlayResult {
  mode: Mode;
  score: number;
  seconds: number;
  got: { name: string; fact: string; mk?: string; nums?: number[] }[];   // 当てたもの
  firstName?: string; firstFact?: string;   // 1問も当てられなかったときの へぇ 用
  newBest: boolean;
  geoKind?: 'jp' | 'world';
  geoGot?: string[];
}
export interface BattleResult {
  adult: number; child: number; goal: number; seconds: number;   // seconds = 実際にかかった秒（先取）か 制限時間
  players: 1 | 2;   // 1 = ひとりモード（こども側の 点だけを 見る）
  miss?: boolean;   // まちがい直しで あそんだか
  last: { answer: string; fact: string } | null;
}
export interface CrossResult {
  kind: 'cross' | 'numcross';
  ms: number;
  hints: number;
  heeName: string; heeText: string;
  idx?: number;     // クロスワードの盤面番号（「べつのもんだい」で 同じものを さけるため）
}

export function isGeo(mode: Mode) { return mode === 'geopref' || mode === 'geoflag'; }
