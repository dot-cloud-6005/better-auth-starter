import { NextResponse } from 'next/server';
import redis, { CACHE_KEYS } from '@/lib/equipment/redis';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { keys } = body as { keys?: string[] | 'all' };

    // Base keys your app uses
    const fixedKeys = [
      CACHE_KEYS.EQUIPMENT,
      CACHE_KEYS.EQUIPMENT_GROUPS,
      CACHE_KEYS.EQUIPMENT_SCHEDULES,
      CACHE_KEYS.PLANT,
      CACHE_KEYS.PLANT_GROUPS,
      CACHE_KEYS.ALL_PLANT_SERVICE_HISTORY
    ];

    let deleted = 0;

    // Delete fixed set or provided keys
    if (!keys || keys === 'all') {
      deleted = await redis.del(...fixedKeys);
    } else if (Array.isArray(keys) && keys.length) {
      deleted = await redis.del(...keys);
    }

    return NextResponse.json({ ok: true, deleted });
  } catch (err) {
    console.error('Cache revalidate error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to revalidate cache' }, { status: 500 });
  }
}