import { NextResponse } from 'next/server'
import { createPlant, getPlant } from '@/lib/equipment/actions/plant'
import type { Plant } from '@/types/equipment/plant'
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
  const result = await getPlant(orgId, force)
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
    const body = (await request.json()) as Omit<Plant, 'id' | 'createdAt' | 'updatedAt'>
    const result = await createPlant(body, orgId)
    if (result.error) return NextResponse.json({ error: String(result.error) }, { status: 400 })
    return NextResponse.json({ data: result.data })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 })
  }
}
