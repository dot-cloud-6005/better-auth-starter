'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { Plant, PlantGroup } from '@/types/equipment/plant'
import { revalidatePath } from 'next/cache'
import { v4 as uuidv4 } from 'uuid'
import redis, { 
  CACHE_KEYS, 
  CACHE_TTL, 
  serializePlant, 
  deserializePlant 
} from '@/lib/equipment/redis'
import { ActionResult } from '@/types/equipment/actions'

/* // Helper functions for safe Redis operations (same as equipment)
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
} */

async function safeRedisDel(key: string): Promise<void> {
  try {
    await redis.del(key)
  } catch (error) {
    console.error('Redis del error:', error)
  }
}

// Helper function to format errors properly
function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  if (error && typeof error === 'object') {
    // Handle Supabase errors
    if ('message' in error) {
      return (error as any).message
    }
    // Handle other error objects
    return JSON.stringify(error)
  }
  return 'Unknown error occurred'
}

// ADD THIS MISSING HELPER FUNCTION
async function getGroupId(groupName: PlantGroup): Promise<string> {
  try {
    const supabase = createAdminClient()
    
    const { data, error } = await supabase
      .schema('equipment')
      .from('plant_groups')
      .select('id')
      .eq('name', groupName)
      .single()

    if (error || !data) {
      throw new Error(`Group not found: ${groupName}`)
    }

    return data.id
  } catch (error) {
    console.error('Error getting group ID:', error)
    throw error
  }
}

// Helper: normalize Date | string | null/undefined → 'YYYY-MM-DD' or null
const toYMD = (v?: Date | string | null) => {
  if (!v) return null;
  const d = typeof v === 'string' ? new Date(v) : v;
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
};

// Make this async since it's exported in a 'use server' file
export async function getNextServiceType(plant: Plant): Promise<'odometer' | 'date' | 'both' | 'none'> {
  if (plant.groupName !== 'Vehicle' && plant.groupName !== 'Truck') return 'none';
  
  const today = new Date();
  const currentOdometer = plant.odometer || 0;

  const dueDate = plant.serviceDueDate
    ? (typeof plant.serviceDueDate === 'string' ? new Date(plant.serviceDueDate) : plant.serviceDueDate)
    : undefined;
  
  const odometerDue = plant.serviceDueOdometer && currentOdometer >= plant.serviceDueOdometer;
  const dateDue = !!(dueDate && today >= dueDate);
  
  if (odometerDue && dateDue) return 'both';
  if (odometerDue) return 'odometer';
  if (dateDue) return 'date';
  return 'none';
}

// Keep this function private (not exported) and non-async
function getPlantStatus(plant: Partial<Plant>): 'compliant' | 'upcoming' | 'overdue' {
  if (plant.groupName !== 'Vehicle' && plant.groupName !== 'Truck') {
    // Use existing date-based logic for non-vehicles
    if (!plant.serviceDueDate) return 'compliant';
    
    const today = new Date();
    const dueDate = new Date(plant.serviceDueDate);
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 30) return 'upcoming';
    return 'compliant';
  }
  
  // For vehicles/trucks, check both odometer and date
  const today = new Date();
  const currentOdometer = plant.odometer || 0;
  
  let odometerStatus: 'compliant' | 'upcoming' | 'overdue' = 'compliant';
  let dateStatus: 'compliant' | 'upcoming' | 'overdue' = 'compliant';
  
  // Check odometer-based service
  if (plant.serviceDueOdometer) {
    const odometerDiff = plant.serviceDueOdometer - currentOdometer;
    const intervalKm = plant.serviceIntervalKm || 10000;
    const upcomingThreshold = intervalKm * 0.1; // 10% of interval = upcoming
    
    if (odometerDiff <= 0) odometerStatus = 'overdue';
    else if (odometerDiff <= upcomingThreshold) odometerStatus = 'upcoming';
  }
  
  // Check date-based service
  if (plant.serviceDueDate) {
    const diffTime = new Date(plant.serviceDueDate).getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) dateStatus = 'overdue';
    else if (diffDays <= 30) dateStatus = 'upcoming';
  }
  
  // Return the most critical status
  if (odometerStatus === 'overdue' || dateStatus === 'overdue') return 'overdue';
  if (odometerStatus === 'upcoming' || dateStatus === 'upcoming') return 'upcoming';
  return 'compliant';
}

// Helper function to invalidate cache (same pattern as equipment)
async function invalidatePlantCache() {
  try {
    await Promise.all([
      redis.del(CACHE_KEYS.PLANT),
      redis.del(CACHE_KEYS.PLANT_GROUPS),
      redis.del(CACHE_KEYS.ALL_PLANT_SERVICE_HISTORY)
    ])
    console.log('Plant cache invalidated')
  } catch (error) {
    console.error('Error invalidating cache:', error)
  }
}

// UPDATED getPlant function with better error handling
export async function getPlant(orgId?: string, forceFresh: boolean = false): Promise<{ data?: Plant[]; error?: string }> {
  try {
    const cacheKey = orgId ? CACHE_KEYS.PLANT_BY_ORG(orgId) : CACHE_KEYS.PLANT
    if (!forceFresh) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log('Plant data loaded from cache');
        const plantData = deserializePlant(cached);
        return { data: plantData };
      }
    } else {
      console.log('Force fresh plant fetch – bypassing cache')
    }

    // If not cached, load from database
    const supabase = createAdminClient();

    let query = supabase
      .schema('equipment')
      .from('plant')
      .select(`
        *,
        plant_groups!fk_plant_group_id (
          id,
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (orgId) {
      query = query.eq('organization_id', orgId)
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return { error: error.message };
    }

    const plantData: Plant[] = data?.map((item: any) => ({
      id: item.id,
      name: item.name,
      groupId: item.group_id,
      groupName: item.plant_groups?.name as PlantGroup,
      autoId: item.auto_id,
      registrationNumber: item.registration_number,
      serviceDueDate: item.service_due_date ? new Date(item.service_due_date) : undefined,
      location: item.location,
      responsiblePerson: item.responsible_person,
      status: item.status || 'compliant',
      vehicleMake: item.vehicle_make,
      vehicleModel: item.vehicle_model,
      odometer: item.odometer,
      hiabFitted: item.hiab_fitted || false,
      hiabMake: item.hiab_make,
      hiabModel: item.hiab_model,
      hiabServiceDueDate: item.hiab_service_due_date ? new Date(item.hiab_service_due_date) : undefined,
      serviceDueOdometer: item.service_due_odometer,
      lastServiceOdometer: item.last_service_odometer,
      serviceIntervalKm: item.service_interval_km || 10000,
      serviceIntervalDays: item.service_interval_days || 365,
      uvi: item.uvi,
      outboardType: item.outboard_type,
      outboardQuantity: item.outboard_quantity,
      vesselSurveyDueDate: item.vessel_survey_due_date ? new Date(item.vessel_survey_due_date) : undefined,
      vesselSurveyType: item.vessel_survey_type,
      certificateOfOperationDueDate: item.certificate_of_operation_due_date ? new Date(item.certificate_of_operation_due_date) : undefined,
      description: item.description,
      serialNumber: item.serial_number,
      plantStatus: item.plant_status || 'in_service',
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at),
    })) || [];

    // Cache the result
    if (plantData) {
      await redis.setex(cacheKey, CACHE_TTL, serializePlant(plantData));
      console.log('Plant data cached');
    }

    return { data: plantData };
  } catch (error) {
    console.error('Error fetching plant:', error);
    return { error: 'Failed to fetch plant data' };
  }
}

// Get plant groups - UPDATED with better error handling
export async function getPlantGroups(): Promise<ActionResult<Array<{id: string, name: string}>>> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .schema('equipment')
      .from('plant_groups')
      .select('id, name')
      .order('name');

    if (error) {
      console.error('Supabase error fetching plant groups:', error);
      return { error: error.message };
    }

    console.log('Plant groups loaded from database:', data);
    return { data: data || [] };
  } catch (error) {
    console.error('Error fetching plant groups:', error);
    return { error: 'Failed to fetch plant groups' };
  }
}

// Create new plant - UPDATED error handling
export async function createPlant(plantData: Omit<Plant, 'id' | 'createdAt' | 'updatedAt'>, orgId?: string) {
  try {
    const supabase = createAdminClient()
    
    // Get group ID - use groupName instead of group
    const groupId = plantData.groupId || await getGroupId(plantData.groupName as PlantGroup)
    
  const { data, error } = await supabase
      .schema('equipment')
      .from('plant')
      .insert([
        {
          id: uuidv4(),
          name: plantData.name,
          group_id: groupId,
          auto_id: plantData.autoId,
          registration_number: plantData.registrationNumber || null,
          service_due_date: toYMD(plantData.serviceDueDate), // ← normalize
          location: plantData.location || null,
          responsible_person: plantData.responsiblePerson || null,
          status: plantData.status,
          vehicle_make: plantData.vehicleMake || null,
          vehicle_model: plantData.vehicleModel || null,
          odometer: plantData.odometer || null,
          service_due_odometer: plantData.serviceDueOdometer, 
          last_service_odometer: plantData.lastServiceOdometer, 
          service_interval_km: plantData.serviceIntervalKm, 
          service_interval_days: plantData.serviceIntervalDays, 
          hiab_fitted: plantData.hiabFitted || false,
          hiab_make: plantData.hiabMake || null,
          hiab_model: plantData.hiabModel || null,
          hiab_service_due_date: toYMD(plantData.hiabServiceDueDate), // ← normalize
          uvi: plantData.uvi || null,
          outboard_type: plantData.outboardType || null,
          outboard_quantity: plantData.outboardQuantity || null,
          vessel_survey_due_date: toYMD(plantData.vesselSurveyDueDate), // ← normalize
          vessel_survey_type: plantData.vesselSurveyType || null,
          certificate_of_operation_due_date: toYMD(plantData.certificateOfOperationDueDate), // ← normalize
          description: plantData.description || null,
      serial_number: plantData.serialNumber || null,
      plant_status: plantData.plantStatus || 'in_service',
      organization_id: orgId || null
        }
      ])
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      throw new Error(`Database error: ${error.message}`)
    }

    // Invalidate cache after successful creation
  await redis.del(CACHE_KEYS.PLANT);
  if (orgId) await redis.del(CACHE_KEYS.PLANT_BY_ORG(orgId));
    console.log('Plant cache invalidated after creation');

    const newPlant: Plant = {
      id: data.id,
      name: data.name,
      groupId: data.group_id,
      groupName: data.plant_groups?.name as PlantGroup,
      autoId: data.auto_id,
      registrationNumber: data.registration_number,
      serviceDueDate: data.service_due_date ? new Date(data.service_due_date) : undefined,
      location: data.location,
      responsiblePerson: data.responsible_person,
      status: data.status || 'compliant',
      vehicleMake: data.vehicle_make,
      vehicleModel: data.vehicle_model,
      odometer: data.odometer,
      hiabFitted: data.hiab_fitted || false,
      hiabMake: data.hiab_make,
      hiabModel: data.hiab_model,
      hiabServiceDueDate: data.hiab_service_due_date ? new Date(data.hiab_service_due_date) : undefined,
      serviceDueOdometer: data.service_due_odometer,
      lastServiceOdometer: data.last_service_odometer,
      serviceIntervalKm: data.service_interval_km || 10000,
      serviceIntervalDays: data.service_interval_days || 365,
      uvi: data.uvi,
      outboardType: data.outboard_type,
      outboardQuantity: data.outboard_quantity,
      vesselSurveyDueDate: data.vessel_survey_due_date ? new Date(data.vessel_survey_due_date) : undefined,
      vesselSurveyType: data.vessel_survey_type,
      certificateOfOperationDueDate: data.certificate_of_operation_due_date ? new Date(data.certificate_of_operation_due_date) : undefined,
      description: data.description,
      serialNumber: data.serial_number,
      plantStatus: data.plant_status || 'in_service',
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };

    return { data: newPlant };
  } catch (error) {
    console.error('Error creating plant:', error);
    return { error: 'Failed to create plant' };
  }
}

// Update plant
export async function updatePlant(
  id: string, 
  plantData: Partial<Omit<Plant, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<{ data?: Plant; error?: string }> {
  try {
    console.log('Updating plant with data:', plantData);

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .schema('equipment')
      .from('plant')
      .update({
        name: plantData.name,
        group_id: plantData.groupId,
        auto_id: plantData.autoId,
        registration_number: plantData.registrationNumber,
        service_due_date: toYMD(plantData.serviceDueDate), // ← normalize
        location: plantData.location,
        responsible_person: plantData.responsiblePerson,
        status: plantData.status,
        vehicle_make: plantData.vehicleMake,
        vehicle_model: plantData.vehicleModel,
        odometer: plantData.odometer,
        hiab_fitted: plantData.hiabFitted,
        hiab_make: plantData.hiabMake,
        hiab_model: plantData.hiabModel,
        hiab_service_due_date: toYMD(plantData.hiabServiceDueDate), // ← normalize
        service_due_odometer: plantData.serviceDueOdometer,
        last_service_odometer: plantData.lastServiceOdometer,
        service_interval_km: plantData.serviceIntervalKm,
        service_interval_days: plantData.serviceIntervalDays,
        uvi: plantData.uvi,
        outboard_type: plantData.outboardType,
        outboard_quantity: plantData.outboardQuantity,
        vessel_survey_due_date: toYMD(plantData.vesselSurveyDueDate), // ← normalize
        vessel_survey_type: plantData.vesselSurveyType,
        certificate_of_operation_due_date: toYMD(plantData.certificateOfOperationDueDate), // ← normalize
        description: plantData.description,
        serial_number: plantData.serialNumber,
        plant_status: plantData.plantStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        plant_groups!fk_plant_group_id (
          id,
          name
        )
      `)
      .single();

    if (error) {
      console.error('Supabase update error:', error);
      return { error: `Database error: ${error.message}` };
    }

    // Invalidate cache after successful update
    await redis.del(CACHE_KEYS.PLANT);
    console.log('Plant cache invalidated after update');

    const updatedPlant: Plant = {
      id: data.id,
      name: data.name,
      groupId: data.group_id,
      groupName: data.plant_groups?.name as PlantGroup,
      autoId: data.auto_id,
      registrationNumber: data.registration_number,
      serviceDueDate: data.service_due_date ? new Date(data.service_due_date) : undefined,
      location: data.location,
      responsiblePerson: data.responsible_person,
      status: data.status || 'compliant',
      vehicleMake: data.vehicle_make,
      vehicleModel: data.vehicle_model,
      odometer: data.odometer,
      hiabFitted: data.hiab_fitted || false,
      hiabMake: data.hiab_make,
      hiabModel: data.hiab_model,
      hiabServiceDueDate: data.hiab_service_due_date ? new Date(data.hiab_service_due_date) : undefined,
      serviceDueOdometer: data.service_due_odometer,
      lastServiceOdometer: data.last_service_odometer,
      serviceIntervalKm: data.service_interval_km || 10000,
      serviceIntervalDays: data.service_interval_days || 365,
      uvi: data.uvi,
      outboardType: data.outboard_type,
      outboardQuantity: data.outboard_quantity,
      vesselSurveyDueDate: data.vessel_survey_due_date ? new Date(data.vessel_survey_due_date) : undefined,
      vesselSurveyType: data.vessel_survey_type,
      certificateOfOperationDueDate: data.certificate_of_operation_due_date ? new Date(data.certificate_of_operation_due_date) : undefined,
      description: data.description,
      serialNumber: data.serial_number,
      plantStatus: data.plant_status || 'in_service',
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };

    return { data: updatedPlant };
  } catch (error) {
    console.error('Error updating plant:', error);
    return { error: 'Failed to update plant' };
  }
}

// Delete plant
export async function deletePlant(id: string) {
  try {
    console.log('deletePlant called with ID:', id)
    
    const supabase = createAdminClient()

    // First, delete any related service history
    const { error: serviceError } = await supabase
      .schema('equipment')
      .from('plant_service_history')
      .delete()
      .eq('plant_id', id)

    if (serviceError) {
      console.error('Error deleting service history:', serviceError)
    }

    // Delete the plant
    const { error } = await supabase
      .schema('equipment')
      .from('plant')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting plant:', error)
      throw new Error(`Database error: ${error.message}`)
    }

    await Promise.all([
      invalidatePlantCache(),
      safeRedisDel(CACHE_KEYS.PLANT_SERVICE_HISTORY(id))
    ])

    revalidatePath('/')
    return { error: null }
  } catch (error) {
    const errorMessage = formatError(error)
    console.error('Error deleting plant:', errorMessage)
    return { error: `Failed to delete plant: ${errorMessage}` }
  }
}

// Generate auto ID for new plant
export async function generateAutoId(group: PlantGroup) {
  try {
    const supabase = createAdminClient()
    const groupId = await getGroupId(group)
    
    const { data, error } = await supabase
      .schema('equipment')
      .from('plant')
      .select('auto_id')
      .eq('group_id', groupId)
      .order('auto_id', { ascending: false })

    if (error) {
      console.error('Supabase error:', error)
      throw error
    }

    const groupPlant = data || []
    const nextNumber = groupPlant.length + 1
    return { autoId: `${group.replace(' ', '')}${nextNumber.toString().padStart(3, '0')}`, error: null }
  } catch (error) {
    console.error('Error generating auto ID:', error)
    return { autoId: null, error: `Failed to generate auto ID: ${error}` }
  }
}

// Update plant statuses
export async function updatePlantStatuses() {
  try {
    const supabase = createAdminClient()
    
    // Fetch more plant data needed for status calculation
    const { data: plant, error: fetchError } = await supabase
      .schema('equipment')
      .from('plant')
      .select(`
        id, 
        service_due_date, 
        group_id,
        odometer,
        service_due_odometer,
        service_interval_km
      `)

    if (fetchError) {
      console.error('Supabase error:', fetchError)
      throw fetchError
    }

    // Get groups to map group_id to group name
    const { data: groupsData } = await supabase
      .schema('equipment')
      .from('plant_groups')
      .select('id, name')

    const groupMap = new Map<string, string>()
    groupsData?.forEach(group => {
      groupMap.set(group.id, group.name)
    })

    const updates = plant
      .map(item => {
        if (!item.service_due_date) return null

        // Create a partial plant object with the data needed for status calculation
        const plantForStatus: Partial<Plant> = {
          serviceDueDate: new Date(item.service_due_date),
          groupName: (groupMap.get(item.group_id) || 'Unknown') as PlantGroup, // Changed from group to groupName
          odometer: item.odometer,
          serviceDueOdometer: item.service_due_odometer,
          serviceIntervalKm: item.service_interval_km
        }

        const status = getPlantStatus(plantForStatus)

        return {
          id: item.id,
          status
        }
      })
      .filter((update): update is NonNullable<typeof update> => update !== null)

    const updatePromises = updates.map(update => 
      supabase
        .schema('equipment')
        .from('plant')
        .update({ status: update.status })
        .eq('id', update.id)
    )

    await Promise.all(updatePromises)
    await invalidatePlantCache()
    revalidatePath('/')
    return { error: null }
  } catch (error) {
    console.error('Error updating plant statuses:', error)
    return { error: `Failed to update plant statuses: ${error}` }
  }
}

// Create bulk plant
export async function createBulkPlant(plantList: Partial<Plant>[]) {
  try {
    const supabase = createAdminClient()
    
    const { data: existingPlant } = await supabase
      .schema('equipment')
      .from('plant')
      .select('*')
    
    const usedAutoIds = new Set<string>()
    
    const processedItems = await Promise.all(plantList.map(async (item) => {
      let autoId = item.autoId
      
      if (!autoId) {
        const groupPrefix = (item.groupName as PlantGroup).replace(' ', '') // Changed from group to groupName
        const existingIds = existingPlant
          ?.filter(p => p.auto_id && p.auto_id.startsWith(groupPrefix))
          .map(p => {
            const match = p.auto_id.match(/(\d+)$/)
            return match ? parseInt(match[1], 10) : 0
          })
          .filter(num => !isNaN(num) && num > 0) || []
        
        const nextNumber = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1
        let generatedAutoId = `${groupPrefix}${String(nextNumber).padStart(3, '0')}`
        let counter = nextNumber
        
        while (existingPlant?.some(p => p.auto_id === generatedAutoId) || usedAutoIds.has(generatedAutoId)) {
          counter++
          generatedAutoId = `${groupPrefix}${String(counter).padStart(3, '0')}`
        }
        
        autoId = generatedAutoId
      }
      
      usedAutoIds.add(autoId)
      
      const groupId = await getGroupId(item.groupName as PlantGroup) // Changed from group to groupName
      
      // Create a proper partial plant object for status calculation
      const plantForStatus: Partial<Plant> = {
        serviceDueDate: item.serviceDueDate,
        groupName: item.groupName, // Changed from group to groupName
        odometer: item.odometer,
        serviceDueOdometer: item.serviceDueOdometer,
        serviceIntervalKm: item.serviceIntervalKm
      }
      
      const status = item.serviceDueDate ? getPlantStatus(plantForStatus) : 'compliant'
      
      return {
        id: uuidv4(),
        name: item.name,
        group_id: groupId,
        auto_id: autoId,
        registration_number: item.registrationNumber || null,
        service_due_date: toYMD(item.serviceDueDate), // ← normalize
        location: item.location || null,
        responsible_person: item.responsiblePerson || null,
        status: status,
        vehicle_make: item.vehicleMake || null,
        vehicle_model: item.vehicleModel || null,
        odometer: item.odometer || null,
        hiab_fitted: item.hiabFitted || false,
        hiab_make: item.hiabMake || null,
        hiab_model: item.hiabModel || null,
        hiab_service_due_date: toYMD(item.hiabServiceDueDate), // ← normalize
        uvi: item.uvi || null,
        outboard_type: item.outboardType || null,
        outboard_quantity: item.outboardQuantity || null,
        vessel_survey_due_date: toYMD(item.vesselSurveyDueDate), // ← normalize
        vessel_survey_type: item.vesselSurveyType || null,
        certificate_of_operation_due_date: toYMD(item.certificateOfOperationDueDate), // ← normalize
        description: item.description || null,
        serial_number: item.serialNumber || null,
        plant_status: item.plantStatus || 'in_service'
      }
    }))
    
    const { data, error } = await supabase
      .schema('equipment')
      .from('plant')
      .insert(processedItems)
      .select()
    
    if (error) {
      throw error
    }
    
    await invalidatePlantCache()
    revalidatePath('/')
    return { data, error: null }
  } catch (error) {
    console.error('Error creating bulk plant:', error)
    return { data: null, error: `Failed to create bulk plant: ${error}` }
  }
}