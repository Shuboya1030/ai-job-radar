import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const industry = request.nextUrl.searchParams.get('industry')
  const exclude = request.nextUrl.searchParams.get('exclude') // company name to exclude
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '6')

  if (!industry) {
    return NextResponse.json({ companies: [] })
  }

  let query = supabase
    .from('companies')
    .select('id, name, industry, funding_stage, funding_amount_cents, funding_amount_status, employee_range, is_hot')
    .eq('is_active', true)
    .eq('industry', industry)
    .order('funding_amount_cents', { ascending: false, nullsFirst: false })
    .limit(limit + 1) // +1 in case we need to exclude one

  const { data } = await query

  let companies = (data || []) as any[]
  if (exclude) {
    companies = companies.filter(c => c.name !== exclude)
  }
  companies = companies.slice(0, limit)

  // Get job counts
  const ids = companies.map((c: any) => c.id)
  let jobCounts: Record<string, number> = {}

  if (ids.length > 0) {
    const { data: jobs } = await supabase
      .from('jobs')
      .select('company_id')
      .in('company_id', ids)
      .eq('is_active', true)
      .is('canonical_job_id', null)

    for (const j of (jobs || []) as any[]) {
      jobCounts[j.company_id] = (jobCounts[j.company_id] || 0) + 1
    }
  }

  const enriched = companies.map((c: any) => ({
    ...c,
    open_jobs: jobCounts[c.id] || 0,
  }))

  return NextResponse.json({ companies: enriched })
}
