/* サーバーの接続先。publishable key は ブラウザに置いてよい鍵（RLS で守る）。
   secret key / service_role は ここに 絶対に 書かない */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://wfixrtlthirberxzpsjc.supabase.co';
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_t0PU_FyCL3bh2K6fc4nNjA_vogH-oC7';

/** イベントコード。QR に ?e=T2026-12 のように 埋めこむ。無ければ home */
export function eventCode(): string {
  try {
    const e = new URLSearchParams(location.search).get('e');
    if (e && /^[A-Za-z0-9_-]{1,20}$/.test(e)) { localStorage.setItem('oyako-event', e); return e; }
    return localStorage.getItem('oyako-event') || 'home';
  } catch { return 'home'; }
}

/** 受付の 共用たんまつ（1台を 何人かで つかう）。QR に ?s=1 を 足して 開く。
    このモードでは 学年を えらぶ たびに 受付番号を きき、人が 変わったら 名前も きき直す。
    ?s=0 で もどせる（ふつうの スマホに もどす とき） */
export function shareMode(): boolean {
  try {
    const v = new URLSearchParams(location.search).get('s');
    if (v === '1') { localStorage.setItem('oyako-share', '1'); return true; }
    if (v === '0') { localStorage.removeItem('oyako-share'); return false; }
    return localStorage.getItem('oyako-share') === '1';
  } catch { return false; }
}
