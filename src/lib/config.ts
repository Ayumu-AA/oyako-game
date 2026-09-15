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
