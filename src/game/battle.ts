/* はやおし親子バトル の 純ロジック（問題づくり・選たく肢・得点）。タイマーと描画は UI 側 */
import { relayDeck, missDeck } from './decks';
import { KOKUGO_REI } from '../data/kokugo_rei';
import { preloadArt } from './art';
import { markSeen, seenAt, markHit, markMiss } from './records';
import { shuffle, pickN, randInt, rng } from './util';
import type { BattleQ, Level, RelayQ, Side, Subject } from './types';

export const HANDI: [number, number][] = [[3, 3], [2, 4], [2, 6]];   /* [こどもの選たく肢, おとなの選たく肢] */
export const HANDI_WAIT = [0, 800, 1600];   /* けいさんのときの おとなの ハンデ（ミリ秒） */
export const NUMKEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
export const SOLO_OPTS = 4;   /* ひとりモードの 選たく肢の 数 */
export const BATTLE_CAP = 180;   /* 〇もん先取でも これ以上は つづけない（秒） */
export const BSUBJ_ALL: (Subject)[] = ['pref', 'flag', 'kokugo', 'rika', 'rekishi', 'eigo', 'calc'];
export type BattleSubj = 'mix' | 'miss' | Subject;   /* miss = まちがい帳から 出す */

export function calcQuestion(lv: Level): BattleQ {
  let a: number, b: number, text: string, ans: number;
  if (lv === 1) {
    if (rng() < 0.5) { a = randInt(2, 9); b = randInt(2, 9); text = a + ' + ' + b; ans = a + b; }
    else { a = randInt(5, 17); b = randInt(1, a - 1); text = a + ' − ' + b; ans = a - b; }
  } else {
    const r = rng();
    if (r < 0.45) { a = randInt(2, 9); b = randInt(2, 9); text = a + ' × ' + b; ans = a * b; }
    else if (r < 0.75) { b = randInt(2, 9); ans = randInt(2, 9); a = b * ans; text = a + ' ÷ ' + b; }
    else { a = randInt(12, 89); b = randInt(12, 89); text = a + ' + ' + b; ans = a + b; }
  }
  /* まちがいの選たく肢。こたえが 0や1 だと 下に ずらせる数が 足りないので
     上へ のばして かならず 8個 そろえる（無限ループ対策ずみ） */
  const cand: string[] = [];
  for (let d = Math.max(0, ans - 6); d <= ans + 6; d++) if (d !== ans) cand.push(String(d));
  let up = ans + 7;
  while (cand.length < 8) { cand.push(String(up)); up++; }
  const pool = shuffle(cand).slice(0, 8);
  return { art: null, text, num: true, answer: String(ans), pool, fact: null };
}

/* まちがいの選たく肢は、こたえと 同じ種類から えらぶ。
   れきしなら 人物の問題は 人物だけ、できごとの問題は できごとだけ に なる。
   同じ種類が 足りないときだけ、近い種類 → ぜんぶ の順に 広げる。 */
export const TAG_GROUP: Record<string, Record<string, string>> = {
  rekishi: { '人物': '人', 'できごと': 'こと', '時代': 'こと', 'たてもの': 'もの', 'いせき': 'もの', 'むかしのどうぐ': 'どうぐ' },
  kokugo: { 'ことわざ': 'ことわざ', '慣用句': 'ことわざ', '四字熟語': '四字熟語' },
};
export const POOL_BY_TAG = ['rekishi', 'kokugo', 'rika', 'eigo'];   /* 都道府県・国旗は 今までどおり ぜんぶから */
export function tagGroup(key: string, tag: string): string { const g = TAG_GROUP[key]; return (g && g[tag]) || tag; }
export function battlePool(key: string, deck: RelayQ[], q: RelayQ): string[] {
  const others = deck.filter((x) => x.name !== q.name);
  if (POOL_BY_TAG.indexOf(key) < 0) return shuffle(others.map((x) => x.name));
  const same: RelayQ[] = [], near: RelayQ[] = [], rest: RelayQ[] = [];
  others.forEach((x) => {
    if (x.tag === q.tag) same.push(x);
    else if (tagGroup(key, x.tag) === tagGroup(key, q.tag)) near.push(x);
    else rest.push(x);
  });
  /* pickOpts は 前から取るので、同じ種類 → 近い種類 → その他 の順に ならべる */
  return shuffle(same).concat(shuffle(near), shuffle(rest)).map((x) => x.name);
}

export function pickOpts(q: BattleQ, n: number): string[] {
  const a = [q.answer];
  for (let i = 0; i < q.pool.length && a.length < n; i++) {
    if (a.indexOf(q.pool[i]) < 0) a.push(q.pool[i]);
  }
  return shuffle(a);
}

export interface BattleOpts { level: Level; bsubj: BattleSubj; handi: number; goal: number; players?: 1 | 2 }

/** 1ゲームぶんの 状態。UI は これを持って 描画する */
export class BattleSession {
  pools: Partial<Record<Subject, RelayQ[]>> = {};
  recent: Record<string, string[]> = {};
  score: Record<Side, number> = { adult: 0, child: 0 };
  input: Record<Side, string> = { adult: '', child: '' };
  q: BattleQ | null = null;
  last: BattleQ | null = null;   // へぇ 用（fact を持つ 最後の正解）
  done = false;
  /** 回答権を 持っている人。null＝だれも 押していない（2人のときだけ 使う） */
  owner: Side | null = null;
  /** この問題で もう まちがえた人（1問に 1回だけ 答えられる） */
  tried: Record<Side, boolean> = { adult: false, child: false };
  opts: BattleOpts;
  /** まちがい直しのときだけ 使う。学年をまたいで まちがえた問題を あつめたもの */
  missPool: RelayQ[] = [];

  constructor(opts: BattleOpts) {
    this.opts = opts;
    for (const k of ['pref', 'flag', 'kokugo', 'rika', 'rekishi', 'eigo'] as Subject[]) this.pools[k] = relayDeck(k, opts.level);
    if (opts.bsubj === 'miss') {
      /* まちがい帳は 始めた時点で 固定する。当てて 帳から 消えても、この勝負では 出つづける */
      this.missPool = missDeck().filter((q) => q.sub !== 'math' && q.sub !== 'calc');
      /* まちがい帳は 学年を またぐので、まちがいの選たく肢も 両方の学年から とる。
         こうしないと 低学年の問題を 高学年で 直すとき、選たく肢が 教科ちがいに なる */
      for (const k of ['pref', 'flag', 'kokugo', 'rika', 'rekishi', 'eigo'] as Subject[]) {
        const seen = new Set<string>();
        this.pools[k] = relayDeck(k, 1).concat(relayDeck(k, 2)).filter((q) => !seen.has(q.name) && seen.add(q.name));
      }
    }
    if (opts.bsubj === 'mix' || opts.bsubj === 'eigo' || opts.bsubj === 'miss') {
      preloadArt((opts.bsubj === 'miss' ? this.missPool : (this.pools.eigo || [])).map((q) => q.art));
    }
  }

  /* 同じ問題が つづけて 出ないように えらぶ。
     このゲームで 出たものは 外し、のこりは 前に出たのが 古いものを 優先する。 */
  pickFromDeck(key: string, deck: RelayQ[]): RelayQ {
    const rl = this.recent[key] || (this.recent[key] = []);
    let best: RelayQ | null = null, bestT = Infinity;
    for (let i = 0; i < 8; i++) {
      const c = deck[Math.floor(rng() * deck.length)];
      if (rl.indexOf(c.name) >= 0) continue;
      const t = seenAt(key, c.name);
      if (t < bestT) { bestT = t; best = c; }
    }
    if (!best) best = deck[Math.floor(rng() * deck.length)];
    rl.push(best.name);
    const cap = Math.max(3, Math.min(20, Math.floor(deck.length * 0.6)));
    while (rl.length > cap) rl.shift();
    return best;
  }

  makeQ(): BattleQ {
    /* まちがい直しは 帳から 1問 えらび、まちがいの選たく肢は その問題の 教科から とる
       （みかん と 織田信長 が ならばないように） */
    if (this.opts.bsubj === 'miss') {
      if (!this.missPool.length) return calcQuestion(this.opts.level);
      const q = this.pickFromDeck('miss', this.missPool);
      const key = q.sub;
      const deck = this.pools[key] || this.missPool;
      return this.buildQ(key, q, deck);
    }
    const keys: Subject[] = this.opts.bsubj === 'mix' ? BSUBJ_ALL : [this.opts.bsubj];
    const key = keys[Math.floor(rng() * keys.length)];
    if (key === 'calc') return calcQuestion(this.opts.level);
    const deck = this.pools[key];
    if (!deck || !deck.length) return calcQuestion(this.opts.level);
    const q = this.pickFromDeck(key, deck);
    return this.buildQ(key, q, deck);
  }

  /** 1問ぶんの 表示を 組み立てる（まちがい直しでも ふつうの出題でも 同じ形にする） */
  buildQ(key: Subject, q: RelayQ, deck: RelayQ[]): BattleQ {
    markSeen(key, q.name);
    let text: string, art = null, disp: Record<string, string> | undefined;
    if (key === 'flag') { text = 'この国旗{こっき}はどこ？'; art = q.art; }
    else if (key === 'eigo') { text = 'これを英語{えいご}で？'; art = q.art; }
    else if (key === 'kokugo' && KOKUGO_REI[q.name]) {
      /* ことば：問題は そのことばを 使った 例文、選たく肢は 意味。記録は 名前で つける */
      text = KOKUGO_REI[q.name].rei;
      disp = {};
      deck.forEach((x) => { const r = KOKUGO_REI[x.name]; if (r) disp![x.name] = r.imi; });
    }
    else { text = pickN(q.hints, 2).join('・'); }
    const pool = battlePool(key, deck, q);
    const ymap: Record<string, string> = {};
    deck.forEach((x) => { ymap[x.name] = x.yomi; });
    return { art, text, num: false, answer: q.name, pool, fact: q.fact, yomi: ymap, sub: key, disp };
  }

  /** つぎの問題へ。両側の選たく肢も ここで決める */
  next(): { q: BattleQ; opts: Record<Side, string[]>; wait: number } {
    this.done = false;
    this.owner = null;
    this.tried = { adult: false, child: false };
    const q = this.makeQ();
    this.q = q;
    this.input = { adult: '', child: '' };
    const n = HANDI[this.opts.handi] || HANDI[1];
    /* ひとりモードは 相手が いないので ハンデも 待ちも なし。選たく肢は いつも 4つ */
    const solo = this.opts.players === 1;
    const opts = solo ? { child: pickOpts(q, SOLO_OPTS), adult: [] as string[] }
      : { child: pickOpts(q, n[0]), adult: pickOpts(q, n[1]) };
    const wait = (q.num && !solo) ? (HANDI_WAIT[this.opts.handi] || 0) : 0;
    return { q, opts, wait };
  }

  /** 赤いボタン（回答権を とる）。取れたら true。
      すでに だれかが 持っている／この問題で もう まちがえた人なら false。
      ひとりモードは 取り合う相手が いないので いつでも true */
  claim(side: Side): boolean {
    if (this.opts.players === 1) return true;
    if (this.done || this.owner || this.tried[side]) return false;
    this.owner = side;
    return true;
  }
  /** 2人とも まちがえた（だれも 取れずに つぎの問題へ） */
  bothTried(): boolean { return this.tried.adult && this.tried.child; }

  /** 正解。戻り値 true なら 〇もん先取に とどいた */
  correct(side: Side): boolean {
    const q = this.q!;
    this.done = true;
    this.score[side]++;
    if (q.fact) this.last = q;
    markHit(q.sub, q.answer);
    return !!this.opts.goal && this.score[side] >= this.opts.goal;
  }
  wrong(side: Side) {
    const q = this.q!;
    markMiss(q.sub, q.answer);
    if (q.num) this.input[side] = '';
    this.tried[side] = true;
    if (this.owner === side) this.owner = null;   /* 回答権は 手ばなす（相手が 押せるように） */
  }
  /** テンキー入力。戻り値は 判定が出たかどうか */
  key(side: Side, v: string): 'ok' | 'ng' | null {
    const q = this.q!;
    const ans = String(q.answer);
    let cur = this.input[side] || '';
    if (v === 'del') { cur = cur.slice(0, -1); }
    else {
      if (cur.length >= ans.length) return null;
      if (cur === '' && v === '0') return null;   /* 先頭の0は 打てない（こたえに 0はじまりは ない） */
      cur += v;
    }
    this.input[side] = cur;
    /* 桁数が そろったら その場で 判定する */
    if (v !== 'del' && cur.length >= ans.length) return cur === ans ? 'ok' : 'ng';
    return null;
  }
  scoreText(side: Side): string {
    return this.opts.goal ? this.score[side] + '/' + this.opts.goal : String(this.score[side]);
  }
}
