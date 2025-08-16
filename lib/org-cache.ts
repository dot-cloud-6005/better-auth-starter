import { Organization } from '@/db/schema';
import { cacheGet, cacheSet, getCache, setCache } from './cache';

// Cache TTL configurations
const ORG_CACHE_TTL = {
  ACTIVE_ORG: 300, // 5 minutes for Redis
  ACTIVE_ORG_MEMORY: 300000, // 5 minutes for in-memory
  ORG_LIST: 600, // 10 minutes for Redis  
  ORG_LIST_MEMORY: 600000, // 10 minutes for in-memory
  USER_ORGS: 300, // 5 minutes for user's organizations
  USER_ORGS_MEMORY: 300000, // 5 minutes for in-memory
};

/**
 * Cache key generators
 */
function getActiveOrgCacheKey(userId: string): string {
  return `active_org:${userId}`;
}

function getUserOrgsCacheKey(userId: string): string {
  return `user_orgs:${userId}`;
}

function getOrgDetailsCacheKey(orgId: string): string {
  return `org_details:${orgId}`;
}

/**
 * Cache active organization for a user
 */
export async function cacheActiveOrganization(
  userId: string, 
  organization: Organization
): Promise<void> {
  const key = getActiveOrgCacheKey(userId);
  
  // Cache in Redis with longer TTL
  await cacheSet(key, organization, ORG_CACHE_TTL.ACTIVE_ORG);
  
  // Cache in memory for immediate access
  setCache(key, organization, ORG_CACHE_TTL.ACTIVE_ORG_MEMORY);
}

/**
 * Get cached active organization for a user
 */
export async function getCachedActiveOrganization(userId: string): Promise<Organization | null> {
  const key = getActiveOrgCacheKey(userId);
  
  // Check memory cache first (fastest)
  const memoryResult = getCache<Organization>(key);
  if (memoryResult) {
    return memoryResult;
  }
  
  // Check Redis cache
  const redisResult = await cacheGet<Organization>(key);
  if (redisResult) {
    // Warm memory cache
    setCache(key, redisResult, ORG_CACHE_TTL.ACTIVE_ORG_MEMORY);
    return redisResult;
  }
  
  return null;
}

/**
 * Cache user's organizations list
 */
export async function cacheUserOrganizations(
  userId: string,
  organizations: Organization[]
): Promise<void> {
  const key = getUserOrgsCacheKey(userId);
  
  // Cache in Redis
  await cacheSet(key, organizations, ORG_CACHE_TTL.USER_ORGS);
  
  // Cache in memory
  setCache(key, organizations, ORG_CACHE_TTL.USER_ORGS_MEMORY);
}

/**
 * Get cached user organizations
 */
export async function getCachedUserOrganizations(userId: string): Promise<Organization[] | null> {
  const key = getUserOrgsCacheKey(userId);
  
  // Check memory first
  const memoryResult = getCache<Organization[]>(key);
  if (memoryResult) {
    return memoryResult;
  }
  
  // Check Redis
  const redisResult = await cacheGet<Organization[]>(key);
  if (redisResult) {
    // Warm memory cache
    setCache(key, redisResult, ORG_CACHE_TTL.USER_ORGS_MEMORY);
    return redisResult;
  }
  
  return null;
}

/**
 * Cache organization details
 */
export async function cacheOrganizationDetails(organization: Organization): Promise<void> {
  const key = getOrgDetailsCacheKey(organization.id);
  
  await cacheSet(key, organization, ORG_CACHE_TTL.ORG_LIST);
  setCache(key, organization, ORG_CACHE_TTL.ORG_LIST_MEMORY);
}

/**
 * Get cached organization details
 */
export async function getCachedOrganizationDetails(orgId: string): Promise<Organization | null> {
  const key = getOrgDetailsCacheKey(orgId);
  
  const memoryResult = getCache<Organization>(key);
  if (memoryResult) {
    return memoryResult;
  }
  
  const redisResult = await cacheGet<Organization>(key);
  if (redisResult) {
    setCache(key, redisResult, ORG_CACHE_TTL.ORG_LIST_MEMORY);
    return redisResult;
  }
  
  return null;
}

/**
 * Invalidate user's organization caches
 */
export async function invalidateUserOrgCaches(userId: string): Promise<void> {
  // Clear active org cache
  const activeKey = getActiveOrgCacheKey(userId);
  setCache(activeKey, null, 0);
  
  // Clear user orgs cache
  const userOrgsKey = getUserOrgsCacheKey(userId);
  setCache(userOrgsKey, null, 0);
}

/**
 * Invalidate specific organization cache
 */
export async function invalidateOrganizationCache(orgId: string): Promise<void> {
  const key = getOrgDetailsCacheKey(orgId);
  setCache(key, null, 0);
}

/**
 * Preload organization data for faster switching
 */
export async function preloadOrganizationData(
  userId: string,
  organizationIds: string[]
): Promise<void> {
  try {
    // Limit concurrent requests
    const MAX_CONCURRENT = 3;
    
    for (let i = 0; i < organizationIds.length; i += MAX_CONCURRENT) {
      const batch = organizationIds.slice(i, i + MAX_CONCURRENT);
      
      await Promise.all(
        batch.map(async (orgId) => {
          // Skip if already cached
          const cached = await getCachedOrganizationDetails(orgId);
          if (cached) return;
          
          // This would typically fetch from your API
          // For now, we'll just mark as preloaded
        })
      );
    }
  } catch (error) {
    console.debug('Organization preload failed:', error);
  }
}

/**
 * Organization switching state management
 */
export interface OrgSwitchState {
  isSwitching: boolean;
  targetOrgId: string | null;
  error: string | null;
  lastSwitchTime: number;
}

// In-memory state for organization switching
const orgSwitchState = new Map<string, OrgSwitchState>();

/**
 * Set organization switching state
 */
export function setOrgSwitchState(userId: string, state: Partial<OrgSwitchState>): void {
  const currentState = orgSwitchState.get(userId) || {
    isSwitching: false,
    targetOrgId: null,
    error: null,
    lastSwitchTime: 0
  };
  
  orgSwitchState.set(userId, {
    ...currentState,
    ...state,
    lastSwitchTime: Date.now()
  });
}

/**
 * Get organization switching state
 */
export function getOrgSwitchState(userId: string): OrgSwitchState | null {
  return orgSwitchState.get(userId) || null;
}

/**
 * Clear organization switching state
 */
export function clearOrgSwitchState(userId: string): void {
  orgSwitchState.delete(userId);
}

/**
 * Check if organization switch is in progress
 */
export function isOrgSwitchInProgress(userId: string): boolean {
  const state = getOrgSwitchState(userId);
  return state?.isSwitching === true;
}

/**
 * Optimistic organization switching
 */
export async function switchOrganizationOptimistic(
  userId: string,
  targetOrg: Organization,
  switchFunction: () => Promise<{ success: boolean; error?: string }>
): Promise<{ success: boolean; error?: string }> {
  // Set switching state
  setOrgSwitchState(userId, {
    isSwitching: true,
    targetOrgId: targetOrg.id,
    error: null
  });
  
  try {
    // Optimistically cache the target organization as active
    await cacheActiveOrganization(userId, targetOrg);
    
    // Perform actual switch
    const result = await switchFunction();
    
    if (result.success) {
      // Clear switching state on success
      clearOrgSwitchState(userId);
      return { success: true };
    } else {
      // Revert optimistic update on failure
      setOrgSwitchState(userId, {
        isSwitching: false,
        targetOrgId: null,
        error: result.error || 'Switch failed'
      });
      
      // Clear the optimistically set cache
      await invalidateUserOrgCaches(userId);
      
      return { success: false, error: result.error };
    }
  } catch (error) {
    // Handle unexpected errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    setOrgSwitchState(userId, {
      isSwitching: false,
      targetOrgId: null,
      error: errorMessage
    });
    
    await invalidateUserOrgCaches(userId);
    
    return { success: false, error: errorMessage };
  }
}
