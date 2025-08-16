import { StorageItem } from '@/components/storage/modern-browser.client';
import { cacheGet, cacheSet, getCache, setCache } from './cache';

// Cache TTL configurations (in seconds for Redis, milliseconds for in-memory)
const CACHE_TTL = {
  STORAGE_LIST: 60, // 1 minute for Redis
  STORAGE_LIST_MEMORY: 60000, // 1 minute for in-memory
  FOLDER_PREFETCH: 30, // 30 seconds for prefetched folders
  FOLDER_PREFETCH_MEMORY: 30000, // 30 seconds for in-memory
  ORG_STORAGE_ROOT: 300, // 5 minutes for organization root
  ORG_STORAGE_ROOT_MEMORY: 300000, // 5 minutes for in-memory
};

/**
 * Generate cache key for storage items
 */
function getStorageCacheKey(organizationId: string, parentId: string | null, userId: string): string {
  const parent = parentId || 'root';
  return `storage:${organizationId}:${parent}:${userId}`;
}

/**
 * Get cached storage items
 */
export async function getCachedStorageItems(
  organizationId: string, 
  parentId: string | null, 
  userId: string
): Promise<StorageItem[] | null> {
  const key = getStorageCacheKey(organizationId, parentId, userId);
  
  // Try Redis cache first
  const redisResult = await cacheGet<StorageItem[]>(key);
  if (redisResult && Array.isArray(redisResult)) {
    return redisResult;
  }
  
  // Fallback to in-memory cache
  const memoryResult = getCache<StorageItem[]>(key);
  if (memoryResult && Array.isArray(memoryResult)) {
    return memoryResult;
  }
  
  return null;
}

/**
 * Cache storage items
 */
export async function setCachedStorageItems(
  organizationId: string,
  parentId: string | null, 
  userId: string,
  items: StorageItem[]
): Promise<void> {
  // Safety check: only cache arrays
  if (!Array.isArray(items)) {
    console.warn('Attempting to cache non-array data:', items);
    return;
  }
  
  const key = getStorageCacheKey(organizationId, parentId, userId);
  
  // Cache in Redis
  await cacheSet(key, items, CACHE_TTL.STORAGE_LIST);
  
  // Also cache in memory for faster access
  setCache(key, items, CACHE_TTL.STORAGE_LIST_MEMORY);
}

/**
 * Cache prefetched folder contents
 */
export async function setPrefetchedFolderCache(
  organizationId: string,
  folderId: string,
  userId: string,
  items: StorageItem[]
): Promise<void> {
  // Safety check: only cache arrays
  if (!Array.isArray(items)) {
    console.warn('Attempting to cache non-array data for folder:', items);
    return;
  }
  
  const key = getStorageCacheKey(organizationId, folderId, userId);
  
  // Use shorter TTL for prefetched data
  await cacheSet(key, items, CACHE_TTL.FOLDER_PREFETCH);
  setCache(key, items, CACHE_TTL.FOLDER_PREFETCH_MEMORY);
}

/**
 * Invalidate cache for storage items
 */
export async function invalidateStorageCache(
  organizationId: string,
  parentId: string | null,
  userId: string
): Promise<void> {
  const key = getStorageCacheKey(organizationId, parentId, userId);
  
  // Clear from in-memory cache immediately
  setCache(key, null, 0);
  
  // Note: Redis invalidation would require a separate implementation
  // For now, we rely on TTL expiration
}

/**
 * Invalidate all storage cache for an organization
 */
export function invalidateOrgStorageCache(organizationId: string): void {
  // Clear all in-memory cache entries for this org
  // This is a simple implementation - in production you might want
  // to use a more sophisticated cache tagging system
  const keysToRemove: string[] = [];
  
  // Get all cache keys and find ones matching this org
  // Note: This is a simplified implementation for in-memory cache
  // For Redis, you'd use SCAN with patterns
}

/**
 * Pre-fetch folder contents in the background
 */
export async function prefetchFolderContents(
  organizationId: string,
  folderId: string,
  userId: string
): Promise<void> {
  try {
    // Check if already cached
    const cached = await getCachedStorageItems(organizationId, folderId, userId);
    if (cached) {
      return; // Already cached
    }
    
    // Fetch from API in background
    const response = await fetch('/api/storage/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        organizationId,
        parentId: folderId,
      }),
    });
    
    if (response.ok) {
      const items = await response.json();
      await setPrefetchedFolderCache(organizationId, folderId, userId, items);
    }
  } catch (error) {
    // Silently fail for prefetching
    console.debug('Prefetch failed:', error);
  }
}

/**
 * Batch prefetch multiple folders
 */
export async function batchPrefetchFolders(
  organizationId: string,
  folderIds: string[],
  userId: string
): Promise<void> {
  // Limit concurrent prefetch requests
  const MAX_CONCURRENT = 3;
  
  for (let i = 0; i < folderIds.length; i += MAX_CONCURRENT) {
    const batch = folderIds.slice(i, i + MAX_CONCURRENT);
    await Promise.all(
      batch.map(folderId => 
        prefetchFolderContents(organizationId, folderId, userId)
      )
    );
  }
}

/**
 * Storage state management for optimistic updates
 */
export interface StorageState {
  items: StorageItem[];
  loading: boolean;
  error: string | null;
  lastUpdated: number;
}

// In-memory storage state cache
const storageStateCache = new Map<string, StorageState>();

/**
 * Get storage state from cache
 */
export function getStorageState(
  organizationId: string,
  parentId: string | null
): StorageState | null {
  const key = `state:${organizationId}:${parentId || 'root'}`;
  return storageStateCache.get(key) || null;
}

/**
 * Update storage state cache
 */
export function setStorageState(
  organizationId: string,
  parentId: string | null,
  state: StorageState
): void {
  const key = `state:${organizationId}:${parentId || 'root'}`;
  storageStateCache.set(key, {
    ...state,
    lastUpdated: Date.now()
  });
}

/**
 * Update single item in storage state optimistically
 */
export function updateStorageItemOptimistic(
  organizationId: string,
  parentId: string | null,
  itemId: string,
  updates: Partial<StorageItem>
): void {
  const state = getStorageState(organizationId, parentId);
  if (!state) return;
  
  const updatedItems = state.items.map(item => 
    item.id === itemId ? { ...item, ...updates } : item
  );
  
  setStorageState(organizationId, parentId, {
    ...state,
    items: updatedItems
  });
}

/**
 * Add item to storage state optimistically
 */
export function addStorageItemOptimistic(
  organizationId: string,
  parentId: string | null,
  item: StorageItem
): void {
  const state = getStorageState(organizationId, parentId);
  if (!state) return;
  
  setStorageState(organizationId, parentId, {
    ...state,
    items: [item, ...state.items]
  });
}

/**
 * Remove item from storage state optimistically
 */
export function removeStorageItemOptimistic(
  organizationId: string,
  parentId: string | null,
  itemId: string
): void {
  const state = getStorageState(organizationId, parentId);
  if (!state) return;
  
  const filteredItems = state.items.filter(item => item.id !== itemId);
  
  setStorageState(organizationId, parentId, {
    ...state,
    items: filteredItems
  });
}

/**
 * Smart cache warming - preload likely-to-be-accessed folders
 */
export function warmStorageCache(
  organizationId: string,
  currentItems: StorageItem[],
  userId: string
): void {
  // Get all visible folders
  const folders = currentItems
    .filter(item => item.type === 'folder')
    .slice(0, 5); // Limit to first 5 folders
  
  // Prefetch in background with delay to not impact current navigation
  setTimeout(() => {
    batchPrefetchFolders(
      organizationId,
      folders.map(f => f.id),
      userId
    );
  }, 500); // 500ms delay
}
