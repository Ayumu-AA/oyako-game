/* 新しく 出しなおした ぶんを かならず 拾う。
   Service Worker は 速さのために 前のぶんを そのまま 出すので、
   「直したのに 反映されない」が おきる。新しいのが 用意できたら
   （遊んでいる とちゅうでなければ）そのまま 読みこみなおす。

   むかしは「タイトル画面に いるとき」だけ 読みこみなおしていたが、
   ほかの画面で 止めていると いつまでも 古いままに なるので、
   ・あそんでいる 画面で なければ すぐ
   ・あそんでいる とちゅうなら 覚えておいて、おわって もどってきたとき
   に 読みこみなおす。 */

const CHECK_MS = 60_000;   /* 1分おきに 新しいのが 無いか 見る */
/* この画面に いるときは 読みこみなおさない（とちゅうで 消えてしまうので） */
const PLAYING = '#s-play.on, #s-geo.on, #s-battle.on, #s-cross.on, #s-numcross.on';

export function keepFresh() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  let reloading = false;
  let pending = false;   /* 新しいのが 来ているが、あそんでいる とちゅう */
  /* はじめて 受けもちが 始まるとき（1回目の 読みこみ）は 入れかわりでは ないので 何もしない。
     これを 見ないと、初回に かならず 読みこみなおして タイトルに もどってしまう */
  const hadController = !!navigator.serviceWorker.controller;
  const playing = () => !!document.querySelector(PLAYING);
  const swap = () => {
    if (reloading || !pending) return;
    if (playing()) return;          /* あそびおわるまで 待つ */
    reloading = true;
    window.location.reload();
  };
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    pending = true;
    swap();
  });
  navigator.serviceWorker.getRegistration().then((r) => {
    if (!r) return;
    const tick = () => { r.update().catch(() => undefined); swap(); };
    setInterval(tick, CHECK_MS);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
    /* 画面が 変わった ときにも 見る（あそびおわって ホームに もどった とき） */
    document.addEventListener('click', () => { if (pending) setTimeout(swap, 300); }, true);
  }).catch(() => undefined);
}
