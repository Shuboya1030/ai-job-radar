import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'aijobradar2026'

export async function GET(request: NextRequest) {
  const pwd = request.nextUrl.searchParams.get('pwd')
  if (pwd !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: views } = await supabase
    .from('page_views')
    .select('created_at, path, visitor_id')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(50000)

  if (!views) {
    return NextResponse.json({
      dau: [], topPages: [], totalViews: 0, uniqueVisitors: 0,
      todayVisitors: 0, totalJobs: 0, totalCompanies: 0,
      retention: { segments: {}, cohorts: [], powerUsers: 0 },
    })
  }

  // ─── DAU + Page Stats ──────────────────────────────────────
  const dauMap: Record<string, Set<string>> = {}
  const pageCount: Record<string, number> = {}
  const allVisitors = new Set<string>()

  // Per-visitor: first seen date, all active dates, total views
  const visitorFirstSeen: Record<string, string> = {}
  const visitorActiveDates: Record<string, Set<string>> = {}
  const visitorViewCount: Record<string, number> = {}

  for (const v of views) {
    const date = (v.created_at as string).split('T')[0]
    const vid = v.visitor_id as string

    if (!dauMap[date]) dauMap[date] = new Set()
    dauMap[date].add(vid)
    allVisitors.add(vid)
    pageCount[v.path as string] = (pageCount[v.path as string] || 0) + 1

    // Track per-visitor data
    if (!visitorFirstSeen[vid] || date < visitorFirstSeen[vid]) {
      visitorFirstSeen[vid] = date
    }
    if (!visitorActiveDates[vid]) visitorActiveDates[vid] = new Set()
    visitorActiveDates[vid].add(date)
    visitorViewCount[vid] = (visitorViewCount[vid] || 0) + 1
  }

  const dau = Object.entries(dauMap)
    .map(([date, visitors]) => ({ date, count: visitors.size }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const topPages = Object.entries(pageCount)
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  const today = new Date().toISOString().split('T')[0]
  const todayVisitors = dauMap[today]?.size || 0

  // ─── User Segments ─────────────────────────────────────────
  // Definitions:
  // - New: first seen today
  // - Power: visited 3+ different days
  // - Retained: visited 2+ days (but < 3)
  // - Resurrected: first seen >7 days ago, active in last 3 days, was inactive for 4+ days
  // - Churned: last active >7 days ago
  // - Stale: last active 3-7 days ago

  const threeDaysAgo = new Date()
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
  const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0]

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0]

  let newUsers = 0
  let powerUsers = 0
  let retainedUsers = 0
  let resurrectedUsers = 0
  let staleUsers = 0
  let churnedUsers = 0

  for (const vid of allVisitors) {
    const firstSeen = visitorFirstSeen[vid]
    const activeDates = visitorActiveDates[vid]
    const datesArr = Array.from(activeDates).sort()
    const lastActive = datesArr[datesArr.length - 1]
    const totalDays = activeDates.size

    if (firstSeen === today) {
      newUsers++
    } else if (totalDays >= 3) {
      powerUsers++
    } else if (lastActive < sevenDaysAgoStr) {
      churnedUsers++
    } else if (lastActive < threeDaysAgoStr) {
      staleUsers++
    } else if (firstSeen < sevenDaysAgoStr && lastActive >= threeDaysAgoStr) {
      // Was around >7 days ago and came back recently
      resurrectedUsers++
    } else if (totalDays >= 2) {
      retainedUsers++
    } else {
      // Single visit, not today, within last 3 days
      staleUsers++
    }
  }

  const segments = {
    new: newUsers,
    power: powerUsers,
    retained: retainedUsers,
    resurrected: resurrectedUsers,
    stale: staleUsers,
    churned: churnedUsers,
    total: allVisitors.size,
  }

  // ─── Cohort Retention ──────────────────────────────────────
  // Group users by first-seen date, then check D1, D3, D7 return
  const cohortMap: Record<string, { total: number; d1: number; d3: number; d7: number }> = {}

  for (const vid of allVisitors) {
    const firstSeen = visitorFirstSeen[vid]
    if (!cohortMap[firstSeen]) cohortMap[firstSeen] = { total: 0, d1: 0, d3: 0, d7: 0 }
    cohortMap[firstSeen].total++

    const activeDates = visitorActiveDates[vid]

    // Check D1, D3, D7
    const fs = new Date(firstSeen)
    const d1 = new Date(fs); d1.setDate(d1.getDate() + 1)
    const d3 = new Date(fs); d3.setDate(d3.getDate() + 3)
    const d7 = new Date(fs); d7.setDate(d7.getDate() + 7)

    if (activeDates.has(d1.toISOString().split('T')[0])) cohortMap[firstSeen].d1++
    if (activeDates.has(d3.toISOString().split('T')[0])) cohortMap[firstSeen].d3++
    if (activeDates.has(d7.toISOString().split('T')[0])) cohortMap[firstSeen].d7++
  }

  const cohorts = Object.entries(cohortMap)
    .map(([date, c]) => ({
      date,
      total: c.total,
      d1: c.total > 0 ? Math.round(c.d1 / c.total * 100) : 0,
      d3: c.total > 0 ? Math.round(c.d3 / c.total * 100) : 0,
      d7: c.total > 0 ? Math.round(c.d7 / c.total * 100) : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // ─── Power User Details ────────────────────────────────────
  const powerUserList = Array.from(allVisitors)
    .filter(vid => visitorActiveDates[vid].size >= 3)
    .map(vid => ({
      visitor_id: vid.substring(0, 8) + '...',
      days_active: visitorActiveDates[vid].size,
      total_views: visitorViewCount[vid],
      first_seen: visitorFirstSeen[vid],
    }))
    .sort((a, b) => b.days_active - a.days_active)
    .slice(0, 10)

  // ─── Product Stats ─────────────────────────────────────────
  const { count: totalJobs } = await supabase
    .from('jobs').select('*', { count: 'exact', head: true })
    .eq('is_active', true).is('canonical_job_id', null)

  const { count: totalCompanies } = await supabase
    .from('companies').select('*', { count: 'exact', head: true })
    .eq('is_active', true)

  return NextResponse.json({
    dau,
    topPages,
    totalViews: views.length,
    uniqueVisitors: allVisitors.size,
    todayVisitors,
    totalJobs: totalJobs || 0,
    totalCompanies: totalCompanies || 0,
    retention: {
      segments,
      cohorts,
      powerUsers: powerUserList,
    },
  })
}
