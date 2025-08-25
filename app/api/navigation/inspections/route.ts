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
    const assetId = url.searchParams.get('assetId')
    const afterDate = url.searchParams.get('afterDate')
    
    // Determine date filter - either after specific date, or last 16 months
    let dateFilter: string
    if (afterDate) {
      dateFilter = afterDate
      console.log(`Filtering inspections after date: ${afterDate}`)
    } else {
      const sixteenMonthsAgo = new Date()
      sixteenMonthsAgo.setMonth(sixteenMonthsAgo.getMonth() - 16)
      dateFilter = sixteenMonthsAgo.toISOString().split('T')[0]
      console.log(`Filtering inspections from last 16 months: ${dateFilter}`)
    }
    
    let allInspections: any[] = []
    const pageSize = 1000
    let currentPage = 0
    
    while (true) {
      let query = supabase
        .schema('navigation')
        .from('inspections_v')
        .select('*')
        .gte('inspection_date', dateFilter)
        .order('inspection_date', { ascending: false })
        .range(currentPage * pageSize, (currentPage + 1) * pageSize - 1)
      
      // Filter by asset if specified
      if (assetId) {
        query = query.eq('asset_id', parseInt(assetId))
      }
      
      // If lastSync provided, only get inspections updated after that timestamp  
      if (lastSync) {
        query = query.gt('modified_raw', lastSync)
      }

      const { data: inspections, error } = await query

      if (error) {
        console.error('Error fetching navigation inspections page:', currentPage, error)
        break
      }

      if (!inspections || inspections.length === 0) {
        break // No more data
      }

      allInspections = allInspections.concat(inspections)
      
      // If we got less than pageSize, we're done
      if (inspections.length < pageSize) {
        break
      }
      
      currentPage++
    }

    console.log(`Fetched ${allInspections.length} navigation inspections from database${lastSync ? ' (incremental update)' : ' (full sync)'}${assetId ? ` for asset ${assetId}` : ''}`)

    return NextResponse.json({
      inspections: allInspections,
      timestamp: new Date().toISOString(),
      total: allInspections.length
    })

  } catch (error) {
    console.error('Navigation inspections API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
