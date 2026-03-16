'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import HorizontalBarChart from '@/components/charts/bar-chart'
import DonutChart from '@/components/charts/pie-chart'
import SalaryRangeChart from '@/components/charts/salary-chart'
import type { MarketSnapshot } from '@/types/database'

const ROLE_LABELS: Record<string, string> = {
  'ai-pm': 'AI Product Manager',
  'ai-engineer': 'AI Engineer',
  'swe': 'Software Engineer',
}

const TABS = ['Skills', 'Salary', 'Resume']

export default function MarketDashboard() {
  const params = useParams()
  const role = params.role as string
  const [data, setData] = useState<MarketSnapshot | null>(null)
  const [tab, setTab] = useState('Skills')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/market?role=${role}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [role])

  if (loading) return <div className="max-w-7xl mx-auto px-6 py-20 text-center text-tertiary text-sm">Loading...</div>
  if (!data) return (
    <div className="max-w-7xl mx-auto px-6 py-20 text-center">
      <p className="text-tertiary text-sm">No data for {ROLE_LABELS[role] || role}.</p>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-2 text-2xs font-mono text-faint mb-4">
        <Link href="/" className="hover:text-primary">Home</Link>
        <span>/</span>
        <span className="text-primary">{ROLE_LABELS[role]}</span>
      </div>

      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-primary">{ROLE_LABELS[role]}</h1>
          <p className="text-xs font-mono text-tertiary mt-1">
            {data.total_jobs} postings &middot; {data.jobs_with_salary_pct}% with salary data
          </p>
        </div>

        {/* Role switcher */}
        <div className="flex gap-1">
          {Object.entries(ROLE_LABELS).map(([slug, label]) => (
            <Link
              key={slug}
              href={`/market/${slug}`}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                slug === role ? 'bg-primary text-white' : 'text-tertiary hover:text-primary'
              }`}
            >
              {slug === 'ai-pm' ? 'PM' : slug === 'ai-engineer' ? 'Eng' : 'SWE'}
            </Link>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 mb-8 border-b border-zinc-200">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-semibold transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-tertiary hover:text-secondary'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Skills Tab */}
      {tab === 'Skills' && (
        <div className="space-y-8">
          <Section title="Hard Skills">
            <HorizontalBarChart
              data={data.hard_skills?.slice(0, 15).map(s => ({ name: s.name, value: s.count, pct: s.pct }))}
              color="#18181B"
              height={420}
            />
          </Section>

          <Section title="Tools & Technologies">
            <HorizontalBarChart
              data={data.tools?.slice(0, 15).map(s => ({ name: s.name, value: s.count, pct: s.pct }))}
              color="#BFFF00"
              height={420}
            />
          </Section>

          <Section title="Soft Skills">
            <HorizontalBarChart
              data={data.soft_skills?.slice(0, 10).map(s => ({ name: s.name, value: s.count, pct: s.pct }))}
              color="#71717A"
              height={300}
            />
          </Section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Section title="Work Type">
              <DonutChart data={Object.entries(data.work_type_dist || {}).map(([k, v]) => ({ name: k, value: v as number }))} />
            </Section>
            <Section title="Seniority">
              <DonutChart data={Object.entries(data.seniority_dist || {}).map(([k, v]) => ({ name: k, value: v as number }))} />
            </Section>
          </div>
        </div>
      )}

      {/* Salary Tab */}
      {tab === 'Salary' && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Avg. Min" value={fmt$(data.salary_stats?.overall_avg_min)} />
            <StatCard label="Avg. Max" value={fmt$(data.salary_stats?.overall_avg_max)} />
          </div>

          <Section title="By Seniority">
            <SalaryRangeChart
              data={Object.entries(data.salary_stats?.by_seniority || {}).map(([k, v]: [string, any]) => ({
                name: k, avg_min: v.avg_min, avg_max: v.avg_max || v.avg_min, count: v.count,
              })).sort((a, b) => a.avg_min - b.avg_min)}
            />
          </Section>

          <Section title="Top Paying Companies">
            <div className="space-y-1">
              {(data.salary_stats?.top_paying_companies || []).slice(0, 10).map((c: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-100 last:border-0">
                  <span className="text-sm text-primary">
                    <span className="font-mono text-xs text-faint mr-2">{String(i + 1).padStart(2, '0')}</span>
                    {c.name}
                  </span>
                  <span className="font-mono text-sm font-semibold text-primary">{fmt$(c.avg_max)}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* Resume Tab */}
      {tab === 'Resume' && (
        <div className="space-y-8">
          <div className="card p-5 border-l-4 border-l-lime">
            <p className="text-sm font-semibold text-primary mb-1">Resume optimization for {ROLE_LABELS[role]}</p>
            <p className="text-xs text-secondary">Based on {data.total_jobs} recent job postings. Include these keywords to match what employers search for.</p>
          </div>

          <KeywordBlock title="Must-Have" subtitle=">30% of JDs mention these" keywords={data.must_have_keywords} accent />
          <KeywordBlock title="Nice-to-Have" subtitle="15–30% of JDs mention these" keywords={data.nice_to_have_keywords} />
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h2 className="section-label mb-4">{title}</h2>
      {children}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5 text-center">
      <p className="section-label mb-1">{label}</p>
      <p className="text-2xl font-mono font-bold text-primary">{value}</p>
    </div>
  )
}

function KeywordBlock({ title, subtitle, keywords, accent }: {
  title: string; subtitle: string;
  keywords: { hard: string[]; soft: string[]; tools: string[] } | null;
  accent?: boolean;
}) {
  if (!keywords) return null
  const { hard, soft, tools } = keywords
  if (!hard?.length && !soft?.length && !tools?.length) return null

  return (
    <div className="card p-5">
      <h3 className="text-sm font-bold text-primary mb-0.5">{title}</h3>
      <p className="text-2xs text-tertiary mb-4">{subtitle}</p>
      {hard?.length > 0 && <TagRow label="Hard Skills" tags={hard} accent={accent} />}
      {tools?.length > 0 && <TagRow label="Tools" tags={tools} accent={accent} />}
      {soft?.length > 0 && <TagRow label="Soft Skills" tags={soft} />}
    </div>
  )
}

function TagRow({ label, tags, accent }: { label: string; tags: string[]; accent?: boolean }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-2xs font-mono text-faint uppercase tracking-widest mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map(t => (
          <span key={t} className={`badge ${accent ? 'bg-lime text-black' : 'bg-surface-raised text-secondary'}`}>
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}

function fmt$(val: number | null | undefined) {
  if (!val) return '—'
  return `$${Math.round(val / 1000)}K`
}
