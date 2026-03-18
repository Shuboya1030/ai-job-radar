import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function getUser() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set() {},
        remove() {},
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createSupabaseServerClient()

  // Get saved job IDs
  const { data: saved } = await db
    .from('saved_jobs')
    .select('job_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (!saved || saved.length === 0) {
    return NextResponse.json({ jobs: [], savedIds: [] })
  }

  const jobIds = saved.map((s: any) => s.job_id)

  // Get full job details
  const { data: jobs } = await db
    .from('v_jobs_full')
    .select('*')
    .in('id', jobIds)

  // Also get inactive jobs (user may have saved them before they became inactive)
  const { data: inactiveJobs } = await db
    .from('jobs')
    .select('id, title, source, is_active')
    .in('id', jobIds)
    .eq('is_active', false)

  return NextResponse.json({
    jobs: jobs || [],
    inactiveJobs: inactiveJobs || [],
    savedIds: jobIds,
  })
}

export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { job_id } = await request.json()
  if (!job_id) return NextResponse.json({ error: 'job_id required' }, { status: 400 })

  const db = createSupabaseServerClient()
  const { data, error } = await db.from('saved_jobs').insert({
    user_id: user.id,
    job_id,
  }).select().single()

  if (error) {
    if (error.code === '23505') { // unique violation = already saved
      return NextResponse.json({ message: 'Already saved' }, { status: 200 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
