import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const industry = params.get('industry')
  const search = params.get('search')
  const funded_only = params.get('funded_only')
  const sort = params.get('sort') || 'funding'
  const limit = parseInt(params.get('limit') || '50')
  const offset = parseInt(params.get('offset') || '0')

  // Get companies with job counts
  let query = supabase
    .from('companies')
    .select('*', { count: 'exact' })
    .eq('is_active', true)

  if (industry) query = query.eq('industry', industry)
  if (search) query = query.ilike('name', `%${search}%`)
  if (funded_only === 'true') query = query.eq('funding_amount_status', 'known')

  if (sort === 'funding') {
    query = query.order('funding_amount_cents', { ascending: false, nullsFirst: false })
  } else if (sort === 'name') {
    query = query.order('name', { ascending: true })
  }

  query = query.range(offset, offset + limit - 1)

  const { data: companies, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Get job counts per company
  const companyIds = (companies || []).map((c: any) => c.id)
  let jobCounts: Record<string, number> = {}

  if (companyIds.length > 0) {
    const { data: jobs } = await supabase
      .from('jobs')
      .select('company_id')
      .in('company_id', companyIds)
      .eq('is_active', true)
      .is('canonical_job_id', null)

    if (jobs) {
      for (const j of jobs as any[]) {
        jobCounts[j.company_id] = (jobCounts[j.company_id] || 0) + 1
      }
    }
  }

  const enriched = (companies || []).map((c: any) => ({
    ...c,
    open_jobs: jobCounts[c.id] || 0,
  }))

  return NextResponse.json({ companies: enriched, total: count || 0, limit, offset })
}
