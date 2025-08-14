import { redis } from "./redis";

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const data = await redis.get<T>(key);
    return (data as T) ?? null;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch {
    // ignore cache errors
  }
}

type Entry<T> = { value: T; expiresAt: number }

const store: Map<string, Entry<unknown>> = new Map()

export function getCache<T>(key: string): T | null {
  const hit = store.get(key) as Entry<T> | undefined
  if (!hit) return null
  if (Date.now() > hit.expiresAt) {
    store.delete(key)
    return null
  }
  return hit.value as T
}

export function setCache<T>(key: string, value: T, ttlMs: number) {
  store.set(key, { value: value as unknown, expiresAt: Date.now() + ttlMs })
}
