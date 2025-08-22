// Server component wrapper that fetches org-scoped analytics data then renders client visualizations
import { getEquipment } from '@/lib/equipment/actions/equipment'
import { getPlant } from '@/lib/equipment/actions/plant'
import { getAllInspections, getUnifiedInspectionStats } from '@/lib/equipment/actions/unified-inspections'
import { AnalyticsClient } from '@/components/equipment/analytics-client'
import { getOrganizationBySlug } from '@/server/organizations'
import { notFound } from 'next/navigation'

export default async function AnalyticsPage(props: any) {
  // In Next.js (App Router) params may be provided as an async object; always await to satisfy runtime requirement
  const params = await props.params
  const slug = params.slug
  // Resolve organization
  const org = await getOrganizationBySlug(slug)
  if (!org) return notFound()

  // Fetch scoped data (equipment/plant accept orgId, unified functions accept slug via options)
  const [equipment, plant, inspections, stats] = await Promise.all([
    getEquipment(org.id).then(r => r.data || []),
    getPlant(org.id).then(r => r.data || []),
  getAllInspections({ orgSlug: slug }).then(r => r.data || []),
  getUnifiedInspectionStats({ orgSlug: slug }).then(r => r.data || null),
  ])

  return (
    <AnalyticsClient
      equipment={equipment}
      plant={plant}
      unifiedInspections={inspections}
      unifiedStats={stats}
    />
  )
}