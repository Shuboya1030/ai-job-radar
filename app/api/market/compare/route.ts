import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const ROLES = ['AI PM', 'AI Engineer', 'Software Engineer']

export async function GET() {
  const snapshots: Record<string, any> = {}

  for (const role of ROLES) {
    const { data } = await supabase
      .from('market_snapshots')
      .select('*')
      .eq('role_category', role)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single()

    if (data) {
      const parse = (v: any) => typeof v === 'string' ? JSON.parse(v) : v
      const r = data as Record<string, any>
      snapshots[role] = {
        ...r,
        hard_skills: parse(r.hard_skills),
        soft_skills: parse(r.soft_skills),
        tools: parse(r.tools),
        salary_stats: parse(r.salary_stats),
        work_type_dist: parse(r.work_type_dist),
        must_have_keywords: parse(r.must_have_keywords),
      }
    }
  }

  return NextResponse.json(snapshots)
}
