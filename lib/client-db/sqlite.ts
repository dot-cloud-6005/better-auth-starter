// Lightweight client-side SQLite layer using sql.js for optimistic UI & offline-first.
// This module must NEVER run on the server (sql.js has conditional requires for 'fs').
// We dynamically import sql.js only in the browser. On the server we expose harmless no-op fallbacks
// so that server components can import code that indirectly references these helpers without crashing.
// If you need explicit server usage, refactor to isolate browser-only logic instead.

// We repeat minimal type shims to avoid importing 'sql.js' types server-side; they are approximate.
type Database = any
type SqlJsStatic = {
  Database: new (...args: any[]) => Database
}

let SQL: SqlJsStatic | null = null
let db: Database | null = null
let initPromise: Promise<Database> | null = null
let saveScheduled = false
const STORAGE_KEY = 'localSqliteDB_v1'

const createTablesSQL = `
CREATE TABLE IF NOT EXISTS equipment_local (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  synced INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS plant_local (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  synced INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS inspections_local (
  id TEXT PRIMARY KEY,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  data TEXT NOT NULL,
  synced INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS navigation_assets (
  asset_number INTEGER PRIMARY KEY,
  data TEXT NOT NULL,
  synced INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS navigation_inspections (
  primary_key TEXT PRIMARY KEY,
  asset_id INTEGER,
  data TEXT NOT NULL,
  synced INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_nav_inspections_asset_id ON navigation_inspections(asset_id);
CREATE TABLE IF NOT EXISTS navigation_asset_images (
  asset_id INTEGER PRIMARY KEY,
  image_path TEXT NOT NULL,
  inspection_date TEXT,
  cached_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_nav_asset_images_cached_at ON navigation_asset_images(cached_at);
CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`;

function b64Encode(bytes: Uint8Array) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64')
  let binary = ''
  bytes.forEach(b => binary += String.fromCharCode(b))
  return btoa(binary)
}
function b64Decode(str: string): Uint8Array {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(str, 'base64'))
  const binary = atob(str)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i=0;i<len;i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function scheduleSave() {
  if (saveScheduled || !db) return
  saveScheduled = true
  setTimeout(async () => {
    try { const exported = db!.export(); localStorage.setItem(STORAGE_KEY, b64Encode(exported)) } catch (e) { console.warn('Persist db failed', e) }
    saveScheduled = false
  }, 800) // batch multiple writes
}

async function init() : Promise<Database> {
  if (typeof window === 'undefined') {
    // Return a dummy object so calling code that *accidentally* invokes in RSC won't explode.
    throw new Error('client-db/sqlite: attempted init() on server – ensure calls are in client components/effects')
  }
  if (db) return db
  if (initPromise) return initPromise
  initPromise = (async () => {
    if (!SQL) {
      // Dynamic import only in browser
      const mod: any = await import('sql.js')
      const initSqlJs = mod.default || mod
      // Attempt order for the WASM file:
      // 1. Local copy at /sqljs/sql-wasm.wasm (ship with app for offline / CSP restricted environments)
      // 2. Official CDN (https://sql.js.org/dist/)
      // We attempt local first to avoid layout shift delays on slow networks.
      // If both fail we throw a descriptive error only once.

      const CDN_BASE = 'https://sql.js.org/dist'
      const LOCAL_BASE = '/sqljs'
      const tryInit = async (base: string) => {
        return await initSqlJs({ locateFile: (file: string) => `${base}/${file}` })
      }
      let lastErr: any = null
      // Local first
      try {
        SQL = await tryInit(LOCAL_BASE)
      } catch (e) {
        lastErr = e
        console.warn('[sql.js] Local WASM load failed, attempting CDN', e)
        try {
          SQL = await tryInit(CDN_BASE)
        } catch (e2) {
          console.error('[sql.js] Both local and CDN WASM loads failed')
          throw e2
        }
      }
    }
    // Restore from storage if present
    const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    
    if (stored) {
      try {
        const bytes = b64Decode(stored)
        db = new SQL!.Database(bytes)
      } catch (e) {
        console.warn('Failed to restore sqlite DB, starting fresh', e)
        db = new SQL!.Database()
      }
    } else {
      db = new SQL!.Database()
    }
    db.exec(createTablesSQL)
    return db!
  })()
  return initPromise
}

type Entity = 'equipment' | 'plant' | 'inspection'

interface QueueItem { id: string; entity: Entity; operation: 'create' | 'update' | 'delete'; payload: any }

function uuid() { return 'temp_' + crypto.randomUUID() }

export async function getLocalEquipment(): Promise<any[]> {
  if (typeof window === 'undefined') return []
  const d = await init();
  const res = d.exec('SELECT data FROM equipment_local')
  if (!res.length) return []
  return res[0].values.map((row: any[]) => JSON.parse(row[0] as string))
}
export async function getLocalPlant(): Promise<any[]> {
  if (typeof window === 'undefined') return []
  const d = await init();
  const res = d.exec('SELECT data FROM plant_local')
  if (!res.length) return []
  return res[0].values.map((row: any[]) => JSON.parse(row[0] as string))
}
export async function getLocalInspections(): Promise<any[]> {
  if (typeof window === 'undefined') return []
  const d = await init();
  const res = d.exec('SELECT data FROM inspections_local ORDER BY created_at DESC LIMIT 500')
  if (!res.length) return []
  return res[0].values.map((row: any[]) => JSON.parse(row[0] as string))
}

export async function upsertLocalEquipment(e: any, synced = 0) {
  if (typeof window === 'undefined') return
  const d = await init();
  const rec = { ...e }
  d.run('INSERT OR REPLACE INTO equipment_local (id, data, synced, updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP)', [rec.id, JSON.stringify(rec), synced])
  scheduleSave()
}
export async function upsertLocalPlant(p: any, synced = 0) {
  if (typeof window === 'undefined') return
  const d = await init();
  const rec = { ...p }
  d.run('INSERT OR REPLACE INTO plant_local (id, data, synced, updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP)', [rec.id, JSON.stringify(rec), synced])
  scheduleSave()
}
export async function addLocalInspection(i: any, synced = 0) {
  if (typeof window === 'undefined') return
  const d = await init();
  const rec = { ...i }
  d.run('INSERT OR REPLACE INTO inspections_local (id, item_type, item_id, data, synced) VALUES (?,?,?,?,?)', [rec.id, rec.type, rec.itemId, JSON.stringify(rec), synced])
  scheduleSave()
}

// Navigation Assets functions
export async function getLocalNavigationAssets(): Promise<any[]> {
  if (typeof window === 'undefined') return []
  const d = await init();
  const res = d.exec('SELECT data FROM navigation_assets ORDER BY asset_number')
  if (!res.length) return []
  return res[0].values.map((row: any[]) => JSON.parse(row[0] as string))
}

export async function upsertLocalNavigationAsset(asset: any, synced = 0) {
  if (typeof window === 'undefined') return
  const d = await init();
  const rec = { ...asset }
  d.run('INSERT OR REPLACE INTO navigation_assets (asset_number, data, synced, updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP)', [rec.Asset_Number, JSON.stringify(rec), synced])
  scheduleSave()
}

// Navigation Inspections functions
export async function getLocalNavigationInspections(assetId?: number): Promise<any[]> {
  if (typeof window === 'undefined') return []
  const d = await init();
  
  let query = 'SELECT data FROM navigation_inspections'
  let params: any[] = []
  
  if (assetId) {
    query += ' WHERE asset_id = ?'
    params = [assetId]
  }
  
  query += ' ORDER BY updated_at DESC'
  
  const res = d.exec(query, params)
  if (!res.length) return []
  return res[0].values.map((row: any[]) => JSON.parse(row[0] as string))
}

export async function upsertLocalNavigationInspection(inspection: any, synced = 0) {
  if (typeof window === 'undefined') return
  const d = await init();
  const rec = { ...inspection }
  d.run('INSERT OR REPLACE INTO navigation_inspections (primary_key, asset_id, data, synced, updated_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP)', [rec.primary_key, rec.asset_id, JSON.stringify(rec), synced])
  scheduleSave()
}

export async function enqueue(item: Omit<QueueItem,'id'>) {
  if (typeof window === 'undefined') return 'noop'
  const d = await init();
  const id = uuid()
  d.run('INSERT INTO sync_queue (id, entity, operation, payload) VALUES (?,?,?,?)', [id, item.entity, item.operation, JSON.stringify(item.payload)])
  scheduleSave()
  return id
}

export async function getQueue(): Promise<QueueItem[]> {
  if (typeof window === 'undefined') return []
  const d = await init();
  const res = d.exec('SELECT id, entity, operation, payload FROM sync_queue ORDER BY created_at ASC LIMIT 100')
  if (!res.length) return []
  return res[0].values.map((r: any[]) => ({ id: r[0] as string, entity: r[1] as Entity, operation: r[2] as any, payload: JSON.parse(r[3] as string)}))
}
export async function dequeue(id: string) {
  if (typeof window === 'undefined') return
  const d = await init();
  d.run('DELETE FROM sync_queue WHERE id=?', [id])
  scheduleSave()
}

// Background sync loop (manual trigger)
export async function runSync(processors: Partial<Record<Entity, (op: QueueItem) => Promise<boolean>>>) {
  if (typeof window === 'undefined') return
  const queue = await getQueue()
  for (const item of queue) {
    const fn = processors[item.entity]
    if (!fn) continue
    try {
      const ok = await fn(item)
      if (ok) await dequeue(item.id)
    } catch (e) {
      console.warn('Sync failed for', item, e)
    }
  }
}

export function isTempId(id: string) { return id.startsWith('temp_') }

export async function replaceTempEquipmentId(tempId: string, realId: string) {
  if (typeof window === 'undefined') return
  const d = await init();
  const res = d.exec('SELECT data FROM equipment_local WHERE id=?', [tempId])
  if (!res.length) return
  const obj = JSON.parse(res[0].values[0][0] as string)
  obj.id = realId
  d.run('DELETE FROM equipment_local WHERE id=?', [tempId])
  d.run('INSERT OR REPLACE INTO equipment_local (id, data, synced, updated_at) VALUES (?,?,1,CURRENT_TIMESTAMP)', [realId, JSON.stringify(obj), 1])
}

// Navigation asset image caching functions
export async function cacheAssetImage(assetId: number, imagePath: string, inspectionDate?: string) {
  if (typeof window === 'undefined') return
  const d = await init()
  d.run(
    'INSERT OR REPLACE INTO navigation_asset_images (asset_id, image_path, inspection_date, cached_at) VALUES (?,?,?,CURRENT_TIMESTAMP)', 
    [assetId, imagePath, inspectionDate || null]
  )
  scheduleSave()
}

export async function getCachedAssetImage(assetId: number): Promise<string | null> {
  if (typeof window === 'undefined') return null
  const d = await init()
  const res = d.exec('SELECT image_path FROM navigation_asset_images WHERE asset_id=?', [assetId])
  return res.length > 0 ? res[0].values[0][0] as string : null
}

export async function getAllCachedAssetImages(): Promise<Array<{ asset_id: number; image_path: string; inspection_date?: string }>> {
  if (typeof window === 'undefined') return []
  const d = await init()
  const res = d.exec('SELECT asset_id, image_path, inspection_date FROM navigation_asset_images ORDER BY cached_at DESC')
  if (!res.length) return []
  
  return res[0].values.map((row: any[]) => ({
    asset_id: row[0] as number,
    image_path: row[1] as string,
    inspection_date: row[2] as string | undefined
  }))
}

export async function clearAssetImageCache() {
  if (typeof window === 'undefined') return
  const d = await init()
  d.run('DELETE FROM navigation_asset_images')
  scheduleSave()
}

// Export helper to persist DB to localStorage if needed (optional)
export async function exportSerialized(): Promise<Uint8Array | null> {
  if (typeof window === 'undefined') return null
  if (!db) return null
  return db.export()
}
