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

  const { data: resume } = await db
    .from('user_resumes')
    .select('parsed_profile')
    .eq('user_id', user.id)
    .single()

  if (!resume?.parsed_profile?.skills) {
    return NextResponse.json({ error: 'No parsed profile' }, { status: 404 })
  }

  const userSkills: string[] = resume.parsed_profile.skills
  const userTitles: string[] = resume.parsed_profile.job_titles || []

  const { data: snapshots } = await db
    .from('market_snapshots')
    .select('role_category, hard_skills, tools, total_jobs')

  if (!snapshots?.length) {
    return NextResponse.json({ error: 'No market data' }, { status: 404 })
  }

  // Find best matching role
  const titleStr = userTitles.join(' ').toLowerCase()
  let bestRole = 'AI Engineer'
  if (titleStr.includes('product') || titleStr.includes('pm') || titleStr.includes('manager')) bestRole = 'AI PM'
  else if (titleStr.includes('software') || titleStr.includes('swe') || titleStr.includes('full stack') || titleStr.includes('frontend') || titleStr.includes('backend')) bestRole = 'Software Engineer'

  const snapshot = snapshots.find(s => s.role_category === bestRole) || snapshots[0]

  // Parse market skills
  const parseSkills = (raw: any): { name: string; pct: number }[] => {
    if (!raw) return []
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(arr) ? arr : []
  }

  const allMarketSkills = [...parseSkills(snapshot.hard_skills), ...parseSkills(snapshot.tools)]
  const userSkillsLower = userSkills.map(s => s.toLowerCase())

  const matchSkill = (marketName: string) =>
    userSkillsLower.some(us =>
      us.includes(marketName.toLowerCase()) || marketName.toLowerCase().includes(us)
    )

  const yourStrengths = allMarketSkills
    .filter(ms => matchSkill(ms.name))
    .map(ms => ({ skill: ms.name, demand_pct: ms.pct }))
    .sort((a, b) => b.demand_pct - a.demand_pct)
    .slice(0, 10)

  const yourGaps = allMarketSkills
    .filter(ms => !matchSkill(ms.name))
    .filter(ms => ms.pct >= 10)
    .map(ms => ({ skill: ms.name, demand_pct: ms.pct }))
    .sort((a, b) => b.demand_pct - a.demand_pct)
    .slice(0, 10)

  return NextResponse.json({
    matched_role: bestRole,
    your_strengths: yourStrengths,
    your_gaps: yourGaps,
    total_jobs: snapshot.total_jobs,
  })
}
