/* サーバーの 表の かたちが 古いときの 逃げ道。

   アプリは 先に 新しくなり、Supabase の SQL は あとから 手で 実行する。
   その あいだ、新しい 列（scores.seat_no）を 送ると サーバーは まるごと ことわる。
   そうすると「遊んだのに 記録が 1つも 残らない」ことに なるので、
   1回 ことわられたら その セッションの あいだは その列を 送らない。
   SQL を 実行して ページを 開きなおせば、また 送るように もどる。 */

/** 受付番号の 列が つかえるか。null＝まだ ためしていない */
let seatOk: boolean | null = null;
export const seatState = () => seatOk;
export function resetSchema() { seatOk = null; }
export function noteSeatMissing() { seatOk = false; }
export const seatUsable = () => seatOk !== false;

/** 「そんな列は 無い」という 返事か。
    PostgREST は 42703（列が 無い）／PGRST204（送った列が 見つからない）で 返す */
export function isSeatMissing(err: { message?: string; code?: string } | null | undefined): boolean {
  if (!err) return false;
  const m = String(err.message || '');
  const c = String(err.code || '');
  if (!/seat_no/.test(m) && c !== '42703' && c !== 'PGRST204') return false;
  return /seat_no/.test(m) || /does not exist|schema cache|could not find/i.test(m);
}
