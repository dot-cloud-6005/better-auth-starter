'use server'

import { getEquipment, getEquipmentGroups, getEquipmentSchedules } from './actions/equipment'

export async function warmCache() {
  try {
    console.log('Warming cache...')
    
    // Warm up the main caches
    await Promise.all([
      getEquipment(),
      getEquipmentGroups(), 
      getEquipmentSchedules()
    ])
    
    console.log('Cache warmed successfully')
    return { success: true }
  } catch (error) {
    console.error('Error warming cache:', error)
    return { success: false, error: error }
  }
}