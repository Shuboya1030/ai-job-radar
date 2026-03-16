import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  // Get industry stats: job count, company count, total funding, avg funding
  const { data: jobs } = await supabase
    .from('v_jobs_full')
    .select('industry, company_industry, funding_amount_cents, funding_stage, company_is_hot')

  if (!jobs) return NextResponse.json({ industries: [] })

  const stats: Record<string, {
    jobs: number
    companies: Set<string>
    totalFunding: number
    hotCount: number
    stages: Record<string, number>
  }> = {}

  for (const j of jobs as any[]) {
    const ind = j.industry || j.company_industry || 'Other'
    if (ind === 'Other') continue

    if (!stats[ind]) {
      stats[ind] = { jobs: 0, companies: new Set(), totalFunding: 0, hotCount: 0, stages: {} }
    }
    stats[ind].jobs++
    if (j.company_name) stats[ind].companies.add(j.company_name)
    if (j.funding_amount_cents) stats[ind].totalFunding += j.funding_amount_cents
    if (j.company_is_hot) stats[ind].hotCount++
    if (j.funding_stage && j.funding_stage !== 'Unknown') {
      stats[ind].stages[j.funding_stage] = (stats[ind].stages[j.funding_stage] || 0) + 1
    }
  }

  const industries = Object.entries(stats)
    .map(([name, s]) => ({
      name,
      jobs: s.jobs,
      companies: s.companies.size,
      totalFundingCents: s.totalFunding,
      hotCount: s.hotCount,
      topStage: Object.entries(s.stages).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    }))
    .sort((a, b) => b.jobs - a.jobs)

  return NextResponse.json({ industries })
}
