import fs from "node:fs/promises";
import path from "node:path";
import { db } from "@/db/drizzle";
import { sql } from "drizzle-orm";
import { getCache, setCache } from "@/lib/cache";
import type { EquipmentRecord, InspectionRecord } from "@/types/navapp";

const INSPECTIONS_KEY = "navapp-inspections-v1";
const EQUIPMENT_KEY = "navapp-equipment-v1";
const TTL = 1000 * 60 * 10; // 10 minutes

function workspacePath(file: string) {
  // Resolve at runtime relative to project root
  // In Next.js, process.cwd() should be the project root.
  return path.join(process.cwd(), file);
}

async function readJsonArray<T = unknown>(relative: string): Promise<T[]> {
  const file = workspacePath(relative);
  const raw = await fs.readFile(file, "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) return [];
  return data as T[];
}

export async function getInspections(): Promise<InspectionRecord[]> {
  const cached = getCache<InspectionRecord[]>(INSPECTIONS_KEY);
  if (cached) return cached;
  try {
    const rows = await readJsonArray<InspectionRecord>("NaInspections.json");
    setCache(INSPECTIONS_KEY, rows, TTL);
    return rows;
  } catch {
    return [];
  }
}

export async function getEquipment(): Promise<EquipmentRecord[]> {
  const cached = getCache<EquipmentRecord[]>(EQUIPMENT_KEY);
  if (cached) return cached;
  try {
    const rows = await readJsonArray<EquipmentRecord>("NaEquipment.json");
    setCache(EQUIPMENT_KEY, rows, TTL);
    return rows;
  } catch {
    return [];
  }
}

export async function fetchInspectionsByAsset(assetId: number): Promise<{ data: InspectionRecord[]; source: 'db' | 'json' | 'none' }>{
  // 1) Prefer DB view if available
  try {
  const idStr = String(assetId);
    const res = await db.execute(sql`
      select
        primary_key,
        asset_id,
        inspection_date,
        water_depth,
        used_equipment,
        inspection_notes,
        recommendations,
        condition_rating,
        attendance_type,
        asset_status,
        main_asset_photo,
        additional_1,
        additional_2,
        additional_3,
        additional_4,
        additional_5,
        additional_6,
        situation,
        location_code,
        location,
        row_number,
        row_id
  from navigation.inspections_v
  where asset_id::text = ${idStr}
      order by inspection_date desc nulls last
    `);
    const rows = (res as any)?.rows as Array<Record<string, any>> | undefined;
    if (rows && rows.length) {
      // Map DB typed rows to the JSON-shaped InspectionRecord the UI expects
      const mapped = rows.map((r) => ({
        Key: String(assetId),
        "Inspection Notes": r.inspection_notes ?? "",
        Recommendations: r.recommendations ?? "",
        "Date/Time": r.inspection_date ?? "",
        "Condition Rating": r.condition_rating ?? "",
        "Water Depth": r.water_depth != null ? String(r.water_depth) : "",
        "Attendance Type": r.attendance_type ?? "",
        "Asset Status": r.asset_status ?? "",
        "Main Asset Photo": r.main_asset_photo ?? "",
        "Additional #1": r.additional_1 ?? "",
        "Additional #2": r.additional_2 ?? "",
        "Additional #3": r.additional_3 ?? "",
        "Additional #4": r.additional_4 ?? "",
        "Additional #5": r.additional_5 ?? "",
        "Additional #6": r.additional_6 ?? "",
        Situation: r.situation ?? "",
        "Location Code": r.location_code ?? "",
        Location: r.location ?? "",
        "Primary Key": r.primary_key ?? "",
  })) as InspectionRecord[];
  return { data: mapped, source: 'db' };
    }
  } catch (e) {
    // fall back to JSON below
  }

  // 2) Fallback to JSON file if DB view not present or no rows
  const all = await getInspections();
  const toNum = (v?: string) => {
    if (!v) return NaN;
    const n = Number(String(v).trim());
    return Number.isFinite(n) ? n : NaN;
  };
  const suffixNum = (v?: string) => {
    if (!v) return NaN;
    const m = String(v).match(/(\d+)$/);
    if (!m) return NaN;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : NaN;
  };
  // Match on numeric equality using Key or numeric suffix from Location Code
  const matched = all.filter((r) => {
    const keyNum = toNum((r as any).Key);
    const locNum = suffixNum((r as any)["Location Code"]);
    return keyNum === assetId || locNum === assetId;
  });
  // Sort by Date/Time desc if present (mm/dd/yyyy or similar). Try Date parsing.
  const sorted = matched.sort((a, b) => {
    const da = Date.parse(a["Date/Time"] ?? "");
    const db = Date.parse(b["Date/Time"] ?? "");
    if (isNaN(da) && isNaN(db)) return 0;
    if (isNaN(da)) return 1;
    if (isNaN(db)) return -1;
    return db - da;
  });
  return { data: sorted, source: sorted.length ? 'json' : 'none' };
}

export async function getInspectionsByAsset(assetId: number) {
  const { data } = await fetchInspectionsByAsset(assetId);
  return data;
}

export async function getEquipmentByAsset(assetId: number) {
  const all = await getEquipment();
  const toNum = (v?: string) => {
    if (!v) return NaN;
    const n = Number(String(v).trim());
    return Number.isFinite(n) ? n : NaN;
  };
  const suffixNum = (v?: string) => {
    if (!v) return NaN;
    const m = String(v).match(/(\d+)$/);
    if (!m) return NaN;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : NaN;
  };
  // Prefer exact numeric match on "Asset ID"; fallback to numeric suffix from title
  const exact = all.filter((r) => toNum((r as any)["Asset ID"]) === assetId);
  if (exact.length) return exact;
  return all.filter((r) => suffixNum((r as any)["Equipment Title"]) === assetId);
}
