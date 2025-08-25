import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { readFile } from 'fs/promises'
import path from 'path'

export async function GET() {
  try {
    // Authenticate user
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Read the NaInspections.json file from the root directory
    const filePath = path.join(process.cwd(), 'NaInspections.json')
    const fileContent = await readFile(filePath, 'utf8')
    const inspections = JSON.parse(fileContent)

    console.log(`Serving ${inspections.length} inspections from JSON file to authenticated user`)

    return NextResponse.json({
      inspections,
      timestamp: new Date().toISOString(),
      total: inspections.length
    })

  } catch (error) {
    console.error('Error serving JSON inspections:', error)
    if (error instanceof Error && error.message.includes('ENOENT')) {
      return NextResponse.json({ error: 'NaInspections.json file not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
