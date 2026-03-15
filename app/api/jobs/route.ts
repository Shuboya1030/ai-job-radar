import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const role = params.get('role')
  const work_type = params.get('work_type')
  const industry = params.get('industry')
  const location = params.get('location')
  const salary_min = params.get('salary_min')
  const salary_max = params.get('salary_max')
  const startup_only = params.get('startup_only')
  const search = params.get('search')
  const limit = parseInt(params.get('limit') || '20')
  const offset = parseInt(params.get('offset') || '0')
  const sort = params.get('sort') || 'posted_at'

  let query = supabase
    .from('v_jobs_full')
    .select('*', { count: 'exact' })

  if (role) query = query.eq('role_category', role)
  if (work_type) query = query.eq('work_type', work_type)
  if (industry) query = query.eq('industry', industry)
  if (location) query = query.ilike('location', `%${location}%`)
  if (salary_min) query = query.gte('salary_annual_min', parseInt(salary_min))
  if (salary_max) query = query.lte('salary_annual_max', parseInt(salary_max))
  if (startup_only === 'true') query = query.eq('company_type', 'Startup')
  if (search) {
    query = query.or(`title.ilike.%${search}%,company_name.ilike.%${search}%`)
  }

  // Sort
  if (sort === 'salary') {
    query = query.order('salary_annual_max', { ascending: false, nullsFirst: false })
  } else {
    query = query.order('posted_at', { ascending: false, nullsFirst: false })
  }

  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ jobs: data || [], total: count || 0, limit, offset })
}
