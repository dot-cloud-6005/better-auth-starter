import { Equipment, EquipmentGroup, Schedule } from '@/types/equipment/equipment'
import { createClient } from '@/utils/supabase/client'

// Calculate next inspection date based on schedule
export function calculateNextInspection(lastInspection: Date, schedule: Schedule): Date {
  const nextInspection = new Date(lastInspection);
  
  
  
  switch (schedule) {
    case 'Monthly':
      nextInspection.setMonth(nextInspection.getMonth() + 1);
      break;
    case 'Quarterly':
      nextInspection.setMonth(nextInspection.getMonth() + 3);
      break;
    case '6-Monthly': // Make sure this matches your database value
      nextInspection.setMonth(nextInspection.getMonth() + 6);
      break;
    case 'Annual':
      nextInspection.setFullYear(nextInspection.getFullYear() + 1);
      break;
    case 'Biennial':
      nextInspection.setFullYear(nextInspection.getFullYear() + 2);
      break;
    default:
      console.warn('Unknown schedule type:', schedule);
      // Default to monthly if unknown
      nextInspection.setMonth(nextInspection.getMonth() + 1);
  }
  
  
  return nextInspection;
}

// Generate auto ID for equipment
export function generateAutoId(group: EquipmentGroup, existingEquipment: Equipment[]): string {
  const groupEquipment = existingEquipment.filter(eq => eq.groupName === group) // CHANGED: group → groupName
  const nextNumber = groupEquipment.length + 1
  return `${group.replace(' ', '')}${nextNumber}`
}

// Determine equipment status
export function getEquipmentStatus(nextInspection: Date): 'compliant' | 'overdue' | 'upcoming' {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const nextInspectionDate = new Date(nextInspection)
  nextInspectionDate.setHours(0, 0, 0, 0)
  const diffTime = nextInspectionDate.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'overdue'
  if (diffDays <= 30) return 'upcoming'
  return 'compliant'
}

// Fetch equipment from Supabase
export async function getEquipment(): Promise<{ data?: Equipment[]; error?: any }> {
  const supabase = createClient()
  const { data, error } = await supabase.from('equipment').select('*')
  if (error) return { error }
  // Optionally: convert date strings to Date objects if needed
  const parsedData = data?.map((item: any) => ({
    ...item,
    lastInspection: item.lastInspection ? new Date(item.lastInspection) : undefined,
    nextInspection: item.nextInspection ? new Date(item.nextInspection) : undefined,
    createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
    updatedAt: item.updatedAt ? new Date(item.updatedAt) : undefined,
  }))
  return { data: parsedData }
}