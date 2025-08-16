import { NextRequest } from "next/server";
import { createFolder } from "@/server/storage";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

async function getUserId() {
  const s = await auth.api.getSession({ headers: await headers() });
  return s?.user.id ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { organizationId, parentId, name, visibility, userIds } = body as { organizationId: string; parentId?: string | null; name: string; visibility: "org"|"private"|"custom"; userIds?: string[] };
  const userId = await getUserId();
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const res = await createFolder({ organizationId, parentId, name, visibility, userIds }, userId);
    return Response.json(res);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
