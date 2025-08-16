import { NextRequest } from "next/server";
import { updateVisibility } from "@/server/storage";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { itemId, visibility, userIds, organizationId } = body as { itemId: string; visibility: "org"|"private"|"custom"; userIds?: string[]; organizationId: string };
    const res = await updateVisibility(itemId, visibility, userIds, organizationId);
    return Response.json(res);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
