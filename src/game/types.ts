/* ゲーム全体で使う型。DOM には依存しない */

export type Level = 1 | 2;

/** 画面で選べるモード。geopref/geoflag は ちずクイズ、miss は まちがい直し */
export type Mode =
  | 'pref' | 'flag' | 'kokugo' | 'rika' | 'rekishi' | 'eigo'
  | 'math' | 'battle' | 'cross' | 'numcross'
  | 'geopref' | 'geoflag' | 'miss'
  | 'battle1' | 'miss1';   /* ホームの「1人であそぶ」に出す 入口。えらばれた瞬間に
                              'battle'（miss1 は さらに きょうか=まちがい）に読みかえるので、
                              画面の状態が この2つのままに なることはない */

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
  disp?: Record<string, string>;   // 選たく肢の 表示（ことば：名前 → 意味）。answer/pool は 名前のまま
  /* もじあて：よみの 一部を ? にして、そこを 1文字ずつ 4たく（国旗は2たく）で うめる */
  chars?: string[];                // こたえの よみ（ぜんぶ。? のところも 入っている）
  holes?: number[];                // ? のいち。この順に こたえる
  charOpts?: string[][];           // holes と 同じ数の 選たく肢
  tail?: string;                   // うしろに そのまま 出す文字（県・都・府・道）
  shown?: { name: string; yomi: string; tail: string }[];   // すでに 見せておく 仲間（同じ条件の 都道府県）
  hit?: number;                    // 条件に なっている いち（そこは はじめから 見えている）
}

export type Side = 'adult' | 'child';

export type RankKind = 'relay' | 'math' | 'battle';
