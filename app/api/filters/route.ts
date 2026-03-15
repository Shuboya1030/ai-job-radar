import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  // Get distinct filter values from active canonical jobs
  const [roles, workTypes, industries, locations] = await Promise.all([
    supabase.from('v_jobs_full').select('role_category').not('role_category', 'is', null),
    supabase.from('v_jobs_full').select('work_type').not('work_type', 'is', null),
    supabase.from('v_jobs_full').select('industry').not('industry', 'is', null),
    supabase.from('v_jobs_full').select('location').not('location', 'is', null).limit(500),
  ])

  const unique = (data: any[] | null, field: string) => {
    if (!data) return []
    const set = new Set(data.map(d => d[field]).filter(Boolean))
    return Array.from(set).sort()
  }

  return NextResponse.json({
    roles: unique(roles.data, 'role_category'),
    work_types: unique(workTypes.data, 'work_type'),
    industries: unique(industries.data, 'industry'),
    locations: unique(locations.data, 'location').slice(0, 50),
  })
}
