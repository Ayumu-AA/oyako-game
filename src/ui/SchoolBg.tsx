/* ホーム系の画面の うしろで ゆっくり 動く 背景。
   プラウの ブルーに、学用品や 計算記号の 線画が ただよう。
   位置・大きさ・速さは 開くたびに ランダムに 決める（毎回 すこし ちがう 画面になる）。 */
import { useMemo } from 'react';
import { Raw } from './parts';

const S = (d: string, extra = '') =>
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + extra + '</svg>';

const T = (t: string) =>
  '<svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="17.5" text-anchor="middle" ' +
  'font-size="16" font-weight="800" font-family="system-ui,sans-serif" fill="currentColor">' + t + '</text></svg>';

/** ただよう 絵。線画は すべて 同じ太さに そろえて うるさくしない */
const MOTIF: string[] = [
  /* えんぴつ */ S('<path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19l-4 1z"/><path d="M14.5 6.5l3 3"/>'),
  /* ほん */    S('<path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H11v16H5.5A2.5 2.5 0 0 0 3 21z"/><path d="M21 5.5A2.5 2.5 0 0 0 18.5 3H13v16h5.5A2.5 2.5 0 0 1 21 21z"/>'),
  /* じょうぎ */ S('<rect x="1.5" y="8" width="21" height="8" rx="1.3"/><path d="M6 8v3M10 8v4M14 8v3M18 8v4"/>'),
  /* 地球 */    S('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><ellipse cx="12" cy="12" rx="4" ry="9"/>'),
  /* フラスコ */ S('<path d="M9.5 3v6L4 18.5A2 2 0 0 0 5.8 21h12.4A2 2 0 0 0 20 18.5L14.5 9V3"/><path d="M8.5 3h7"/><path d="M6.8 15h10.4"/>'),
  /* 地図 */    S('<path d="M9 3.5 3 6v14.5L9 18l6 2.5 6-2.5V3.5L15 6z"/><path d="M9 3.5V18M15 6v14.5"/>'),
  /* 三角 */    S('<path d="M12 3.5 21.5 20H2.5z"/>'),
  /* まる */    S('<circle cx="12" cy="12" r="8.5"/>'),
  /* 四角 */    S('<rect x="4" y="4" width="16" height="16" rx="1.6"/>'),
  /* クリップ */ S('<path d="M19 8.5 10 17.5a4 4 0 0 1-5.7-5.7l9-9a2.7 2.7 0 0 1 3.8 3.8l-9 9a1.4 1.4 0 0 1-2-2l8.3-8.3"/>'),
  T('+'), T('−'), T('×'), T('÷'), T('='), T('π'), T('√'),
];

/* 「1+2=」のような 式は すこし 横長に 出す */
const WORDS = ['1+2=', '7×8', 'A B C', '%', '∠', '◯△□'];
const wordSvg = (w: string) =>
  '<svg viewBox="0 0 48 24" aria-hidden="true"><text x="24" y="17" text-anchor="middle" ' +
  'font-size="13" font-weight="800" font-family="system-ui,sans-serif" fill="currentColor">' + w + '</text></svg>';

type Bit = { html: string; st: React.CSSProperties; wide: boolean };

/** 0〜1 の かたよりの ない 乱数から、min〜max の 値を 作る */
const rnd = (min: number, max: number) => min + Math.random() * (max - min);

function build(): Bit[] {
  const out: Bit[] = [];
  const n = 22;
  for (let i = 0; i < n; i++) {
    const wide = i % 6 === 5;
    const html = wide ? wordSvg(WORDS[Math.floor(rnd(0, WORDS.length))]) : MOTIF[Math.floor(rnd(0, MOTIF.length))];
    const size = wide ? rnd(44, 78) : rnd(26, 62);
    out.push({
      html, wide,
      st: {
        left: rnd(-4, 96) + '%',
        top: rnd(-4, 96) + '%',
        width: size + 'px',
        opacity: String(rnd(0.07, 0.2)),
        /* 流れる むき・速さ・ゆれ幅を 1つずつ ちがえる */
        ['--dx' as string]: rnd(-90, 90) + 'px',
        ['--dy' as string]: rnd(-80, 80) + 'px',
        ['--rot' as string]: rnd(-28, 28) + 'deg',
        animationDuration: rnd(26, 70) + 's',
        animationDelay: -rnd(0, 40) + 's',
      },
    });
  }
  return out;
}

export function SchoolBg() {
  /* 画面を 開いた ときに 1回だけ 決める（遊んでいる 最中に 並びが 変わらないように） */
  const bits = useMemo(build, []);
  return (
    <div className="schoolbg" aria-hidden="true">
      <div className="sb-grid"></div>
      <div className="sb-beam sb-b1"></div>
      <div className="sb-beam sb-b2"></div>
      <div className="sb-word">PLOW</div>
      <div className="sb-tag">LEARN<br />FOR A<br />BRIGHTER<br />TOMORROW</div>
      {bits.map((b, i) => (
        <Raw key={i} className={'sb-bit' + (b.wide ? ' wide' : '')} html={b.html} style={b.st} />
      ))}
    </div>
  );
}
