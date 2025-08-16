import { NextRequest } from "next/server";
import { db } from "@/db/drizzle";
import { storageItem } from "@/db/schema";
import { eq } from "drizzle-orm";
import { listItems } from "@/server/storage";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getSupabaseAdmin, getSupabaseBucket } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get('itemId');
    const orgId = searchParams.get('organizationId');
    if (!itemId || !orgId) return new Response('Missing params', { status: 400 });

    // Very simple session lookup
  const s = await auth.api.getSession({ headers: await headers() });
  const userId = s?.user.id;

    // Ensure the item is accessible to user
  const items = await listItems(orgId, undefined, userId ?? undefined);
    const allowed = items.find(i => i.id === itemId) || (await db.query.storageItem.findFirst({ where: eq(storageItem.id, itemId) }));
    if (!allowed) return new Response('Not found', { status: 404 });

    if (!allowed.storagePath || allowed.type !== 'file') return new Response('Not a file', { status: 400 });

    // Generate a signed URL from Supabase Storage and redirect
    const supabase = getSupabaseAdmin();
    if (!supabase) return new Response('Supabase not configured', { status: 500 });
    const bucket = getSupabaseBucket();
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(allowed.storagePath, 60, {
      download: allowed.name,
    });
    if (error || !data?.signedUrl) return new Response('Failed to sign URL', { status: 500 });
    return new Response(null, { status: 302, headers: { Location: data.signedUrl } });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed';
    return new Response(message, { status: 500 });
  }
}
