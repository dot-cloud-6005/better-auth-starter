import { redis } from "./redis";

type TakeResult = { allowed: boolean; remaining: number };

export async function rateLimitTake(key: string, limit: number, windowSeconds: number): Promise<TakeResult> {
  if (!redis) return { allowed: true, remaining: limit };
  // Use INCR with first-hit expiry to implement fixed window limiting
  const count = (await redis.incr(key)) as number;
  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }
  return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
}

export async function getCounter(key: string): Promise<number> {
  if (!redis) return 0;
  const val = await redis.get<number>(key);
  return Number(val || 0);
}

export async function setLock(key: string, ttlSeconds: number): Promise<void> {
  if (!redis) return;
  await redis.set(key, "1", { ex: ttlSeconds });
}

export async function isLocked(key: string): Promise<boolean> {
  if (!redis) return false;
  const v = await redis.exists(key);
  return v === 1;
}
