import { asc } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { navigationAssets } from "@/db/schema";
import { getCache, setCache } from "@/lib/cache";

// Narrowed asset type used by the app
export type Asset = import("@/types/asset").Asset;

const MEMORY_TTL = 1000 * 60 * 10; // 10 minutes cache
const CACHE_KEY = "navaids-assets-v1";

export async function fetchAssets(force = false): Promise<Asset[]> {
  if (!force) {
    const mem = getCache<Asset[]>(CACHE_KEY);
    if (mem) return mem;
  }

  const rows = await db
    .select({
      Asset_Number: navigationAssets.Asset_Number,
      Location_Code: navigationAssets.Location_Code,
      NavAid_Name: navigationAssets.NavAid_Name,
      NavAid_Primary_Function: navigationAssets.NavAid_Primary_Function,
      STATUS: navigationAssets.STATUS,
      Latitude: navigationAssets.Latitude,
      Longitude: navigationAssets.Longitude,
      NavAid_Colour: navigationAssets.NavAid_Colour,
      Northing: navigationAssets.Northing,
      Easting: navigationAssets.Easting,
      UTM_Zone: navigationAssets.UTM_Zone,
      Chart_Character: navigationAssets.Chart_Character,
      Flash_Sequence: navigationAssets.Flash_Sequence,
      Light_Range: navigationAssets.Light_Range,
      Light_Colour: navigationAssets.Light_Colour,
      Light_Model: navigationAssets.Light_Model,
      Lead_Bearing: navigationAssets.Lead_Bearing,
      Daymark: navigationAssets.Daymark,
      Mark_Structure: navigationAssets.Mark_Structure,
      Situation: navigationAssets.Situation,
      Risk_Category: navigationAssets.Risk_Category,
      Infrastructure_Subgroup_Code: navigationAssets.Infrastructure_Subgroup_Code,
      Function_Code: navigationAssets.Function_Code,
      Horizontal_Accuracy: navigationAssets.Horizontal_Accuracy,
      Responsible_Agency: navigationAssets.Responsible_Agency,
      OWNER: navigationAssets.OWNER,
      NavAid_Shape: navigationAssets.NavAid_Shape,
      AIS_Type: navigationAssets.AIS_Type,
      MMSI_Number: navigationAssets.MMSI_Number,
    })
    .from(navigationAssets)
    .orderBy(asc(navigationAssets.Asset_Number));

  const assets: Asset[] = rows.map((d) => ({
    Asset_Number: Number(d.Asset_Number),
    Location_Code: d.Location_Code ?? "",
    NavAid_Name: d.NavAid_Name ?? "",
    NavAid_Primary_Function: d.NavAid_Primary_Function ?? "",
    STATUS: d.STATUS ?? undefined,
    Latitude: Number(d.Latitude),
    Longitude: Number(d.Longitude),
  NavAid_Colour: d.NavAid_Colour ?? undefined,
  Northing: d.Northing != null ? Number(d.Northing) : undefined,
  Easting: d.Easting != null ? Number(d.Easting) : undefined,
  UTM_Zone: d.UTM_Zone != null ? Number(d.UTM_Zone) : undefined,
  Chart_Character: d.Chart_Character ?? undefined,
  Flash_Sequence: d.Flash_Sequence ?? undefined,
  Light_Range: d.Light_Range ?? undefined,
  Light_Colour: d.Light_Colour ?? undefined,
  Light_Model: d.Light_Model ?? undefined,
  Lead_Bearing: d.Lead_Bearing ?? undefined,
  Daymark: d.Daymark ?? undefined,
  Mark_Structure: d.Mark_Structure ?? undefined,
  Situation: d.Situation ?? undefined,
  Risk_Category: d.Risk_Category != null ? Number(d.Risk_Category) : undefined,
  Infrastructure_Subgroup_Code: d.Infrastructure_Subgroup_Code ?? undefined,
  Function_Code: d.Function_Code ?? undefined,
  Horizontal_Accuracy: d.Horizontal_Accuracy ?? undefined,
  Responsible_Agency: d.Responsible_Agency ?? undefined,
  OWNER: d.OWNER ?? undefined,
  NavAid_Shape: d.NavAid_Shape ?? undefined,
  AIS_Type: d.AIS_Type ?? undefined,
  MMSI_Number: d.MMSI_Number ?? undefined,
  }));

  setCache(CACHE_KEY, assets, MEMORY_TTL);
  return assets;
}
