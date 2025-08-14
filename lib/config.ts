import { redis } from "./redis";

const SIGNUPS_KEY = "settings:allowSignups";

export async function getAllowSignups(): Promise<boolean> {
  try {
    const v = redis ? await redis.get<string | number | boolean>(SIGNUPS_KEY) : null;
    if (v === null || v === undefined) return true; // default allow
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    return v === "true" || v === "1";
  } catch {
    return true;
  }
}

export async function setAllowSignups(allow: boolean): Promise<void> {
  if (!redis) return; // no-op if redis not configured
  await redis.set(SIGNUPS_KEY, allow ? "true" : "false");
}
