import { Redis } from "@upstash/redis";

// Expect UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in env
export const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;
