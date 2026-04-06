import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const db = createSupabaseServerClient()

  const { data: company, error } = await db
    .from('companies')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 })
  }

  // Get active jobs for this company
  const { data: jobs } = await db
    .from('jobs')
    .select('id, title, location, role_category, work_type, seniority, salary_annual_min, salary_annual_max, apply_url, posted_at')
    .eq('company_id', params.id)
    .eq('is_active', true)
    .is('canonical_job_id', null)
    .order('posted_at', { ascending: false })

  return NextResponse.json({ company, jobs: jobs || [] })
}
