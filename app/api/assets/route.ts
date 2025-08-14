import { NextResponse } from "next/server";
import { fetchAssets } from "@/server/assets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fetchAssets();
    return NextResponse.json({ data });
  } catch (err) {
    const message = (err as Error)?.message || "Failed to fetch assets";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
