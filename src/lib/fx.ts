/* 正解の演出（紙ふぶき・スタンプ・れんぞく・音）。DOM を直接さわる 小さな道具なので lib に置く */
import { FXCOL } from '../data/texts';
import { sndOK, buzz } from './sound';

const COLS = FXCOL as string[];
let streak = 0;

export interface FxLayer {
  layer: HTMLElement | null;       // .fx
  stamp?: HTMLElement | null;      // .fxstamp
  main?: HTMLElement | null;
  sub?: HTMLElement | null;
}

/* --- 紙ふぶき＋スタンプ --- */
export function fxBurst(L: FxLayer, originEl: HTMLElement | null, n: number, mainText: string, subText: string, tone: string, withStamp: boolean) {
  const fx = L.layer; if (!fx) return;
  const host = fx.getBoundingClientRect();
  let ox = host.width / 2, oy = host.height * 0.62;
  if (originEl) {
    const b = originEl.getBoundingClientRect();
    ox = b.left - host.left + b.width / 2;
    oy = b.top - host.top + b.height * 0.3;
  }
  const count = Math.min(34, 14 + n * 4);
  for (let i = 0; i < count; i++) {
    const el = document.createElement('i');
    const ang = (Math.random() * Math.PI * 1.2) - Math.PI * 0.1;   /* だいたい上向き */
    const pow = 90 + Math.random() * 150;
    el.style.left = (ox + (Math.random() * 70 - 35)) + 'px';
    el.style.top = (oy + (Math.random() * 16 - 8)) + 'px';
    el.style.background = COLS[(Math.random() * COLS.length) | 0];
    el.style.setProperty('--dx', (Math.cos(ang) * pow * (Math.random() < .5 ? -1 : 1)).toFixed(0) + 'px');
    el.style.setProperty('--up', (-(60 + Math.random() * 130)).toFixed(0) + 'px');
    el.style.setProperty('--dy', (120 + Math.random() * 220).toFixed(0) + 'px');
    el.style.setProperty('--rot', ((Math.random() * 1080 - 540) | 0) + 'deg');
    el.style.setProperty('--t', (0.9 + Math.random() * 0.5).toFixed(2) + 's');
    if (Math.random() < 0.35) el.style.borderRadius = '50%';
    fx.appendChild(el);
    setTimeout(() => { el.remove(); }, 1500);
  }
  const st = L.stamp;
  if (st && withStamp !== false) {
    st.className = 'fxstamp' + (tone ? ' ' + tone : '');
    if (L.main) L.main.textContent = mainText;
    if (L.sub) L.sub.textContent = subText || '';
    void st.offsetWidth;
    st.classList.add('on');
  }
}
export function fxClear(L: FxLayer) {
  const fx = L.layer; if (!fx) return;
  fx.querySelectorAll('i').forEach((e) => { e.remove(); });
  if (L.stamp) L.stamp.classList.remove('on');
}
/* スコアを はずませて 光らせる */
export function fxPlus(chipEl: HTMLElement | null) {
  if (!chipEl) return;
  chipEl.classList.remove('bump'); void chipEl.offsetWidth; chipEl.classList.add('bump');
}
/* れんぞくに合わせて 見た目と音を強くする */
export interface StreakWord { main: string; sub: string; tone: string }
export function streakWord(n: number): StreakWord {
  if (n >= 8) return { main: 'ノってる！！', sub: n + 'れんぞく', tone: 'fire' };
  if (n >= 5) return { main: 'すごい！', sub: n + 'れんぞく', tone: 'fire' };
  if (n >= 3) return { main: 'いいね！', sub: n + 'れんぞく', tone: 'gold' };
  if (n === 2) return { main: 'せいかい！', sub: '2れんぞく', tone: '' };
  return { main: 'せいかい！', sub: '', tone: '' };
}
/* withStamp=false のときは 大きなスタンプを出さない（地図パネルとぶつかるため） */
export function celebrate(L: FxLayer, originEl: HTMLElement | null, chipEl: HTMLElement | null, withStamp = true): StreakWord {
  streak++;
  const w = streakWord(streak);
  fxBurst(L, originEl, streak, w.main, w.sub, w.tone, withStamp);
  fxPlus(chipEl);
  sndOK(streak);
  buzz(streak >= 5 ? [20, 45, 20] : 16);
  return w;
}
export function streakReset() { streak = 0; }
