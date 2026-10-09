/* 新しく 出しなおした ぶんを かならず 拾う。

   Service Worker は 速さと オフライン のために 前のぶんを そのまま 出す。
   ふつうは 新しい Service Worker が 入れば 入れかわるが、
   それが うまく いかないと「直したのに いつまでも 古いまま」に なる。
   そこで ばんごう（version.json）を ネットに じかに 聞きにいき、
   手もとと ちがったら 入れかえる。それでも だめなら Service Worker を
   いったん はずして 読みこみなおす（つぎに 開いたとき また 入るので
   オフラインで あそべるのは そのまま）。 */

const CHECK_MS = 60_000;          /* 1分おきに 見る */
const GIVEUP_MS = 6_000;          /* ふつうの 入れかえを これだけ 待って だめなら 強く やる */
const TRIES_KEY = 'oyako-fresh-tries';
const MAX_TRIES = 2;              /* 何度も 読みこみなおさない ための 用心 */
/* この画面に いるときは 読みこみなおさない（とちゅうで 消えてしまうので） */
const PLAYING = '#s-play.on, #s-geo.on, #s-battle.on, #s-cross.on, #s-numcross.on';

const VER_URL = (import.meta.env.BASE_URL || '/') + 'version.json';

/** サーバーに ある いまの ばんごう。つながらないときは null */
async function serverBuild(): Promise<string | null> {
  try {
    const r = await fetch(VER_URL + '?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json() as { build?: string };
    return typeof j.build === 'string' ? j.build : null;
  } catch { return null; }
}

const tries = () => { try { return Number(sessionStorage.getItem(TRIES_KEY) || '0'); } catch { return 0; } };
const setTries = (n: number) => { try { sessionStorage.setItem(TRIES_KEY, String(n)); } catch { /* つかえない端末 */ } };

export function keepFresh() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  let reloading = false;
  let pending = false;   /* 新しいのが 来ている */
  let asked = false;     /* 強い 入れかえを もう しかけた */
  /* はじめて 受けもちが 始まるとき（1回目の 読みこみ）は 入れかわりでは ないので 何もしない。
     これを 見ないと、初回に かならず 読みこみなおして タイトルに もどってしまう */
  const hadController = !!navigator.serviceWorker.controller;
  const playing = () => !!document.querySelector(PLAYING);

  const swap = () => {
    if (reloading || !pending || playing()) return;
    reloading = true;
    window.location.reload();
  };
  /* Service Worker を はずして 読みこみなおす（さいごの手）。
     つぎに 開いたときに また 入るので、オフラインで あそべるのは そのまま */
  const hardRefresh = async () => {
    if (reloading || playing()) return;
    if (tries() >= MAX_TRIES) return;
    setTries(tries() + 1);
    reloading = true;
    try { const r = await navigator.serviceWorker.getRegistration(); await r?.unregister(); } catch { /* 気にしない */ }
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    pending = true;
    swap();
  });

  /* ばんごうを くらべる。ちがえば 入れかえに かかる */
  const check = async () => {
    const b = await serverBuild();
    if (!b) return;                       /* つながらない＝オフライン。そのまま あそばせる */
    if (b === __BUILD__) { setTries(0); return; }   /* もう 新しい */
    pending = true;
    try { const r = await navigator.serviceWorker.getRegistration(); await r?.update(); } catch { /* 気にしない */ }
    swap();
    if (!asked) { asked = true; setTimeout(() => { void hardRefresh(); }, GIVEUP_MS); }
  };

  navigator.serviceWorker.getRegistration().then((r) => {
    const tick = () => { r?.update().catch(() => undefined); void check(); };
    tick();
    setInterval(tick, CHECK_MS);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
    /* あそびおわって ホームに もどった ときにも 見る */
    document.addEventListener('click', () => { if (pending) setTimeout(swap, 300); }, true);
  }).catch(() => undefined);
}
