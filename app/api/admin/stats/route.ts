import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'aijobradar2026'

export async function GET(request: NextRequest) {
  // Simple password auth via query param
  const pwd = request.nextUrl.searchParams.get('pwd')
  if (pwd !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // DAU for last 30 days
  const { data: dauData } = await supabase.rpc('get_dau_stats').select('*')

  // If RPC doesn't exist, fall back to raw query via REST
  // Get page views grouped by date
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: views } = await supabase
    .from('page_views')
    .select('created_at, path, visitor_id')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(10000)

  if (!views) {
    return NextResponse.json({ dau: [], topPages: [], totalViews: 0, uniqueVisitors: 0 })
  }

  // Compute DAU
  const dauMap: Record<string, Set<string>> = {}
  const pageCount: Record<string, number> = {}
  const allVisitors = new Set<string>()

  for (const v of views) {
    const date = (v.created_at as string).split('T')[0]
    if (!dauMap[date]) dauMap[date] = new Set()
    dauMap[date].add(v.visitor_id)
    allVisitors.add(v.visitor_id)

    pageCount[v.path] = (pageCount[v.path] || 0) + 1
  }

  const dau = Object.entries(dauMap)
    .map(([date, visitors]) => ({ date, count: visitors.size }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const topPages = Object.entries(pageCount)
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  // Today's stats
  const today = new Date().toISOString().split('T')[0]
  const todayVisitors = dauMap[today]?.size || 0

  // Total stats
  const { count: totalJobs } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)
    .is('canonical_job_id', null)

  const { count: totalCompanies } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  return NextResponse.json({
    dau,
    topPages,
    totalViews: views.length,
    uniqueVisitors: allVisitors.size,
    todayVisitors,
    totalJobs: totalJobs || 0,
    totalCompanies: totalCompanies || 0,
  })
}
