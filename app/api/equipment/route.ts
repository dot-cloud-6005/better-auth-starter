import { NextResponse } from 'next/server'
import { createEquipment, getEquipment } from '@/lib/equipment/actions/equipment'
import type { Equipment } from '@/types/equipment/equipment'
import { getOrganizationBySlug } from '@/server/organizations'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug') || undefined
  let orgId: string | undefined
  if (slug) {
    const org = await getOrganizationBySlug(slug)
    orgId = org?.id
  }
  const force = searchParams.get('forceFresh') === '1'
  const result = await getEquipment(orgId, force)
  if (result.error) return NextResponse.json({ error: String(result.error) }, { status: 500 })
  return NextResponse.json({ data: result.data ?? [] })
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug') || undefined
    let orgId: string | undefined
    if (slug) {
      const org = await getOrganizationBySlug(slug)
      orgId = org?.id
    }
    const body = (await request.json()) as Omit<Equipment, 'id' | 'createdAt' | 'updatedAt'>
    const result = await createEquipment(body, orgId)
    if (result.error) return NextResponse.json({ error: String(result.error) }, { status: 400 })
    return NextResponse.json({ data: result.data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 })
  }
}
