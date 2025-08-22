'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { getCurrentUser } from '@/server/users'
import { getActiveOrganization, getOrganizationBySlug } from '@/server/organizations'

export interface UnifiedInspection {
  id: string
  type: 'equipment' | 'plant'
  itemId: string
  itemName: string
  itemAutoId: string
  groupName: string
  inspectionDate: Date
  inspectorName: string
  status: 'pass' | 'fail' | 'needs_repair' | 'conditional'
  notes?: string
  nextInspectionDate?: Date
  serviceType?: string
  createdAt: Date
}

export interface GetAllInspectionOptions {
  orgId?: string
  orgSlug?: string
  includeAll?: boolean
}

async function resolveOrgId(opts: GetAllInspectionOptions): Promise<string | undefined> {
  if (opts.includeAll) return undefined
  if (opts.orgId) return opts.orgId
  if (opts.orgSlug) {
    const org = await getOrganizationBySlug(opts.orgSlug)
    if (org?.id) return org.id
  }
  try {
    const { currentUser } = await getCurrentUser()
    const activeOrg = await getActiveOrganization(currentUser.id)
    return activeOrg?.id
  } catch {
    return undefined
  }
}

export async function getAllInspections(opts: GetAllInspectionOptions = {}): Promise<{ data?: UnifiedInspection[]; error?: string }> {
  try {
    const supabase = createAdminClient()
    const orgId = await resolveOrgId(opts)

    // Equipment inspections (optionally scoped)
    let equipmentQuery = supabase
      .schema('equipment')
      .from('inspection_history')
      .select(`
        *,
        equipment!inner (
          id,
          name,
          auto_id,
          organization_id,
          equipment_groups!fk_equipment_group ( name )
        )
      `)
      .order('inspection_date', { ascending: false })

    if (orgId) equipmentQuery = equipmentQuery.eq('equipment.organization_id', orgId)
    const { data: equipmentInspections, error: equipmentError } = await equipmentQuery
    if (equipmentError) throw equipmentError

    // Plant service history (optionally scoped)
    let plantQuery = supabase
      .schema('equipment')
      .from('plant_service_history')
      .select(`
        *,
        plant!inner (
          id,
          name,
            auto_id,
          organization_id,
          plant_groups!fk_plant_group_id ( name )
        )
      `)
      .order('service_date', { ascending: false })
    if (orgId) plantQuery = plantQuery.eq('plant.organization_id', orgId)
    const { data: plantServices, error: plantError } = await plantQuery
    if (plantError) throw plantError

    const transformedEquipmentInspections: UnifiedInspection[] = (equipmentInspections || []).map((item: any) => ({
      id: item.id,
      type: 'equipment',
      itemId: item.equipment_id,
      itemName: item.equipment?.name || 'Unknown Equipment',
      itemAutoId: item.equipment?.auto_id || 'N/A',
      groupName: item.equipment?.equipment_groups?.name || 'Unknown',
      inspectionDate: new Date(item.inspection_date),
      inspectorName: item.inspector_name || 'Unknown',
      status: item.status,
      notes: item.notes,
      nextInspectionDate: item.next_inspection_date ? new Date(item.next_inspection_date) : undefined,
      createdAt: new Date(item.created_at)
    }))

    const transformedPlantServices: UnifiedInspection[] = (plantServices || []).map((item: any) => ({
      id: item.id,
      type: 'plant',
      itemId: item.plant_id,
      itemName: item.plant?.name || 'Unknown Plant',
      itemAutoId: item.plant?.auto_id || 'N/A',
      groupName: item.plant?.plant_groups?.name || 'Unknown',
      inspectionDate: new Date(item.service_date),
      inspectorName: item.serviced_by || 'Unknown',
      status: item.status === 'complete' ? 'pass' : item.status,
      notes: item.notes,
      nextInspectionDate: item.next_service_date ? new Date(item.next_service_date) : undefined,
      serviceType: item.service_type,
      createdAt: new Date(item.created_at)
    }))

    const all = [...transformedEquipmentInspections, ...transformedPlantServices].sort(
      (a, b) => b.inspectionDate.getTime() - a.inspectionDate.getTime()
    )
    return { data: all }
  } catch (error) {
    console.error('Error fetching all inspections:', error)
    return { error: 'Failed to fetch inspections' }
  }
}

export async function getInspectionsByType(type: 'equipment' | 'plant', opts: GetAllInspectionOptions = {}) {
  const { data, error } = await getAllInspections(opts)
  if (error) return { error }
  return { data: (data || []).filter(d => d.type === type) }
}

export async function getInspectionsForItem(itemId: string, type: 'equipment' | 'plant', opts: GetAllInspectionOptions = {}) {
  try {
    const { data, error } = await getAllInspections(opts)
    if (error) return { error }
    const filtered = (data || []).filter(d => d.type === type && d.itemId === itemId)
    return { data: filtered }
  } catch (e) {
    console.error('Error fetching inspections for item', e)
    return { error: 'Failed to fetch inspections for item' }
  }
}

export async function getUnifiedInspectionStats(opts: GetAllInspectionOptions = {}) {
  const { data, error } = await getAllInspections(opts)
  if (error) return { error }
  const inspections = data || []
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())

  const inRange = (date: Date, start: Date) => date >= start
  const month = inspections.filter(i => inRange(i.inspectionDate, startOfMonth))
  const week = inspections.filter(i => inRange(i.inspectionDate, startOfWeek))

  const count = (arr: UnifiedInspection[], t: 'equipment' | 'plant') => arr.filter(i => i.type === t).length

  return {
    data: {
      thisMonth: {
        equipment: count(month, 'equipment'),
        plant: count(month, 'plant'),
        total: month.length
      },
      thisWeek: {
        equipment: count(week, 'equipment'),
        plant: count(week, 'plant'),
        total: week.length
      }
    }
  }
}