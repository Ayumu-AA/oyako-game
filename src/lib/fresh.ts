/* 新しく 出しなおした ぶんを かならず 拾う。
   Service Worker は 速さのために 前のぶんを そのまま 出すので、
   「直したのに 反映されない」が おきる。新しいのが 用意できたら
   （遊んでいる とちゅうでなければ）そのまま 読みこみなおす。 */

const CHECK_MS = 60_000;   /* 1分おきに 新しいのが 無いか 見る */

export function keepFresh() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  let reloading = false;
  /* はじめて 受けもちが 始まるとき（1回目の 読みこみ）は 入れかわりでは ないので 何もしない。
     これを 見ないと、初回に かならず 読みこみなおして タイトルに もどってしまう */
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !hadController) return;
    /* ホーム画面に いるときだけ。あそんでいる とちゅうは じゃまをしない */
    if (!document.getElementById('s-title')) return;
    reloading = true;
    window.location.reload();
  });
  navigator.serviceWorker.getRegistration().then((r) => {
    if (!r) return;
    const tick = () => { r.update().catch(() => undefined); };
    setInterval(tick, CHECK_MS);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  }).catch(() => undefined);
}
