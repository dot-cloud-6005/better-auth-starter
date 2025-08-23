import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db/drizzle';
import { webauthnCredential } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// GET: list current user's passkeys
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const creds = await db.query.webauthnCredential.findMany({ where: eq(webauthnCredential.userId, session.user.id) });
    // Redact sensitive publicKey (could be large) - send metadata only
    return NextResponse.json({ credentials: creds.map(c => ({
      id: c.id,
      credentialId: c.credentialId,
      transports: c.transports?.split(',')?.filter(Boolean) || [],
      deviceType: c.deviceType,
      backedUp: c.backedUp,
      createdAt: c.createdAt,
      lastUsedAt: c.lastUsedAt,
    })) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}

// DELETE: remove a credential by credentialId (body: { credentialId })
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const credentialId = body.credentialId?.toString();
    if (!credentialId) return NextResponse.json({ message: 'credentialId required' }, { status: 400 });
    const result = await db.delete(webauthnCredential).where(and(eq(webauthnCredential.userId, session.user.id), eq(webauthnCredential.credentialId, credentialId)));
    // drizzle returns { rowCount } in some dialects; ignore for now
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}
