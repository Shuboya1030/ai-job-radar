import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const ROLE_MAP: Record<string, string> = {
  'ai-pm': 'AI PM',
  'ai-engineer': 'AI Engineer',
  'swe': 'Software Engineer',
}

export async function GET(request: NextRequest) {
  const roleSlug = request.nextUrl.searchParams.get('role')

  if (!roleSlug || !ROLE_MAP[roleSlug]) {
    return NextResponse.json({ error: 'Invalid role. Use: ai-pm, ai-engineer, swe' }, { status: 400 })
  }

  const roleCategory = ROLE_MAP[roleSlug]

  const { data, error } = await supabase
    .from('market_snapshots')
    .select('*')
    .eq('role_category', roleCategory)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'No snapshot found' }, { status: 404 })
  }

  // Parse JSON fields
  const r = data as Record<string, any>
  const parse = (v: any) => typeof v === 'string' ? JSON.parse(v) : v
  const snapshot = {
    ...r,
    hard_skills: parse(r.hard_skills),
    soft_skills: parse(r.soft_skills),
    tools: parse(r.tools),
    work_type_dist: parse(r.work_type_dist),
    seniority_dist: parse(r.seniority_dist),
    salary_stats: parse(r.salary_stats),
    top_companies: parse(r.top_companies),
    top_locations: parse(r.top_locations),
    experience_dist: parse(r.experience_dist),
    must_have_keywords: parse(r.must_have_keywords),
    nice_to_have_keywords: parse(r.nice_to_have_keywords),
  }

  return NextResponse.json(snapshot)
}
