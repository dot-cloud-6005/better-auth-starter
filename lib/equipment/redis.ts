import { Redis } from '@upstash/redis'
import { Equipment, InspectionHistory } from '@/types/equipment/equipment'
import { Plant } from '@/types/equipment/plant'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export default redis

// Cache keys
export const CACHE_KEYS = {
  EQUIPMENT: 'equipment:all',
  EQUIPMENT_BY_ORG: (orgId: string) => `equipment:org:${orgId}`,
  EQUIPMENT_GROUPS: 'equipment:groups',
  EQUIPMENT_SCHEDULES: 'equipment:schedules',
  INSPECTION_HISTORY: (equipmentId: string) => `inspection:history:${equipmentId}`,
  // New: per-organization aggregated inspection history (all equipment within org)
  ALL_INSPECTION_HISTORY_BY_ORG: (orgId: string) => `inspection:history:org:${orgId}`,

  // Add plant keys
  PLANT: 'plant:all',
  PLANT_BY_ORG: (orgId: string) => `plant:org:${orgId}`,
  PLANT_GROUPS: 'plant:groups',
  PLANT_SERVICE_HISTORY: (id: string) => `plant:service_history:${id}`,
  ALL_PLANT_SERVICE_HISTORY: 'plant:service_history:all'
} as const

// Cache TTL in seconds (2 hours)
export const CACHE_TTL = 2 * 60 * 60 // 7200 seconds

// Safe date helpers for Date | string | null/undefined
const toISO = (val: unknown): string | null => {
  if (!val) return null
  if (val instanceof Date) return val.toISOString()
  if (typeof val === 'string') {
    const d = new Date(val)
    return isNaN(d.getTime()) ? null : d.toISOString()
  }
  return null
}

const toDate = (val: unknown): Date | undefined => {
  if (!val) return undefined
  if (val instanceof Date) return val
  if (typeof val === 'string') {
    const d = new Date(val)
    return isNaN(d.getTime()) ? undefined : d
  }
  return undefined
}

// Helper function to serialize equipment data for caching
export function serializeEquipment(equipment: Equipment[]): string {
  try {
    // Create a clean copy of the equipment array
    const cleanEquipment = equipment.map(item => ({
      id: item.id,
      name: item.name,
      groupId: item.groupId, // CHANGED: group → groupId
      groupName: item.groupName, // ADDED: for joined group name
      autoId: item.autoId,
      description: item.description,
      scheduleId: item.scheduleId, // CHANGED: schedule → scheduleId
      scheduleName: item.scheduleName, // ADDED: for joined schedule name
      lastInspection: item.lastInspection ? item.lastInspection.toISOString() : null,
      nextInspection: item.nextInspection ? item.nextInspection.toISOString() : null,
      status: item.status,
      location: item.location,
      createdAt: item.createdAt ? item.createdAt.toISOString() : null,
      updatedAt: item.updatedAt ? item.updatedAt.toISOString() : null
    }))
    
    return JSON.stringify(cleanEquipment)
  } catch (error) {
    console.error('Error serializing equipment:', error)
    throw new Error('Failed to serialize equipment data')
  }
}

// Helper function to deserialize equipment data from cache
export function deserializeEquipment(cachedData: string | any): Equipment[] {
  try {
    // If it's already an object (from Upstash Redis), use it directly
    // If it's a string, parse it
    const parsed = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData
    
    if (!Array.isArray(parsed)) {
      throw new Error('Cached data is not an array')
    }
    
    return parsed.map((item: any) => ({
      id: item.id,
      name: item.name,
      groupId: item.groupId, // CHANGED: group → groupId
      groupName: item.groupName, // ADDED: for joined group name
      autoId: item.autoId,
      description: item.description,
      scheduleId: item.scheduleId, // CHANGED: schedule → scheduleId
      scheduleName: item.scheduleName, // ADDED: for joined schedule name
      lastInspection: item.lastInspection ? new Date(item.lastInspection) : undefined,
      nextInspection: item.nextInspection ? new Date(item.nextInspection) : new Date(),
      status: item.status,
      location: item.location,
      createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date()
    }))
  } catch (error) {
    console.error('Error deserializing equipment:', error)
    throw new Error('Failed to deserialize equipment data')
  }
}

// Helper function to safely serialize inspection history for caching
export function serializeInspectionHistory(history: InspectionHistory[]): string {
  try {
    const cleanHistory = history.map(item => ({
      id: item.id,
      equipmentId: item.equipmentId,
      inspectionDate: item.inspectionDate.toISOString(),
      inspectorName: item.inspectorName,
      notes: item.notes,
      status: item.status,
      nextInspectionDate: item.nextInspectionDate ? item.nextInspectionDate.toISOString() : null,
      createdAt: item.createdAt.toISOString()
    }))
    
    return JSON.stringify(cleanHistory)
  } catch (error) {
    console.error('Error serializing inspection history:', error)
    throw new Error('Failed to serialize inspection history')
  }
}

// Helper function to deserialize inspection history from cache
export function deserializeInspectionHistory(cachedData: string | any): InspectionHistory[] {
  try {
    // If it's already an object (from Upstash Redis), use it directly
    // If it's a string, parse it
    const parsed = typeof cachedData === 'string' ? JSON.parse(cachedData) : cachedData
    
    if (!Array.isArray(parsed)) {
      throw new Error('Cached data is not an array')
    }
    
    return parsed.map((item: any) => ({
      id: item.id,
      equipmentId: item.equipmentId,
      inspectionDate: new Date(item.inspectionDate),
      inspectorName: item.inspectorName,
      notes: item.notes,
      status: item.status,
      nextInspectionDate: item.nextInspectionDate ? new Date(item.nextInspectionDate) : undefined,
      createdAt: new Date(item.createdAt)
    }))
  } catch (error) {
    console.error('Error deserializing inspection history:', error)
    throw new Error('Failed to deserialize inspection history')
  }
}

// Update plant serialization to handle all date fields properly
export function serializePlant(plant: Plant[]): string {
  try {
    const cleanPlant = plant.map(item => ({
      id: item.id,
      name: item.name,
      groupId: item.groupId,
      groupName: item.groupName,
      autoId: item.autoId,
      registrationNumber: item.registrationNumber,
      serviceDueDate: toISO(item.serviceDueDate),
      location: item.location,
      responsiblePerson: item.responsiblePerson,
      status: item.status,
      vehicleMake: item.vehicleMake,
      vehicleModel: item.vehicleModel,
      odometer: item.odometer,
      hiabFitted: item.hiabFitted,
      hiabMake: item.hiabMake,
      hiabModel: item.hiabModel,
      hiabServiceDueDate: toISO(item.hiabServiceDueDate),
      serviceDueOdometer: item.serviceDueOdometer,
      lastServiceOdometer: item.lastServiceOdometer,
      serviceIntervalKm: item.serviceIntervalKm,
      serviceIntervalDays: item.serviceIntervalDays,
      uvi: item.uvi,
      outboardType: item.outboardType,
      outboardQuantity: item.outboardQuantity,
      vesselSurveyDueDate: toISO(item.vesselSurveyDueDate),
      vesselSurveyType: item.vesselSurveyType,
      certificateOfOperationDueDate: toISO(item.certificateOfOperationDueDate),
      description: item.description,
      serialNumber: item.serialNumber,
      plantStatus: item.plantStatus,
      createdAt: toISO(item.createdAt), // changed
      updatedAt: toISO(item.updatedAt)
    }))
    
    return JSON.stringify(cleanPlant)
  } catch (error) {
    console.error('Error serializing plant data:', error)
    throw error
  }
}

export function deserializePlant(plantData: any): Plant[] {
  try {
    const parsed = typeof plantData === 'string' ? JSON.parse(plantData) : plantData
    if (!Array.isArray(parsed)) {
      throw new Error('Plant data is not an array')
    }
    
    return parsed.map((plant: any) => ({
      id: plant.id,
      name: plant.name,
      groupId: plant.groupId,
      groupName: plant.groupName,
      autoId: plant.autoId,
      registrationNumber: plant.registrationNumber,
      serviceDueDate: plant.serviceDueDate ? new Date(plant.serviceDueDate) : undefined,
      location: plant.location,
      responsiblePerson: plant.responsiblePerson,
      status: plant.status,
      vehicleMake: plant.vehicleMake,
      vehicleModel: plant.vehicleModel,
      odometer: plant.odometer,
      hiabFitted: plant.hiabFitted,
      hiabMake: plant.hiabMake,
      hiabModel: plant.hiabModel,
      hiabServiceDueDate: plant.hiabServiceDueDate ? new Date(plant.hiabServiceDueDate) : undefined,
      serviceDueOdometer: plant.serviceDueOdometer,
      lastServiceOdometer: plant.lastServiceOdometer,
      serviceIntervalKm: plant.serviceIntervalKm,
      serviceIntervalDays: plant.serviceIntervalDays,
      uvi: plant.uvi,
      outboardType: plant.outboardType,
      outboardQuantity: plant.outboardQuantity,
      vesselSurveyDueDate: plant.vesselSurveyDueDate ? new Date(plant.vesselSurveyDueDate) : undefined,
      vesselSurveyType: plant.vesselSurveyType,
      certificateOfOperationDueDate: plant.certificateOfOperationDueDate ? new Date(plant.certificateOfOperationDueDate) : undefined,
      description: plant.description,
      serialNumber: plant.serialNumber,
      plantStatus: plant.plantStatus,
      createdAt: plant.createdAt ? new Date(plant.createdAt) : new Date(),
      updatedAt: plant.updatedAt ? new Date(plant.updatedAt) : new Date()
    }))
  } catch (error) {
    console.error('Error deserializing plant data:', error)
    throw error
  }
}