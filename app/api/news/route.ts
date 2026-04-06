import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const eventType = params.get('event_type')
  const industry = params.get('industry')
  const limit = parseInt(params.get('limit') || '20')
  const offset = parseInt(params.get('offset') || '0')

  const db = createSupabaseServerClient()

  let query = db
    .from('news_items')
    .select('*', { count: 'exact' })
    .order('published_at', { ascending: false })

  if (eventType) query = query.eq('event_type', eventType)
  if (industry) query = query.contains('industry_tags', [industry])

  query = query.range(offset, offset + limit - 1)

  const { data: news, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ news: news || [], total: count || 0 })
}
