import { NextRequest } from "next/server";
import { listItems } from "@/server/storage";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

async function getUserId() {
  const s = await auth.api.getSession({ headers: await headers() });
  return s?.user.id ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { organizationId, parentId } = body as { organizationId: string; parentId?: string | null };
    if (!organizationId) return Response.json({ error: "Missing organizationId" }, { status: 400 });
  const userId = await getUserId();
    const items = await listItems(organizationId, parentId ?? null, userId ?? undefined);
    return Response.json({ items });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
