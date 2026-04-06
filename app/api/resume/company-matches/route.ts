import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createSupabaseServerClient } from '@/lib/supabase-server'

async function getUser() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value }, set() {}, remove() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createSupabaseServerClient()
  const { data, error } = await db
    .from('user_company_matches')
    .select(`
      id, match_score, match_tier, match_reasoning, skills_matched, skills_missing,
      has_open_jobs, open_job_count,
      companies(id, name, website, industry, funding_stage, funding_amount_cents,
        funding_amount_status, employee_range, headquarter, product_description,
        founder_linkedin, founder_email, founder_name)
    `)
    .eq('user_id', user.id)
    .order('match_score', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ matches: data || [] })
}
