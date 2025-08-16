import { NextRequest } from "next/server";
import { renameItem } from "@/server/storage";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { itemId, name, organizationId } = body as { itemId: string; name: string; organizationId: string };
    const res = await renameItem(itemId, name, organizationId);
    return Response.json(res);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
