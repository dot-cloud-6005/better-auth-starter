import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getActiveOrganization } from '@/server/organizations';
import { headers } from 'next/headers';

// Lightweight session info endpoint used post-auth to derive redirect target.
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.session || !session?.user) {
      return NextResponse.json({ ok: false }, { status: 200 });
    }
    const s = session.session as any;
    let orgSlug: string | null = null;
    if (s.activeOrganizationId) {
      try {
        const org = await getActiveOrganization(session.user.id);
        orgSlug = org?.slug || null;
      } catch { /* ignore */ }
    }
    return NextResponse.json({ ok: true, session: s, user: session.user, orgSlug });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
