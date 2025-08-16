import { NextResponse } from "next/server";
import { getEquipmentByAsset } from "@/server/navapp";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const id = Number(assetId);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid asset id" }, { status: 400 });
  try {
    const rows = await getEquipmentByAsset(id);
    return NextResponse.json({ data: rows });
  } catch (err) {
    const message = (err as Error)?.message || "Failed to fetch equipment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
