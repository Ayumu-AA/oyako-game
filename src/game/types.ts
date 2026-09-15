/* ゲーム全体で使う型。DOM には依存しない */

export type Level = 1 | 2;

/** 画面で選べるモード。geopref/geoflag は ちずクイズ、miss は まちがい直し */
export type Mode =
  | 'pref' | 'flag' | 'kokugo' | 'rika' | 'rekishi' | 'eigo'
  | 'math' | 'battle' | 'cross' | 'numcross'
  | 'geopref' | 'geoflag' | 'miss';

/** 記録（まちがい帳・出題きろく）の教科キー。ちずクイズは pref/flag にまとめる */
export type Subject = 'pref' | 'flag' | 'kokugo' | 'rika' | 'rekishi' | 'eigo' | 'math' | 'calc';

export type Art = { t: 'flag' | 'icon'; k: string };

/** 親子ヒントリレーの 1問 */
export interface RelayQ {
  name: string;
  yomi: string;
  tag: string;
  hints: string[];      // 「漢字{よみ}」形式を含む。表示は plain()/furi() で
  fact: string;
  art: Art | null;
  mk?: string;          // 地図キー（都道府県コード / ISO）
  sub: Subject;
}

/** 10を作る の 1問 */
export interface MathQ {
  nums: number[];
  sol: string;
}

export type DeckItem = RelayQ | MathQ;
export function isMathQ(q: DeckItem): q is MathQ { return (q as MathQ).nums !== undefined; }

/** はやおしバトルの 1問 */
export interface BattleQ {
  art: Art | null;
  text: string;
  num: boolean;               // true = けいさん（テンキー入力）
  answer: string;
  pool: string[];             // まちがいの選たく肢（同じ種類 → 近い種類 → その他 の順）
  fact: string | null;
  yomi?: Record<string, string>;
  sub?: Subject;
}

export type Side = 'adult' | 'child';

export type RankKind = 'relay' | 'math' | 'battle';
