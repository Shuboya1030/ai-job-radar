'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import HorizontalBarChart from '@/components/charts/bar-chart'
import DonutChart from '@/components/charts/pie-chart'
import SalaryRangeChart from '@/components/charts/salary-chart'
import { ChevronRight, TrendingUp, DollarSign, FileText } from 'lucide-react'
import type { MarketSnapshot } from '@/types/database'

const ROLE_LABELS: Record<string, string> = {
  'ai-pm': 'AI Product Manager',
  'ai-engineer': 'AI Engineer',
  'swe': 'Software Engineer',
}

const TABS = [
  { key: 'skills', label: 'Skills & Tools', icon: TrendingUp },
  { key: 'salary', label: 'Salary', icon: DollarSign },
  { key: 'resume', label: 'Resume Tips', icon: FileText },
]

export default function MarketDashboard() {
  const params = useParams()
  const role = params.role as string
  const [data, setData] = useState<MarketSnapshot | null>(null)
  const [tab, setTab] = useState('skills')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/market?role=${role}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [role])

  if (loading) return <div className="max-w-7xl mx-auto px-6 py-20 text-center text-ink-muted">Loading...</div>
  if (!data) return (
    <div className="max-w-7xl mx-auto px-6 py-20 text-center">
      <p className="text-ink-muted mb-4">No market data available yet for {ROLE_LABELS[role] || role}.</p>
      <p className="text-sm text-ink-muted">Data is generated weekly. Check back soon.</p>
    </div>
  )

  const roleLabel = ROLE_LABELS[role] || role

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-ink-muted mb-6">
        <Link href="/" className="hover:text-brand-600">Overview</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-ink font-medium">{roleLabel}</span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-ink mb-2">{roleLabel}</h1>
        <p className="text-ink-secondary">
          Based on {data.total_jobs} job postings (past 7 days) · {data.jobs_with_salary_pct}% include salary
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-tertiary rounded-xl p-1 mb-8 w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? 'bg-white text-brand-700 shadow-sm' : 'text-ink-secondary hover:text-ink'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Skills Tab */}
      {tab === 'skills' && (
        <div className="space-y-8">
          <Section title="Top Hard Skills">
            <HorizontalBarChart data={data.hard_skills?.slice(0, 15).map(s => ({ name: s.name, value: s.count, pct: s.pct }))} color="#3b82f6" height={450} />
          </Section>
          <Section title="Top Tools & Technologies">
            <HorizontalBarChart data={data.tools?.slice(0, 15).map(s => ({ name: s.name, value: s.count, pct: s.pct }))} color="#ef4444" height={450} />
          </Section>
          <Section title="Top Soft Skills">
            <HorizontalBarChart data={data.soft_skills?.slice(0, 10).map(s => ({ name: s.name, value: s.count, pct: s.pct }))} color="#22c55e" height={350} />
          </Section>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Section title="Work Type Distribution">
              <DonutChart data={Object.entries(data.work_type_dist || {}).map(([k, v]) => ({ name: k, value: v as number }))} />
            </Section>
            <Section title="Seniority Distribution">
              <DonutChart data={Object.entries(data.seniority_dist || {}).map(([k, v]) => ({ name: k, value: v as number }))} />
            </Section>
          </div>
        </div>
      )}

      {/* Salary Tab */}
      {tab === 'salary' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <StatCard label="Avg. Min Salary" value={formatSalary(data.salary_stats?.overall_avg_min)} />
            <StatCard label="Avg. Max Salary" value={formatSalary(data.salary_stats?.overall_avg_max)} />
          </div>
          <Section title="Salary Range by Seniority">
            <SalaryRangeChart
              data={Object.entries(data.salary_stats?.by_seniority || {}).map(([k, v]: [string, any]) => ({
                name: k, avg_min: v.avg_min, avg_max: v.avg_max || v.avg_min, count: v.count,
              })).sort((a, b) => a.avg_min - b.avg_min)}
            />
          </Section>
          <Section title="Top Paying Companies">
            <div className="space-y-3">
              {(data.salary_stats?.top_paying_companies || []).slice(0, 10).map((c: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <span className="text-sm font-medium text-ink">{i + 1}. {c.name}</span>
                  <span className="text-sm font-semibold text-brand-600">{formatSalary(c.avg_max)}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* Resume Tab */}
      {tab === 'resume' && (
        <div className="space-y-8">
          <div className="bg-brand-50 rounded-2xl p-6 border border-brand-100">
            <h3 className="font-bold text-brand-800 mb-2">Resume Optimization for {roleLabel}</h3>
            <p className="text-sm text-brand-700">Based on {data.total_jobs} recent job postings. Include these keywords to match what employers are looking for.</p>
          </div>

          <KeywordSection title="Must-Have Keywords" subtitle="Appear in >30% of job descriptions" keywords={data.must_have_keywords} color="brand" />
          <KeywordSection title="Nice-to-Have Keywords" subtitle="Appear in 15-30% of job descriptions" keywords={data.nice_to_have_keywords} color="accent" />
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100">
      <h2 className="text-lg font-bold text-ink mb-4">{title}</h2>
      {children}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 text-center">
      <p className="text-sm text-ink-muted mb-1">{label}</p>
      <p className="text-3xl font-bold text-ink">{value}</p>
    </div>
  )
}

function KeywordSection({ title, subtitle, keywords, color }: {
  title: string; subtitle: string;
  keywords: { hard: string[]; soft: string[]; tools: string[] } | null;
  color: string;
}) {
  if (!keywords) return null
  const { hard, soft, tools } = keywords
  if (!hard?.length && !soft?.length && !tools?.length) return null

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100">
      <h3 className="font-bold text-ink mb-1">{title}</h3>
      <p className="text-sm text-ink-muted mb-4">{subtitle}</p>
      {hard?.length > 0 && <TagGroup label="Hard Skills" tags={hard} color={color} />}
      {tools?.length > 0 && <TagGroup label="Tools & Tech" tags={tools} color={color} />}
      {soft?.length > 0 && <TagGroup label="Soft Skills" tags={soft} color={color} />}
    </div>
  )
}

function TagGroup({ label, tags, color }: { label: string; tags: string[]; color: string }) {
  const bgClass = color === 'brand' ? 'bg-brand-50 text-brand-700' : 'bg-orange-50 text-orange-700'
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {tags.map(t => (
          <span key={t} className={`px-3 py-1 rounded-full text-sm font-medium ${bgClass}`}>{t}</span>
        ))}
      </div>
    </div>
  )
}

function formatSalary(val: number | null | undefined) {
  if (!val) return 'N/A'
  return `$${Math.round(val / 1000)}K`
}
