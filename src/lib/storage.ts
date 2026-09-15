/* 端末内の保存。localStorage が使えない環境（プライベートモードなど）でも落ちないようにする。
   v2 では Supabase 版の Storage を同じ形で足す予定（records.ts は この形しか知らない） */

export interface KVStorage {
  get(key: string): string | null;
  set(key: string, val: string): void;
}

const mem: Record<string, string> = {};

export const localKV: KVStorage = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return mem[key] ?? null; }
  },
  set(key, val) {
    try { localStorage.setItem(key, val); } catch { mem[key] = val; }
  },
};

export const memoryKV = (): KVStorage => {
  const m: Record<string, string> = {};
  return { get: (k) => m[k] ?? null, set: (k, v) => { m[k] = v; } };
};

let current: KVStorage = localKV;
export function setKV(kv: KVStorage) { current = kv; }
export function kv(): KVStorage { return current; }

/** 旧コードの store(key) / store(key,val) と同じ使い勝手 */
export function store(key: string): string | null;
export function store(key: string, val: string): void;
export function store(key: string, val?: string): string | null | void {
  if (val === undefined) return current.get(key);
  current.set(key, val);
}
