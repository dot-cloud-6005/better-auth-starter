import { NextResponse } from "next/server";
import { fetchInspectionsByAsset } from "@/server/navapp";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const id = Number(assetId);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid asset id" }, { status: 400 });
  try {
    const result = await fetchInspectionsByAsset(id);
  return NextResponse.json({ data: result.data, meta: { source: result.source, assetId: id } });
  } catch (err) {
    const message = (err as Error)?.message || "Failed to fetch inspections";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
