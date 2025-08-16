import { NextRequest } from "next/server";
import { createFile } from "@/server/storage";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getSupabaseAdmin, getSupabaseBucket } from '@/lib/supabase';

export const runtime = 'nodejs';

async function getUserId() {
  const s = await auth.api.getSession({ headers: await headers() });
  return s?.user.id ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const organizationId = String(form.get('organizationId'));
    const parentId = (form.get('parentId') as string) || null;
    const visibility = (form.get('visibility') as string) as "org"|"private"|"custom";
    const userIdsRaw = (form.get('userIds') as string) || '';
    const userIds = userIdsRaw ? userIdsRaw.split(',').map(s => s.trim()).filter(Boolean) : undefined;

    const file = form.get('file') as unknown as File;
    if (!file) return Response.json({ error: 'Missing file' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buf = Buffer.from(bytes);

    // Upload to Supabase Storage
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return Response.json({ error: 'Supabase not configured on server' }, { status: 500 });
    }
    const bucket = getSupabaseBucket();
    const objectKey = `${organizationId}/${parentId || 'root'}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from(bucket).upload(objectKey, buf, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
    if (upErr) {
      return Response.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });
    }
    const storagePath = objectKey;

  const userId = await getUserId();
    if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const res = await createFile({
      organizationId,
      parentId,
      name: file.name,
      mimeType: file.type,
  size: buf.length,
  storagePath,
      visibility,
      userIds,
    }, userId);

    return Response.json(res);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed';
    return Response.json({ error: message }, { status: 500 });
  }
}
