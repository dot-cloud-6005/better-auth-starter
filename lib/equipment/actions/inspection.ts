'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { CreateInspection, InspectionHistory } from '@/types/equipment/equipment'
import { calculateNextInspection } from '@/lib/equipment/equipment'
import { revalidatePath } from 'next/cache'
import { v4 as uuidv4 } from 'uuid'
import redis, {
  CACHE_KEYS,
  CACHE_TTL,
  serializeInspectionHistory,
  deserializeInspectionHistory
} from '../redis'

// Helper functions for safe Redis operations
async function safeRedisGet(key: string): Promise<any> {
  try {
    return await redis.get(key)
  } catch (error) {
    console.error('Redis get error:', error)
    return null
  }
}

async function safeRedisSetex(key: string, ttl: number, value: string): Promise<void> {
  try {
    await redis.setex(key, ttl, value)
  } catch (error) {
    console.error('Redis setex error:', error)
  }
}

async function safeRedisDel(key: string): Promise<void> {
  try {
    await redis.del(key)
  } catch (error) {
    console.error('Redis del error:', error)
  }
}

// Create new inspection and update equipment (with cache invalidation)
export async function createInspection(inspectionData: CreateInspection & { orgId?: string }) {
  try {
    const supabase = createAdminClient()
    
    // First, get the equipment details to calculate next inspection
    const { data: equipment, error: equipmentError } = await supabase
      .schema('equipment')
      .from('equipment')
      .select(`
        *,
        equipment_schedules!fk_equipment_schedule (
          id,
          name
        )
      `)
      .eq('id', inspectionData.equipmentId)
      .single()

    if (equipmentError) {
      throw equipmentError
    }

    // Calculate next inspection date
    const nextInspectionDate = calculateNextInspection(
      inspectionData.inspectionDate,
      equipment.equipment_schedules.name.toLowerCase()
    )

    // Insert inspection record
    const { data: inspectionRecord, error: inspectionError } = await supabase
      .schema('equipment')
      .from('inspection_history')
      .insert([
        {
          id: uuidv4(),
          equipment_id: inspectionData.equipmentId,
          inspection_date: inspectionData.inspectionDate.toISOString().split('T')[0],
          inspector_name: inspectionData.inspectorName,
          notes: inspectionData.notes,
          status: inspectionData.status,
          next_inspection_date: nextInspectionDate.toISOString().split('T')[0]
        }
      ])
      .select()
      .single()

    if (inspectionError) {
      throw inspectionError
    }

    // Update equipment with new inspection info
    const { error: updateError } = await supabase
      .schema('equipment')
      .from('equipment')
      .update({
        last_inspection: inspectionData.inspectionDate.toISOString().split('T')[0],
        next_inspection: nextInspectionDate.toISOString().split('T')[0],
        status: inspectionData.status === 'pass' ? 'compliant' : 'overdue',
        updated_at: new Date().toISOString()
      })
      .eq('id', inspectionData.equipmentId)

    if (updateError) {
      throw updateError
    }

    // Invalidate relevant caches
    await Promise.all([
      safeRedisDel(CACHE_KEYS.EQUIPMENT),
      safeRedisDel(CACHE_KEYS.INSPECTION_HISTORY(inspectionData.equipmentId)),
      inspectionData.orgId ? safeRedisDel(CACHE_KEYS.ALL_INSPECTION_HISTORY_BY_ORG(inspectionData.orgId)) : Promise.resolve()
    ])

    revalidatePath('/')
    return { data: inspectionRecord, error: null }
  } catch (error) {
    console.error('Error creating inspection:', error)
    return { data: null, error: `Failed to create inspection: ${error}` }
  }
}

// Get inspection history for equipment with caching
export async function getInspectionHistory(equipmentId: string) {
  try {
    const cacheKey = CACHE_KEYS.INSPECTION_HISTORY(equipmentId)
    
    // Try cache first
    const cachedData = await safeRedisGet(cacheKey)
    if (cachedData) {
      console.log(`Inspection history for ${equipmentId} served from cache`)
      return { data: deserializeInspectionHistory(cachedData as string), error: null }
    }

    console.log(`Fetching inspection history for ${equipmentId} from database`)
    const supabase = createAdminClient()
    
    const { data, error } = await supabase
      .schema('equipment')
      .from('inspection_history')
      .select('*')
      .eq('equipment_id', equipmentId)
      .order('inspection_date', { ascending: false })

    if (error) {
      throw error
    }

    const transformedData: InspectionHistory[] = data.map(item => ({
      id: item.id,
      equipmentId: item.equipment_id,
      inspectionDate: new Date(item.inspection_date),
      inspectorName: item.inspector_name,
      notes: item.notes,
      status: item.status,
      nextInspectionDate: item.next_inspection_date ? new Date(item.next_inspection_date) : undefined,
      createdAt: new Date(item.created_at)
    }))

    // Cache the transformed data using serialization helper
    try {
      await safeRedisSetex(cacheKey, CACHE_TTL, serializeInspectionHistory(transformedData))
      console.log(`Inspection history for ${equipmentId} cached successfully`)
    } catch (cacheError) {
      console.error('Failed to cache inspection history:', cacheError)
    }

    return { data: transformedData, error: null }
  } catch (error) {
    console.error('Error fetching inspection history:', error)
    return { data: null, error: `Failed to fetch inspection history: ${error}` }
  }
}

// Removed insecure global getAllInspectionHistory (unscoped)

// NEW: Get inspection statistics (for your dashboard)
export async function getInspectionStats() {
  try {
    const cacheKey = 'inspection:stats'
    
    // Try cache first
    const cachedData = await safeRedisGet(cacheKey)
    if (cachedData) {
      console.log('Inspection stats served from cache')
      return { data: JSON.parse(cachedData as string), error: null }
    }

    console.log('Calculating inspection stats from database')
    const supabase = createAdminClient()
    
    // Get current date ranges
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    
    // Get this month's inspections
    const { data: thisMonthData, error: thisMonthError } = await supabase
      .schema('equipment')
      .from('inspection_history')
      .select('id')
      .gte('inspection_date', startOfMonth.toISOString().split('T')[0])
    
    if (thisMonthError) throw thisMonthError
    
    // Get equipment counts by status
    const { data: equipmentData, error: equipmentError } = await supabase
      .schema('equipment')
      .from('equipment')
      .select('status')
    
    if (equipmentError) throw equipmentError
    
    const stats = {
      thisMonth: thisMonthData?.length || 0,
      pending: equipmentData?.filter(eq => eq.status === 'upcoming').length || 0,
      overdue: equipmentData?.filter(eq => eq.status === 'overdue').length || 0,
      completed: equipmentData?.filter(eq => eq.status === 'compliant').length || 0
    }

    // Cache the stats (shorter TTL since they change more frequently)
    try {
      await safeRedisSetex(cacheKey, 1800, JSON.stringify(stats)) // 30 minutes
      console.log('Inspection stats cached successfully')
    } catch (cacheError) {
      console.error('Failed to cache inspection stats:', cacheError)
    }

    return { data: stats, error: null }
  } catch (error) {
    console.error('Error fetching inspection stats:', error)
    return { data: null, error: `Failed to fetch inspection stats: ${error}` }
  }
}

// Add this new function to your existing inspection actions

export interface BulkInspectionData {
  equipmentIds: string[];
  inspectionDate: Date;
  inspectorName: string;
  status: 'pass' | 'fail' | 'conditional';
  notes: string;
}

export async function createBulkInspection(bulkData: BulkInspectionData & { orgId?: string }) {
  try {
    const supabase = createAdminClient();
    
    // Get all equipment details to calculate next inspections
    const { data: equipmentList, error: equipmentError } = await supabase
      .schema('equipment')
      .from('equipment')
      .select(`
        *,
        equipment_schedules!fk_equipment_schedule (
          id,
          name
        )
      `)
      .in('id', bulkData.equipmentIds);

    if (equipmentError) {
      throw equipmentError;
    }

    const inspectionRecords = [];
    const equipmentUpdates = [];

    // Prepare all inspection records and equipment updates
    for (const equipment of equipmentList) {
      const nextInspectionDate = calculateNextInspection(
        bulkData.inspectionDate,
        equipment.equipment_schedules.name.toLowerCase()
      );

      // Prepare inspection record
      inspectionRecords.push({
        id: uuidv4(),
        equipment_id: equipment.id,
        inspection_date: bulkData.inspectionDate.toISOString().split('T')[0],
        inspector_name: bulkData.inspectorName,
        notes: bulkData.notes,
        status: bulkData.status,
        next_inspection_date: nextInspectionDate.toISOString().split('T')[0]
      });

      // Prepare equipment update
      equipmentUpdates.push({
        id: equipment.id,
        last_inspection: bulkData.inspectionDate.toISOString().split('T')[0],
        next_inspection: nextInspectionDate.toISOString().split('T')[0],
        status: bulkData.status === 'pass' ? 'compliant' : 'overdue',
        updated_at: new Date().toISOString()
      });
    }

    // Insert all inspection records
    const { data: insertedInspections, error: inspectionError } = await supabase
      .schema('equipment')
      .from('inspection_history')
      .insert(inspectionRecords)
      .select();

    if (inspectionError) {
      throw inspectionError;
    }

    // Update all equipment records
    const updatePromises = equipmentUpdates.map(update => 
      supabase
        .schema('equipment')
        .from('equipment')
        .update({
          last_inspection: update.last_inspection,
          next_inspection: update.next_inspection,
          status: update.status,
          updated_at: update.updated_at
        })
        .eq('id', update.id)
    );

    await Promise.all(updatePromises);

    // Invalidate relevant caches
    await Promise.all([
      safeRedisDel(CACHE_KEYS.EQUIPMENT),
  bulkData.orgId ? safeRedisDel(CACHE_KEYS.ALL_INSPECTION_HISTORY_BY_ORG(bulkData.orgId)) : Promise.resolve(),
      // Also invalidate individual equipment inspection caches
      ...bulkData.equipmentIds.map(id => safeRedisDel(CACHE_KEYS.INSPECTION_HISTORY(id)))
    ]);

    revalidatePath('/');
    return { data: insertedInspections, error: null };
  } catch (error) {
    console.error('Error creating bulk inspection:', error);
    return { data: null, error: `Failed to create bulk inspection: ${error}` };
  }
}

// Org-scoped aggregated inspection history (all equipment inspections within an org)
export async function getAllInspectionHistoryByOrg(orgId: string) {
  try {
    const cacheKey = CACHE_KEYS.ALL_INSPECTION_HISTORY_BY_ORG(orgId)
    const cached = await safeRedisGet(cacheKey)
    if (cached) {
      try {
        return { data: deserializeInspectionHistory(cached as string), error: null }
      } catch (e) {
        console.warn('Failed to deserialize cached org inspection history, refetching', e)
        await safeRedisDel(cacheKey)
      }
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .schema('equipment')
      .from('inspection_history')
      .select(`
        *,
        equipment!inner (
          id,
          organization_id
        )
      `)
      .eq('equipment.organization_id', orgId)
      .order('inspection_date', { ascending: false })

    if (error) throw error

    const transformed: InspectionHistory[] = (data || []).map((item: any) => ({
      id: item.id,
      equipmentId: item.equipment_id,
      inspectionDate: new Date(item.inspection_date),
      inspectorName: item.inspector_name,
      notes: item.notes,
      status: item.status,
      nextInspectionDate: item.next_inspection_date ? new Date(item.next_inspection_date) : undefined,
      createdAt: new Date(item.created_at)
    }))

    await safeRedisSetex(cacheKey, CACHE_TTL, serializeInspectionHistory(transformed))
    return { data: transformed, error: null }
  } catch (error) {
    console.error('Error fetching org inspection history:', error)
    return { data: null, error: 'Failed to fetch organization inspection history' }
  }
}