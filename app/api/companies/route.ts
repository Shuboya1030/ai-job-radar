import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const industry = params.get('industry')
  const fundingStage = params.get('funding_stage')
  const hasJobs = params.get('has_jobs')
  const size = params.get('size')
  const search = params.get('search')
  const funded_only = params.get('funded_only')
  const sort = params.get('sort') || 'hot_score'
  const limit = parseInt(params.get('limit') || '30')
  const offset = parseInt(params.get('offset') || '0')

  const db = createSupabaseServerClient()

  let query = db
    .from('companies')
    .select(`
      id, name, website, industry, funding_stage, funding_amount_cents,
      funding_amount_status, employee_range, headquarter, description,
      product_description, founder_name, founder_linkedin, founder_email,
      hot_score, is_hot, logo_url, last_funding_date
    `, { count: 'exact' })
    .eq('is_active', true)

  if (industry) query = query.eq('industry', industry)
  if (fundingStage) query = query.eq('funding_stage', fundingStage)
  if (size) query = query.eq('employee_range', size)
  if (search) query = query.ilike('name', `%${search}%`)
  if (funded_only === 'true') query = query.eq('funding_amount_status', 'known')

  if (sort === 'hot_score') {
    query = query.order('hot_score', { ascending: false }).order('name', { ascending: true })
  } else if (sort === 'funding') {
    query = query.order('funding_amount_cents', { ascending: false, nullsFirst: false })
  } else if (sort === 'name') {
    query = query.order('name', { ascending: true })
  }

  query = query.range(offset, offset + limit - 1)

  const { data: companies, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get job counts per company
  const companyIds = (companies || []).map((c: any) => c.id)
  let jobCounts: Record<string, number> = {}

  if (companyIds.length > 0) {
    const { data: jobs } = await db
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

  let enriched = (companies || []).map((c: any) => ({
    ...c,
    open_jobs: jobCounts[c.id] || 0,
  }))

  // Filter by has_jobs after enrichment (can't do in SQL easily)
  if (hasJobs === 'true') enriched = enriched.filter((c: any) => c.open_jobs > 0)
  if (hasJobs === 'false') enriched = enriched.filter((c: any) => c.open_jobs === 0)

  return NextResponse.json({ companies: enriched, total: count || 0, limit, offset })
}
