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

  // Get user profile
  const { data: resume } = await db
    .from('user_resumes')
    .select('parsed_profile')
    .eq('user_id', user.id)
    .single()

  if (!resume?.parsed_profile) {
    return NextResponse.json({ error: 'No parsed profile' }, { status: 404 })
  }

  // Get all matches
  const { data: matches } = await db
    .from('user_job_matches')
    .select('skills_matched, skills_missing, match_tier')
    .eq('user_id', user.id)

  if (!matches || matches.length === 0) {
    return NextResponse.json({ user_skills: resume.parsed_profile.skills, gaps: [], strengths: [] })
  }

  // Aggregate skills across all matches
  const skillMatchCount: Record<string, number> = {}
  const skillMissCount: Record<string, number> = {}
  const totalJobs = matches.length

  for (const m of matches) {
    for (const s of (m.skills_matched as string[])) {
      skillMatchCount[s] = (skillMatchCount[s] || 0) + 1
    }
    for (const s of (m.skills_missing as string[])) {
      skillMissCount[s] = (skillMissCount[s] || 0) + 1
    }
  }

  const strengths = Object.entries(skillMatchCount)
    .map(([skill, count]) => ({ skill, demand_pct: Math.round((count / totalJobs) * 100) }))
    .sort((a, b) => b.demand_pct - a.demand_pct)

  const gaps = Object.entries(skillMissCount)
    .map(([skill, count]) => ({ skill, demand_pct: Math.round((count / totalJobs) * 100) }))
    .sort((a, b) => b.demand_pct - a.demand_pct)

  return NextResponse.json({
    user_skills: resume.parsed_profile.skills,
    strengths,
    gaps,
    total_matches: totalJobs,
  })
}
