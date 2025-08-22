import { notFound } from 'next/navigation'
import { getOrganizationBySlug } from '@/server/organizations'
import { getEquipment } from '@/lib/equipment/actions/equipment'
import { getPlant } from '@/lib/equipment/actions/plant'
import { getAllInspections, getUnifiedInspectionStats } from '@/lib/equipment/actions/unified-inspections'
import InspectionsClient from '@/components/equipment/inspections-client'

// Next.js 15 may supply params as a Promise; support both shapes.
export default async function InspectionsPage(props: any) {
  const rawParams = props.params
  const slug = (typeof rawParams?.then === 'function' ? (await rawParams) : rawParams).slug as string
  const org = await getOrganizationBySlug(slug)
  if (!org) return notFound()

  const [equipmentRes, plantRes, unifiedRes, statsRes] = await Promise.all([
    getEquipment(org.id),
    getPlant(org.id),
    getAllInspections({ orgSlug: slug }),
    getUnifiedInspectionStats({ orgSlug: slug })
  ])

  return <InspectionsClient
    orgId={org.id}
    orgSlug={slug}
    initialEquipment={equipmentRes.data || []}
    initialPlant={plantRes.data || []}
    initialUnifiedInspections={unifiedRes.data || []}
    initialUnifiedStats={statsRes.data || null}
  />
}