import { NextRequest } from "next/server";
import { deleteItem } from "@/server/storage";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { itemId, organizationId } = body as { itemId: string; organizationId: string };
    const res = await deleteItem(itemId, organizationId);
    return Response.json(res);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed";
    return Response.json({ error: message }, { status: 500 });
  }
}
