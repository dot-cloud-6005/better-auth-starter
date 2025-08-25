import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseAdmin()
    if (!supabase) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 503 })
    }

    const url = new URL(request.url)
    const lastSync = url.searchParams.get('lastSync')
    
    // Get the total count first to handle pagination if needed
    const { count } = await supabase
      .schema('navigation')
      .from('assets')
      .select('*', { count: 'exact', head: true })

    // Use pagination if there are more than 1000 records
    let allAssets: any[] = []
    const pageSize = 1000
    let currentPage = 0
    
    while (true) {
      let query = supabase
        .schema('navigation')
        .from('assets')
        .select('*')
        .order('Asset_Number')
        .range(currentPage * pageSize, (currentPage + 1) * pageSize - 1)
      
      // If lastSync provided, only get assets updated after that timestamp
      if (lastSync) {
        query = query.gt('updated_at', lastSync)
      }

      const { data: assets, error } = await query

      if (error) {
        console.error('Error fetching navigation assets page:', currentPage, error)
        break
      }

      if (!assets || assets.length === 0) {
        break // No more data
      }

      allAssets = allAssets.concat(assets)
      
      // If we got less than pageSize, we're done
      if (assets.length < pageSize) {
        break
      }
      
      currentPage++
    }

    console.log(`Fetched ${allAssets.length} navigation assets from database${lastSync ? ' (incremental update)' : ' (full sync)'}`)

    return NextResponse.json({
      assets: allAssets,
      timestamp: new Date().toISOString(),
      total: allAssets.length
    })

  } catch (error) {
    console.error('Navigation assets API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
