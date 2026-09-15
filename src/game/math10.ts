/* 10を作る：問題づくり と 式の判定 */
import { randInt } from './util';
import type { Level, MathQ } from './types';

type Item = { v: number; s: string };
type Op = '+' | '-' | '*' | '/';

function solveSet(items: Item[], ops: Op[], noNeg: boolean): string | null {
  if (items.length === 1) return Math.abs(items[0].v - 10) < 1e-6 ? items[0].s : null;
  for (let i = 0; i < items.length; i++) {
    for (let j = 0; j < items.length; j++) {
      if (i === j) continue;
      const a = items[i], b = items[j];
      const rest = items.filter((_, k) => k !== i && k !== j);
      for (const op of ops) {
        let v: number, str: string;
        if (op === '+') { if (i > j) continue; v = a.v + b.v; str = '(' + a.s + '＋' + b.s + ')'; }
        else if (op === '*') { if (i > j) continue; v = a.v * b.v; str = '(' + a.s + '×' + b.s + ')'; }
        else if (op === '-') { v = a.v - b.v; str = '(' + a.s + '−' + b.s + ')'; }
        else { if (Math.abs(b.v) < 1e-9) continue; v = a.v / b.v; str = '(' + a.s + '÷' + b.s + ')'; }
        if (noNeg && v < -1e-9) continue;
        const r = solveSet(rest.concat([{ v, s: str }]), ops, noNeg);
        if (r) return r;
      }
    }
  }
  return null;
}

export function makePuzzle(level: Level): MathQ {
  const count = level === 1 ? 3 : 4;
  for (let tries = 0; tries < 400; tries++) {
    const nums: number[] = [];
    for (let i = 0; i < count; i++) nums.push(randInt(1, 9));
    const start = nums.map((n) => ({ v: n, s: String(n) }));
    let sol: string | null = null;
    const tiers: [Op[], boolean][] = level === 1
      ? [[['+'], true], [['+', '-'], true]]
      : [[['+'], true], [['+', '-'], true], [['+', '-', '*'], true], [['+', '-', '*', '/'], true], [['+', '-', '*', '/'], false]];
    for (let t = 0; t < tiers.length && !sol; t++) sol = solveSet(start, tiers[t][0], tiers[t][1]);
    if (sol) {
      let t = sol;
      if (t.charAt(0) === '(') t = t.slice(1, -1);
      return { nums, sol: t + '＝10' };
    }
  }
  return level === 1 ? { nums: [2, 3, 5], sol: '2+3+5＝10' } : { nums: [1, 2, 3, 4], sol: '1+2+3+4＝10' };
}

/** 式のトークン。n=数字（i はタイルの番号）、o=記号、p=カッコ */
export type Token = { t: 'n'; i: number; v: number } | { t: 'o'; v: '＋' | '−' | '×' | '÷' } | { t: 'p'; v: '(' | ')' };

/** 式を計算する。おかしい式なら null を返す */
export function evalTokens(tokens: Token[]): number | null {
  let i = 0;
  const bad = (): never => { throw new Error('bad'); };
  function factor(): number {
    const t = tokens[i];
    if (!t) bad();
    if (t.t === 'n') { i++; return t.v; }
    if (t.v === '(') { i++; const v = expr(); if (!tokens[i] || tokens[i].v !== ')') bad(); i++; return v; }
    return bad();
  }
  function term(): number {
    let v = factor();
    while (tokens[i] && tokens[i].t === 'o' && (tokens[i].v === '×' || tokens[i].v === '÷')) {
      const op = tokens[i].v; i++; const r = factor();
      if (op === '÷') { if (Math.abs(r) < 1e-12) bad(); v = v / r; } else { v = v * r; }
    }
    return v;
  }
  function expr(): number {
    let v = term();
    while (tokens[i] && tokens[i].t === 'o' && (tokens[i].v === '＋' || tokens[i].v === '−')) {
      const op = tokens[i].v; i++; const r = term();
      v = op === '＋' ? v + r : v - r;
    }
    return v;
  }
  try {
    const v = expr();
    if (i !== tokens.length) return null;
    return v;
  } catch { return null; }
}

export function fmtNum(v: number): string {
  if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v));
  return String(Math.round(v * 100) / 100);
}

export function tokensText(tokens: Token[]): string { return tokens.map((x) => x.v).join(' '); }

export type MathVerdict =
  | { ok: true; text: string }
  | { ok: false; text: string; kind: 'short' | 'broken' | 'wrong' };

/** 「できた！」の判定。文言は v1 と同じ */
export function checkMath(q: MathQ, tokens: Token[]): MathVerdict {
  const usedCount = tokens.filter((x) => x.t === 'n').length;
  if (usedCount < q.nums.length) {
    return { ok: false, kind: 'short', text: '数字を ぜんぶ使ってね（のこり ' + (q.nums.length - usedCount) + 'こ）' };
  }
  const val = evalTokens(tokens);
  if (val === null) return { ok: false, kind: 'broken', text: '式が とちゅうだよ。記号やカッコを見なおしてね' };
  if (Math.abs(val - 10) < 1e-9) return { ok: true, text: 'せいかい！　' + tokensText(tokens) + ' ＝ 10' };
  return { ok: false, kind: 'wrong', text: 'ざんねん。' + fmtNum(val) + ' になったよ' };
}
