/* Supabase クライアントと 匿名ログイン。
   通信できない・鍵がない・ブラウザが古い、どの場合も null を返して ゲームは 止めない */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config';

/* テストでは 偽物に 差しかえる */
export type Client = SupabaseClient;
let client: Client | null | undefined;
export function setClient(c: Client | null) { client = c; userId = null; }
export function getClient(): Client | null {
  if (client !== undefined) return client;
  try {
    client = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
  } catch { client = null; }
  return client;
}

let userId: string | null = null;
let signing: Promise<string | null> | null = null;

/** ログインずみなら その id、まだなら 匿名で 作る。失敗したら null（あとで また 試す） */
export function ensureUser(): Promise<string | null> {
  if (userId) return Promise.resolve(userId);
  if (signing) return signing;
  const c = getClient();
  if (!c) return Promise.resolve(null);
  signing = (async () => {
    try {
      const { data } = await c.auth.getSession();
      if (data.session?.user) { userId = data.session.user.id; return userId; }
      const r = await c.auth.signInAnonymously();
      if (r.error || !r.data.user) return null;
      userId = r.data.user.id;
      return userId;
    } catch { return null; }
    finally { signing = null; }
  })();
  return signing;
}
export function currentUserId(): string | null { return userId; }
