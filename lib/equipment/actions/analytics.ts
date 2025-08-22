import redis, { CACHE_KEYS, deserializeEquipment, deserializePlant } from '@/lib/equipment/redis'
import { getEquipment } from './equipment'
import { getPlant } from './plant'
import { getPlantServiceHistory } from './plant-inspection'

export async function getAnalyticsData(orgId?: string) {
  try {
    // Try to get data from Redis first
    const [equipmentCache, plantCache, serviceHistoryCache] = await Promise.all([
      redis.get(CACHE_KEYS.EQUIPMENT),
      redis.get(CACHE_KEYS.PLANT),
      redis.get(CACHE_KEYS.ALL_PLANT_SERVICE_HISTORY)
    ])

    let equipment = []
    let plant = []
    let serviceHistory = []

    // Equipment data
    if (equipmentCache) {
      try {
        equipment = deserializeEquipment(equipmentCache)
      } catch (error) {
        console.warn('Failed to deserialize equipment cache, falling back to database')
  const result = await getEquipment(orgId)
        equipment = result.data || []
      }
    } else {
  const result = await getEquipment(orgId)
      equipment = result.data || []
    }

    // Plant data
    if (plantCache) {
      try {
        plant = deserializePlant(plantCache)
      } catch (error) {
        console.warn('Failed to deserialize plant cache, falling back to database')
        const result = await getPlant()
        plant = result.data || []
      }
    } else {
      const result = await getPlant()
      plant = result.data || []
    }

    // Service history data
    if (serviceHistoryCache) {
      try {
        serviceHistory = typeof serviceHistoryCache === 'string' 
          ? JSON.parse(serviceHistoryCache) 
          : serviceHistoryCache
      } catch (error) {
        console.warn('Failed to deserialize service history cache, falling back to database')
        const result = await getPlantServiceHistory()
        serviceHistory = result.data || []
      }
    } else {
      const result = await getPlantServiceHistory()
      serviceHistory = result.data || []
    }

    return {
      equipment,
      plant,
      serviceHistory,
      fromCache: {
        equipment: !!equipmentCache,
        plant: !!plantCache,
        serviceHistory: !!serviceHistoryCache
      }
    }
  } catch (error) {
    console.error('Error loading analytics data:', error)
    throw error
  }
}

// Analytics-specific data processing functions
export function processEquipmentAnalytics(equipment: any[]) {
  return {
    statusData: [
      { 
        name: 'Compliant', 
        value: equipment.filter(eq => eq.status === 'compliant').length, 
        color: '#10b981' 
      },
      { 
        name: 'Upcoming', 
        value: equipment.filter(eq => eq.status === 'upcoming').length, 
        color: '#f59e0b' 
      },
      { 
        name: 'Overdue', 
        value: equipment.filter(eq => eq.status === 'overdue').length, 
        color: '#ef4444' 
      },
    ],
    groupData: [
      // CHANGE: eq.group → eq.groupName
      { name: 'PFD', total: equipment.filter(eq => eq.groupName === 'PFD').length },
      { name: 'Heights Safety', total: equipment.filter(eq => eq.groupName === 'Heights Safety').length },
      { name: 'Fire', total: equipment.filter(eq => eq.groupName === 'Fire').length },
      { name: 'First Aid', total: equipment.filter(eq => eq.groupName === 'First Aid').length },
      { name: 'Racking', total: equipment.filter(eq => eq.groupName === 'Racking').length },
      { name: 'Other', total: equipment.filter(eq => eq.groupName === 'Other').length },
    ].sort((a, b) => b.total - a.total),
    scheduleData: [
      // CHANGE: eq.schedule → eq.scheduleName
      { name: 'Monthly', total: equipment.filter(eq => eq.scheduleName === 'Monthly').length },
      { name: 'Quarterly', total: equipment.filter(eq => eq.scheduleName === 'Quarterly').length },
      { name: '6-Monthly', total: equipment.filter(eq => eq.scheduleName === '6-Monthly').length },
      { name: 'Annual', total: equipment.filter(eq => eq.scheduleName === 'Annual').length },
      { name: 'Biennial', total: equipment.filter(eq => eq.scheduleName === 'Biennial').length },
    ].sort((a, b) => b.total - a.total)
  }
}

export function processPlantAnalytics(plant: any[]) {
  return {
    statusData: [
      { 
        name: 'Compliant', 
        value: plant.filter(p => p.status === 'compliant').length, 
        color: '#10b981' 
      },
      { 
        name: 'Upcoming', 
        value: plant.filter(p => p.status === 'upcoming').length, 
        color: '#f59e0b' 
      },
      { 
        name: 'Overdue', 
        value: plant.filter(p => p.status === 'overdue').length, 
        color: '#ef4444' 
      },
    ],
    groupData: [
      // CHANGE: p.group → p.groupName
      { name: 'Vehicle', total: plant.filter(p => p.groupName === 'Vehicle').length },
      { name: 'Truck', total: plant.filter(p => p.groupName === 'Truck').length },
      { name: 'Trailer', total: plant.filter(p => p.groupName === 'Trailer').length },
      { name: 'Vessel', total: plant.filter(p => p.groupName === 'Vessel').length },
      { name: 'Petrol Plant', total: plant.filter(p => p.groupName === 'Petrol Plant').length },
    ].sort((a, b) => b.total - a.total),
    serviceData: [
      { name: 'Service Due', total: plant.filter(p => p.serviceDueDate).length },
      { name: 'No Service Date', total: plant.filter(p => !p.serviceDueDate).length },
    ].sort((a, b) => b.total - a.total)
  }
}