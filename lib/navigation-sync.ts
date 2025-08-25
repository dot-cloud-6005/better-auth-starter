// Navigation data synchronization service
// Handles offline sync for navigation assets and inspections with JSON fallback

import { 
  getLocalNavigationAssets, 
  upsertLocalNavigationAsset,
  getLocalNavigationInspections,
  upsertLocalNavigationInspection,
  cacheAssetImage,
  clearAssetImageCache
} from '@/lib/client-db/sqlite'

interface NavigationSyncResult {
  assetsUpdated: number
  inspectionsUpdated: number
  imagesCached?: number
  jsonInspectionsLoaded?: number
  lastSyncTime: string
  error?: string
}

interface JsonInspectionRecord {
  _RowNumber: string
  "Row ID": string
  Key: string
  "Inspection Notes": string
  Recommendations: string
  "Date/Time": string
  "Condition Rating": string
  "Water Depth": string
  "Attendance Type": string
  "Asset Status": string
  "Main Asset Photo": string
  "Additional #1": string
  "Additional #2": string
  "Additional #3": string
  "Additional #4": string
  "Additional #5": string
  "Additional #6": string
  Created: string
  Modified: string
  "Equipment Used": string
  "Used Equipment?": string
  Situation: string
  "Location Code": string
  Location: string
  "Primary Key": string
}

interface NavigationAsset {
  Asset_Number: number
  Location_Code?: string
  NavAid_Name?: string
  NavAid_Primary_Function?: string
  STATUS?: string
  Northing?: number
  Easting?: number
  UTM_Zone?: number
  Latitude?: number
  Longitude?: number
  Chart_Character?: string
  Flash_Sequence?: string
  Light_Range?: string
  Light_Colour?: string
  Light_Model?: string
  Lead_Bearing?: string
  Daymark?: string
  Mark_Structure?: string
  Situation?: string
  Risk_Category?: number
  Infrastructure_Subgroup_Code?: string
  Function_Code?: string
  Horizontal_Accuracy?: string
  Responsible_Agency?: string
  OWNER?: string
  NavAid_Shape?: string
  NavAid_Colour?: string
  AIS_Type?: string
  MMSI_Number?: string
  created_at: string
  updated_at: string
}

interface NavigationInspection {
  primary_key: string
  asset_id?: number
  inspection_date?: string
  water_depth?: number
  used_equipment?: boolean
  inspection_notes?: string
  recommendations?: string
  condition_rating?: string
  attendance_type?: string
  asset_status?: string
  main_asset_photo?: string
  additional_1?: string
  additional_2?: string
  additional_3?: string
  additional_4?: string
  additional_5?: string
  additional_6?: string
  situation?: string
  location_code?: string
  location?: string
  created_raw?: string
  modified_raw?: string
  row_number?: number
  row_id?: string
}

const NAVIGATION_SYNC_KEY = 'navigation_last_sync'
const JSON_LOADED_KEY = 'navigation_json_loaded'

function getLastSyncTime(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(NAVIGATION_SYNC_KEY)
}

function setLastSyncTime(timestamp: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(NAVIGATION_SYNC_KEY, timestamp)
}

function isJsonLoaded(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(JSON_LOADED_KEY) === 'true'
}

function setJsonLoaded(loaded: boolean) {
  if (typeof window === 'undefined') return
  localStorage.setItem(JSON_LOADED_KEY, loaded.toString())
}

// Clear sync state to force full sync
export function clearNavigationSyncState() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(NAVIGATION_SYNC_KEY)
  localStorage.removeItem(JSON_LOADED_KEY)
  console.log('Navigation sync state cleared - next sync will be full sync')
}

// Load inspections from NaInspections.json file via protected API
export async function loadInspectionsFromJson(): Promise<{ inspectionsLoaded: number; error?: string }> {
  try {
    console.log('Loading inspections from NaInspections.json via API...')
    
    const response = await fetch('/api/navigation/json')
    if (!response.ok) {
      throw new Error(`Failed to load JSON file: ${response.status}`)
    }

    const data = await response.json()
    const jsonInspections: JsonInspectionRecord[] = data.inspections || []
    console.log(`Loaded ${jsonInspections.length} inspections from JSON file`)

    // Convert JSON format to navigation inspection format and store in SQLite
    let loadedCount = 0
    for (const jsonInsp of jsonInspections) {
      // Extract asset_id from the Key field
      const assetId = parseInt(jsonInsp.Key) || null
      
      // Convert to navigation inspection format
      const navigationInsp = {
        primary_key: jsonInsp["Primary Key"] || jsonInsp["Row ID"],
        asset_id: assetId,
        inspection_date: jsonInsp["Date/Time"] ? convertDateFormat(jsonInsp["Date/Time"]) : null,
        water_depth: parseFloat(jsonInsp["Water Depth"]) || null,
        used_equipment: jsonInsp["Used Equipment?"] === "Yes",
        inspection_notes: jsonInsp["Inspection Notes"] || '',
        recommendations: jsonInsp.Recommendations || '',
        condition_rating: jsonInsp["Condition Rating"] || '',
        attendance_type: jsonInsp["Attendance Type"] || '',
        asset_status: jsonInsp["Asset Status"] || '',
        main_asset_photo: jsonInsp["Main Asset Photo"] || '',
        additional_1: jsonInsp["Additional #1"] || '',
        additional_2: jsonInsp["Additional #2"] || '',
        additional_3: jsonInsp["Additional #3"] || '',
        additional_4: jsonInsp["Additional #4"] || '',
        additional_5: jsonInsp["Additional #5"] || '',
        additional_6: jsonInsp["Additional #6"] || '',
        situation: jsonInsp.Situation || '',
        location_code: jsonInsp["Location Code"] || '',
        location: jsonInsp.Location || '',
        created_raw: jsonInsp.Created || '',
        modified_raw: jsonInsp.Modified || '',
        row_number: parseInt(jsonInsp._RowNumber) || null,
        row_id: jsonInsp["Row ID"] || ''
      }

      await upsertLocalNavigationInspection(navigationInsp, 0) // Mark as not synced from DB yet
      loadedCount++
      
      // Log progress for large loads
      if (loadedCount % 1000 === 0) {
        console.log(`JSON load progress: ${loadedCount}/${jsonInspections.length}`)
      }
    }

    setJsonLoaded(true)
    console.log(`Successfully loaded ${loadedCount} inspections from JSON`)
    return { inspectionsLoaded: loadedCount }
    
  } catch (error) {
    console.error('Error loading inspections from JSON:', error)
    return { 
      inspectionsLoaded: 0, 
      error: error instanceof Error ? error.message : 'Failed to load JSON' 
    }
  }
}

// Helper function to convert date format from MM/DD/YYYY to YYYY-MM-DD
function convertDateFormat(dateStr: string): string {
  try {
    const [month, day, year] = dateStr.split('/')
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  } catch {
    return dateStr // Return as-is if conversion fails
  }
}

// Cache the most recent main image for all assets
export async function cacheAssetImages(): Promise<{ imagesCached: number; error?: string }> {
  try {
    console.log('Starting asset image caching...')
    
    // Get all assets and inspections from local storage
    const [assets, inspections] = await Promise.all([
      getLocalNavigationAssets(),
      getLocalNavigationInspections()
    ])

    console.log(`Processing images for ${assets.length} assets from ${inspections.length} inspections`)
    
    // Clear existing cache to ensure fresh data
    await clearAssetImageCache()
    
    let imagesCached = 0
    
    // Process each asset to find its most recent main photo
    for (const asset of assets) {
      try {
        // Find all inspections for this asset that have main photos
        const assetInspections = inspections
          .filter(insp => insp.asset_id === asset.Asset_Number && insp.main_asset_photo)
          .sort((a, b) => {
            // Sort by inspection date, newest first
            const getInspectionDate = (insp: NavigationInspection) => {
              if (insp.inspection_date) {
                return new Date(insp.inspection_date).getTime()
              }
              // Fallback: try to extract date from created_raw or modified_raw
              if (insp.created_raw) {
                const date = new Date(insp.created_raw)
                if (!isNaN(date.getTime())) return date.getTime()
              }
              if (insp.modified_raw) {
                const date = new Date(insp.modified_raw)
                if (!isNaN(date.getTime())) return date.getTime()
              }
              return 0 // Fallback to epoch if no valid date found
            }

            return getInspectionDate(b) - getInspectionDate(a) // Newest first
          })

        // Cache the most recent image if available
        if (assetInspections.length > 0) {
          const mostRecentInspection = assetInspections[0]
          await cacheAssetImage(
            asset.Asset_Number,
            mostRecentInspection.main_asset_photo!,
            mostRecentInspection.inspection_date
          )
          imagesCached++
        }
        
        // Log progress for large asset sets
        if ((asset.Asset_Number % 100) === 0) {
          console.log(`Image cache progress: processed asset ${asset.Asset_Number}`)
        }
        
      } catch (error) {
        console.warn(`Failed to cache image for asset ${asset.Asset_Number}:`, error)
      }
    }

    console.log(`Asset image caching completed: ${imagesCached} images cached`)
    return { imagesCached }
    
  } catch (error) {
    console.error('Asset image caching error:', error)
    return { 
      imagesCached: 0, 
      error: error instanceof Error ? error.message : 'Image caching failed' 
    }
  }
}

export async function syncNavigationAssets(): Promise<{ assetsUpdated: number; error?: string }> {
  try {
    // For navigation assets, always do a full sync to ensure we have all available assets
    // (incremental sync doesn't make sense for navigation data as we want to display everything)
    const url = '/api/navigation/assets'
      
    console.log('Starting navigation assets sync (full sync)...')
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Assets sync failed: ${response.status}`)
    }

    const data = await response.json()
    const assets: NavigationAsset[] = data.assets || []
    
    console.log(`Received ${assets.length} assets from API, storing in local database...`)
    
    // Store assets in SQLite
    let updatedCount = 0
    for (const asset of assets) {
      await upsertLocalNavigationAsset(asset, 1) // Mark as synced
      updatedCount++
      
      // Log progress for large syncs
      if (updatedCount % 500 === 0) {
        console.log(`Assets sync progress: ${updatedCount}/${assets.length}`)
      }
    }

    console.log(`Navigation assets sync completed: ${updatedCount} assets processed`)
    return { assetsUpdated: updatedCount }
    
  } catch (error) {
    console.error('Navigation assets sync error:', error)
    return { 
      assetsUpdated: 0, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

export async function syncNavigationInspections(): Promise<{ inspectionsUpdated: number; error?: string }> {
  try {
    // For navigation inspections, always do a full sync to ensure we have all available data
    // (incremental sync doesn't make sense for navigation data as we want to display everything)
    const url = '/api/navigation/inspections'
      
    console.log('Starting navigation inspections sync (full sync)...')
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Inspections sync failed: ${response.status}`)
    }

    const data = await response.json()
    const inspections: NavigationInspection[] = data.inspections || []
    
    console.log(`Received ${inspections.length} inspections from API, storing in local database...`)
    
    // Store inspections in SQLite (mark as synced from DB)
    let updatedCount = 0
    for (const inspection of inspections) {
      await upsertLocalNavigationInspection(inspection, 1) // Mark as synced from DB
      updatedCount++
      
      // Log progress for large syncs
      if (updatedCount % 500 === 0) {
        console.log(`Inspections sync progress: ${updatedCount}/${inspections.length}`)
      }
    }

    console.log(`Navigation inspections sync completed: ${updatedCount} inspections processed`)
    return { inspectionsUpdated: updatedCount }
    
  } catch (error) {
    console.error('Navigation inspections sync error:', error)
    return { 
      inspectionsUpdated: 0, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

export async function performNavigationSync(): Promise<NavigationSyncResult> {
  try {
    let jsonInspectionsLoaded = 0
    
    // Step 1: Load JSON inspections if not already loaded (provides immediate data)
    if (!isJsonLoaded()) {
      console.log('JSON not loaded yet, loading NaInspections.json for immediate data access...')
      const jsonResult = await loadInspectionsFromJson()
      if (jsonResult.error) {
        console.warn('Failed to load JSON, proceeding with DB sync only:', jsonResult.error)
      } else {
        jsonInspectionsLoaded = jsonResult.inspectionsLoaded
      }
    } else {
      console.log('JSON already loaded, proceeding with incremental DB sync...')
    }

    // Step 2: Sync assets and latest inspections from database in parallel
    const [assetsResult, inspectionsResult] = await Promise.all([
      syncNavigationAssets(),
      syncNavigationInspections()
    ])

    // Step 3: Cache the most recent images for all assets
    console.log('Starting image caching phase...')
    const imageCacheResult = await cacheAssetImages()

    const now = new Date().toISOString()
    
    // Update last sync time only if assets and inspections succeeded without errors
    // (image caching is not critical for sync success)
    if (!assetsResult.error && !inspectionsResult.error) {
      setLastSyncTime(now)
    }

    return {
      assetsUpdated: assetsResult.assetsUpdated,
      inspectionsUpdated: inspectionsResult.inspectionsUpdated,
      imagesCached: imageCacheResult.imagesCached,
      jsonInspectionsLoaded: jsonInspectionsLoaded > 0 ? jsonInspectionsLoaded : undefined,
      lastSyncTime: now,
      error: assetsResult.error || inspectionsResult.error || imageCacheResult.error
    }
    
  } catch (error) {
    console.error('Navigation sync error:', error)
    return {
      assetsUpdated: 0,
      inspectionsUpdated: 0,
      imagesCached: 0,
      lastSyncTime: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Sync failed'
    }
  }
}

export async function getNavigationDataForMap(): Promise<{
  assets: NavigationAsset[]
  inspections: NavigationInspection[]
}> {
  try {
    const [assets, inspections] = await Promise.all([
      getLocalNavigationAssets(),
      getLocalNavigationInspections()
    ])

    return { assets, inspections }
    
  } catch (error) {
    console.error('Error getting navigation data:', error)
    return { assets: [], inspections: [] }
  }
}

// Check if navigation data exists locally
export async function hasNavigationData(): Promise<boolean> {
  try {
    const assets = await getLocalNavigationAssets()
    return assets.length > 0
  } catch (error) {
    console.error('Error checking local navigation data:', error);
    return false
  }
}
