'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { Equipment, EquipmentGroup, Schedule } from '@/types/equipment/equipment'
import { revalidatePath } from 'next/cache'
import { v4 as uuidv4 } from 'uuid'
import { calculateNextInspection } from '../equipment'
import redis, { 
  CACHE_KEYS, 
  CACHE_TTL, 
  serializeEquipment, 
  deserializeEquipment 
} from '../redis'

// Helper function to safely interact with Redis
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
    // Don't throw - just log the error
  }
}

async function safeRedisDel(key: string): Promise<void> {
  try {
    await redis.del(key)
  } catch (error) {
    console.error('Redis del error:', error)
    // Don't throw - just log the error
  }
}

// Get all equipment with caching
export async function getEquipment(orgId?: string, forceFresh: boolean = false) {
  try {
    const cacheKey = orgId ? CACHE_KEYS.EQUIPMENT_BY_ORG(orgId) : CACHE_KEYS.EQUIPMENT
    if (!forceFresh) {
      // Try to get from cache first
      const cachedData = await safeRedisGet(cacheKey)
      if (cachedData) {
        console.log('Equipment data served from cache')
        try {
          return { data: deserializeEquipment(cachedData as string), error: null }
        } catch (deserializationError) {
          console.error('Failed to deserialize cached data, fetching from database:', deserializationError)
          // Clear the corrupted cache entry
          await safeRedisDel(cacheKey)
        }
      }
    } else {
      console.log('Force fresh equipment fetch – bypassing cache')
    }

    console.log('Fetching equipment data from database')
    const supabase = createAdminClient()
    
    let query = supabase
      .schema('equipment')
      .from('equipment')
      .select(`
        *,
        equipment_groups!fk_equipment_group (
          id,
          name
        ),
        equipment_schedules!fk_equipment_schedule (
          id,
          name
        )
      `)
      .order('created_at', { ascending: false })

    if (orgId) {
      // filter by organization
      query = query.eq('organization_id', orgId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Supabase error:', error)
      throw error
    }

    if (!data) {
      return { data: [], error: null }
    }

    // Transform the data to match your Equipment interface
    const transformedData: Equipment[] = data.map(item => ({
      id: item.id,
      name: item.name,
      groupId: item.group_id, // Keep the foreign key
      groupName: item.equipment_groups?.name, // Add the joined name
      autoId: item.auto_id,
      description: item.description,
      scheduleId: item.schedule_id, // Keep the foreign key
      scheduleName: item.equipment_schedules?.name, // Add the joined name
      lastInspection: item.last_inspection ? new Date(item.last_inspection) : undefined,
      nextInspection: item.next_inspection ? new Date(item.next_inspection) : new Date(),
      status: item.status,
      location: item.location,
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at)
    }))

    // Cache the transformed data with error handling
    try {
      await safeRedisSetex(cacheKey, CACHE_TTL, serializeEquipment(transformedData))
      console.log('Equipment data cached successfully')
    } catch (cacheError) {
      console.error('Failed to cache equipment data:', cacheError)
      // Don't throw here - we still want to return the data even if caching fails
    }

    return { data: transformedData, error: null }
  } catch (error) {
    console.error('Error fetching equipment:', error)
    return { data: null, error: `Failed to fetch equipment: ${error}` }
  }
}

// Get equipment groups with caching
export async function getEquipmentGroups() {
  try {
    // Try cache first
    const cachedData = await redis.get(CACHE_KEYS.EQUIPMENT_GROUPS)
    if (cachedData) {
      console.log('Equipment groups served from cache')
      return { data: cachedData, error: null }
    }

    console.log('Fetching equipment groups from database')
    const supabase = createAdminClient()
    
    const { data, error } = await supabase
      .schema('equipment')
      .from('equipment_groups')
      .select('*')
      .order('name')

    if (error) {
      console.error('Supabase error:', error)
      throw error
    }

    // Cache the data
    await redis.setex(CACHE_KEYS.EQUIPMENT_GROUPS, CACHE_TTL, JSON.stringify(data))

    return { data, error: null }
  } catch (error) {
    console.error('Error fetching equipment groups:', error)
    return { data: null, error: `Failed to fetch equipment groups: ${error}` }
  }
}

// Get equipment schedules with caching
export async function getEquipmentSchedules() {
  try {
    // Try cache first
    const cachedData = await redis.get(CACHE_KEYS.EQUIPMENT_SCHEDULES)
    if (cachedData) {
      console.log('Equipment schedules served from cache')
      return { data: cachedData, error: null }
    }

    console.log('Fetching equipment schedules from database')
    const supabase = createAdminClient()
    
    const { data, error } = await supabase
      .schema('equipment')
      .from('equipment_schedules')
      .select('*')
      .order('name')

    if (error) {
      console.error('Supabase error:', error)
      throw error
    }

    // Cache the data
    await redis.setex(CACHE_KEYS.EQUIPMENT_SCHEDULES, CACHE_TTL, JSON.stringify(data))

    return { data, error: null }
  } catch (error) {
    console.error('Error fetching equipment schedules:', error)
    return { data: null, error: `Failed to fetch equipment schedules: ${error}` }
  }
}

// Helper function to invalidate cache
async function invalidateEquipmentCache(orgId?: string) {
  try {
    const tasks: Promise<any>[] = [
      redis.del(CACHE_KEYS.EQUIPMENT),
      redis.del(CACHE_KEYS.EQUIPMENT_GROUPS),
      redis.del(CACHE_KEYS.EQUIPMENT_SCHEDULES)
    ]
    if (orgId) tasks.push(redis.del(CACHE_KEYS.EQUIPMENT_BY_ORG(orgId)))
    await Promise.all(tasks)
    console.log('Equipment cache invalidated')
  } catch (error) {
    console.error('Error invalidating cache:', error)
  }
}

// Create new equipment (with cache invalidation)
export async function createEquipment(equipmentData: Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>, orgId?: string) {
  try {
    const supabase = createAdminClient()
    
    // Calculate next inspection if not provided
    let nextInspection = equipmentData.nextInspection;
    if (equipmentData.lastInspection && equipmentData.scheduleId) {
      // You'll need to get the schedule name to calculate next inspection
      const { data: scheduleData } = await supabase
        .schema('equipment')
        .from('equipment_schedules')
        .select('name')
        .eq('id', equipmentData.scheduleId)
        .single()
      
      if (scheduleData) {
        nextInspection = calculateNextInspection(equipmentData.lastInspection, scheduleData.name as Schedule);
      }
    }
    
  const { data, error } = await supabase
      .schema('equipment')
      .from('equipment')
      .insert([
        {
          id: uuidv4(),
          name: equipmentData.name,
          group_id: equipmentData.groupId, // Changed from equipmentData.group
          auto_id: equipmentData.autoId,
          description: equipmentData.description || null,
          schedule_id: equipmentData.scheduleId, // Changed from equipmentData.schedule
          last_inspection: equipmentData.lastInspection?.toISOString().split('T')[0] || null,
          next_inspection: nextInspection.toISOString().split('T')[0],
          status: equipmentData.status,
      location: equipmentData.location || null,
      organization_id: orgId || null
        }
      ])
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      throw error
    }

    // Invalidate cache after successful creation
  await invalidateEquipmentCache(orgId)

    revalidatePath('/')
    return { data, error: null }
  } catch (error) {
    console.error('Error creating equipment:', error)
    return { data: null, error: `Failed to create equipment: ${error}` }
  }
}

// Update equipment (with cache invalidation)
export async function updateEquipment(id: string, equipmentData: Partial<Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>>) {
  try {
    const supabase = createAdminClient()
    const updateData: any = {}

    if (equipmentData.name !== undefined) updateData.name = equipmentData.name
    if (equipmentData.groupId !== undefined) updateData.group_id = equipmentData.groupId // Changed from equipmentData.group
    if (equipmentData.autoId !== undefined) updateData.auto_id = equipmentData.autoId
    if (equipmentData.description !== undefined) updateData.description = equipmentData.description
    if (equipmentData.scheduleId !== undefined) updateData.schedule_id = equipmentData.scheduleId // Changed from equipmentData.schedule
    if (equipmentData.lastInspection !== undefined) {
      updateData.last_inspection = equipmentData.lastInspection?.toISOString().split('T')[0] || null
    }
    if (equipmentData.nextInspection !== undefined) {
      updateData.next_inspection = equipmentData.nextInspection.toISOString().split('T')[0]
    }
    if (equipmentData.status !== undefined) updateData.status = equipmentData.status
    if (equipmentData.location !== undefined) updateData.location = equipmentData.location

    const { data, error } = await supabase
      .schema('equipment')
      .from('equipment')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      throw error
    }

    // Invalidate cache after successful update
    await invalidateEquipmentCache()

    revalidatePath('/')
    return { data, error: null }
  } catch (error) {
    console.error('Error updating equipment:', error)
    return { data: null, error: `Failed to update equipment: ${error}` }
  }
}

// Delete equipment (with cache invalidation)
export async function deleteEquipment(id: string) {
  try {
    console.log('deleteEquipment called with ID:', id, 'Type:', typeof id); // Debug log
    
    const supabase = createAdminClient()

    // First, delete any related inspection history
    const { error: inspectionError } = await supabase
      .schema('equipment')
      .from('inspection_history')
      .delete()
      .eq('equipment_id', id);

    if (inspectionError) {
      console.error('Error deleting inspection history:', inspectionError);
      // Don't throw here, continue with equipment deletion
    }

    // Delete the equipment
    const { error } = await supabase
      .schema('equipment')
      .from('equipment')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting equipment:', error)
      throw new Error(`Database error: ${error.message}`)
    }

    // Invalidate cache - use the correct cache key format
    await Promise.all([
      invalidateEquipmentCache(),
  safeRedisDel(CACHE_KEYS.INSPECTION_HISTORY(id)) // Invalidate per-equipment inspection history cache
    ])

    revalidatePath('/')
    return { error: null }
  } catch (error) {
    console.error('Error deleting equipment:', error)
    return { error: `Failed to delete equipment: ${error}` }
  }
}

// Generate auto ID for new equipment
export async function generateAutoId(group: EquipmentGroup) {
  try {
    const supabase = createAdminClient()
    
    const { data, error } = await supabase
      .schema('equipment')
      .from('equipment')
      .select('auto_id')
      .eq('group_id', group)
      .order('auto_id', { ascending: false })

    if (error) {
      console.error('Supabase error:', error)
      throw error
    }

    const groupEquipment = data || []
    const nextNumber = groupEquipment.length + 1
    return { autoId: `${group.replace(' ', '')}${nextNumber}`, error: null }
  } catch (error) {
    console.error('Error generating auto ID:', error)
    return { autoId: null, error: `Failed to generate auto ID: ${error}` }
  }
}

// Update equipment status based on inspection dates (with cache invalidation)
export async function updateEquipmentStatuses() {
  try {
    const supabase = createAdminClient()
    
    const { data: equipment, error: fetchError } = await supabase
      .schema('equipment')
      .from('equipment')
      .select('id, next_inspection')

    if (fetchError) {
      console.error('Supabase error:', fetchError)
      throw fetchError
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const updates = equipment
      .map(item => {
        if (!item.next_inspection) return null

        const nextInspectionDate = new Date(item.next_inspection)
        nextInspectionDate.setHours(0, 0, 0, 0)

        const diffTime = nextInspectionDate.getTime() - today.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        let status: 'compliant' | 'overdue' | 'upcoming'
        if (diffDays < 0) status = 'overdue'
        else if (diffDays <= 30) status = 'upcoming'
        else status = 'compliant'

        return {
          id: item.id,
          status
        }
      })
      .filter((update): update is NonNullable<typeof update> => update !== null)

    // Update all equipment statuses
    const updatePromises = updates.map(update => 
      supabase
        .schema('equipment')
        .from('equipment')
        .update({ status: update.status })
        .eq('id', update.id)
    )

    await Promise.all(updatePromises)

    // Invalidate cache after status updates
    await invalidateEquipmentCache()

    revalidatePath('/')
    return { error: null }
  } catch (error) {
    console.error('Error updating equipment statuses:', error)
    return { error: `Failed to update equipment statuses: ${error}` }
  }
}

// Replace the getGroupId function
async function getGroupId(groupName: EquipmentGroup): Promise<string> {
  const supabase = createAdminClient();
  
  const { data, error } = await supabase
    .schema('equipment')
    .from('equipment_groups')
    .select('id')
    .eq('name', groupName)
    .single();
  
  if (error || !data) {
    console.error('Error finding group ID for:', groupName, error);
    throw new Error(`Group "${groupName}" not found in database`);
  }
  
  return data.id;
}

async function getScheduleId(scheduleName: Schedule): Promise<string> {
  const supabase = createAdminClient();
  
  // Try exact match first
  let { data, error } = await supabase
    .schema('equipment')
    .from('equipment_schedules')
    .select('id')
    .eq('name', scheduleName)
    .single();
  
  // If exact match fails, try case-insensitive search
  if (error && error.code === 'PGRST116') {
    const { data: caseInsensitiveData, error: caseInsensitiveError } = await supabase
      .schema('equipment')
      .from('equipment_schedules')
      .select('id')
      .ilike('name', scheduleName)
      .single();
    
    if (caseInsensitiveError || !caseInsensitiveData) {
      console.error('Error finding schedule ID for:', scheduleName, caseInsensitiveError);
      throw new Error(`Schedule "${scheduleName}" not found in database`);
    }
    
    return caseInsensitiveData.id;
  }
  
  if (error || !data) {
    console.error('Error finding schedule ID for:', scheduleName, error);
    throw new Error(`Schedule "${scheduleName}" not found in database`);
  }
  
  return data.id;
}

export async function createBulkEquipment(equipmentList: Partial<Equipment>[]) {
  try {
    const supabase = createAdminClient();
    
    // Get existing equipment for auto ID generation
    const { data: existingEquipment } = await supabase
      .schema('equipment')
      .from('equipment')
      .select('*');
    
    // Track used auto IDs in this batch to avoid duplicates
    const usedAutoIds = new Set<string>();
    
    // Helper function to parse dates correctly
    function parseDate(dateString: string | Date | undefined): Date {
      if (!dateString) return new Date();
      
      if (dateString instanceof Date) return dateString;
      
      // Handle different date formats
      const dateStr = dateString.toString().trim();
      
      // Check if it's in DD/MM/YYYY or D/MM/YYYY format
      const ddmmyyyyPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
      const match = dateStr.match(ddmmyyyyPattern);
      
      if (match) {
        const [, day, month, year] = match;
        // Create date in YYYY-MM-DD format to avoid ambiguity
        return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      }
      
      // If it's already in ISO format or other standard format, use it directly
      return new Date(dateStr);
    }
    
    // Process each equipment item
    const processedItems = await Promise.all(equipmentList.map(async (item) => {
      // Generate autoId if not provided
      let autoId = item.autoId;
      
      if (!autoId) {
        // Generate a unique auto ID based on group
        const groupPrefix = (item.groupName as EquipmentGroup).replace(' ', ''); // Changed from item.group
        
        // Find all existing IDs for this group and extract numbers
        const existingIds = existingEquipment
          ?.filter(e => e.auto_id && e.auto_id.startsWith(groupPrefix))
          .map(e => {
            // Match pattern like "PFD001", "PFD-001", "PFD123", etc.
            const match = e.auto_id.match(/(\d+)$/);
            return match ? parseInt(match[1], 10) : 0;
          })
          .filter(num => !isNaN(num) && num > 0) || [];
        
        // Get the next number (max + 1, or 1 if none exist)
        const nextNumber = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
        
        // Generate the auto ID with consistent format
        let generatedAutoId = `${groupPrefix}${String(nextNumber).padStart(3, '0')}`;
        let counter = nextNumber;
        
        // Keep incrementing until we find an unused ID (check both existing and current batch)
        while (existingEquipment?.some(e => e.auto_id === generatedAutoId) || usedAutoIds.has(generatedAutoId)) {
          counter++;
          generatedAutoId = `${groupPrefix}${String(counter).padStart(3, '0')}`;
        }
        
        autoId = generatedAutoId;
      } else {
        // Check if the provided autoId already exists or is used in this batch
        const autoIdExists = existingEquipment?.some(e => e.auto_id === autoId) || usedAutoIds.has(autoId);
        if (autoIdExists) {
          // Increment the number until we find a unique one
          const baseParts = autoId.match(/^(.*?)(\d+)$/);
          if (baseParts) {
            const basePrefix = baseParts[1];
            let baseNumber = parseInt(baseParts[2], 10);
            let newAutoId = autoId;
            
            while (existingEquipment?.some(e => e.auto_id === newAutoId) || usedAutoIds.has(newAutoId)) {
              baseNumber++;
              newAutoId = `${basePrefix}${String(baseNumber).padStart(baseParts[2].length, '0')}`;
            }
            
            autoId = newAutoId;
          } else {
            // If the format doesn't match our pattern, just append a timestamp
            let timestampId = `${autoId}-${Date.now().toString().slice(-4)}`;
            while (existingEquipment?.some(e => e.auto_id === timestampId) || usedAutoIds.has(timestampId)) {
              timestampId = `${autoId}-${Date.now().toString().slice(-4)}`;
            }
            autoId = timestampId;
          }
        }
      }
      
      // Add this auto ID to the used set
      usedAutoIds.add(autoId);
      
      // Calculate next inspection date with proper date parsing
      const lastInspectionDate = parseDate(item.lastInspection);
      const nextInspectionDate = calculateNextInspection(lastInspectionDate, item.scheduleName as Schedule); // Changed from item.schedule
      
      // Determine status
      const status = getEquipmentStatus(nextInspectionDate);
      
      // Get group and schedule IDs dynamically
      const groupId = await getGroupId(item.groupName as EquipmentGroup); // Changed from item.group
      const scheduleId = await getScheduleId(item.scheduleName as Schedule); // Changed from item.schedule
      
      // Return formatted item for insert
      return {
        id: uuidv4(),
        name: item.name,
        group_id: groupId,
        auto_id: autoId,
        description: item.description || '',
        schedule_id: scheduleId,
        last_inspection: lastInspectionDate.toISOString().split('T')[0], // Use parsed date
        next_inspection: nextInspectionDate.toISOString().split('T')[0],
        status: status,
        location: item.location || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }));
    
    // Insert all equipment
    const { data, error } = await supabase
      .schema('equipment')
      .from('equipment')
      .insert(processedItems)
      .select();
    
    if (error) {
      throw error;
    }
    
    // Invalidate equipment cache
    await safeRedisDel(CACHE_KEYS.EQUIPMENT);
    
    revalidatePath('/');
    return { data, error: null };
  } catch (error) {
    console.error('Error creating bulk equipment:', error);
    return { data: null, error: `Failed to create bulk equipment: ${error}` };
  }
}


// Determine equipment status based on next inspection date
function getEquipmentStatus(nextInspection: Date): 'compliant' | 'upcoming' | 'overdue' {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const nextInspectionDate = new Date(nextInspection);
  nextInspectionDate.setHours(0, 0, 0, 0);
  
  const diffTime = nextInspectionDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 30) return 'upcoming';
  return 'compliant';
}