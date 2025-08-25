import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getSupabaseAdmin, getSupabaseBucket } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path')
    
    if (!path) {
      return NextResponse.json({ error: 'Path parameter required' }, { status: 400 })
    }

    // Validate that this is an inspection image path
    if (!path.startsWith('Inspection_Images/')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    if (!supabase) {
      return NextResponse.json({ error: 'Storage unavailable' }, { status: 503 })
    }

    const bucket = getSupabaseBucket()
    if (!bucket) {
      return NextResponse.json({ error: 'Bucket configuration missing' }, { status: 503 })
    }

    // Get the file from Supabase storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path)

    if (error) {
      console.error('Error downloading inspection image:', error)
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Get the file type from the path extension
    const extension = path.split('.').pop()?.toLowerCase()
    let contentType = 'application/octet-stream'
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        contentType = 'image/jpeg'
        break
      case 'png':
        contentType = 'image/png'
        break
      case 'gif':
        contentType = 'image/gif'
        break
      case 'webp':
        contentType = 'image/webp'
        break
    }

    // Return the image with proper headers
    return new Response(data, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      },
    })

  } catch (error) {
    console.error('Error serving inspection image:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
