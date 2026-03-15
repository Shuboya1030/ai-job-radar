'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import HorizontalBarChart from '@/components/charts/bar-chart'

const ROLE_LABELS: Record<string, string> = {
  'AI PM': 'AI PM',
  'AI Engineer': 'AI Engineer',
  'Software Engineer': 'SWE',
}

const COLORS = ['#3b82f6', '#f97316', '#22c55e']

export default function ComparePage() {
  const [data, setData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/market/compare')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="max-w-7xl mx-auto px-6 py-20 text-center text-ink-muted">Loading...</div>

  const roles = Object.keys(data)
  if (roles.length === 0) return (
    <div className="max-w-7xl mx-auto px-6 py-20 text-center text-ink-muted">No comparison data available yet.</div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-2 text-sm text-ink-muted mb-6">
        <Link href="/" className="hover:text-brand-600">Overview</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-ink font-medium">Role Comparison</span>
      </div>

      <h1 className="text-3xl font-bold text-ink mb-8">Role Comparison</h1>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {roles.map((role, i) => {
          const snap = data[role]
          return (
            <div key={role} className="bg-white rounded-2xl p-6 border border-slate-100">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                <h3 className="font-bold text-ink">{role}</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-ink-muted">Jobs</span><span className="font-semibold">{snap.total_jobs}</span></div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Avg Salary</span>
                  <span className="font-semibold text-emerald-600">
                    {snap.salary_stats?.overall_avg_min
                      ? `$${Math.round(snap.salary_stats.overall_avg_min / 1000)}K — $${Math.round((snap.salary_stats.overall_avg_max || snap.salary_stats.overall_avg_min) / 1000)}K`
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between"><span className="text-ink-muted">Top Skill</span><span className="font-semibold">{snap.hard_skills?.[0]?.name || 'N/A'}</span></div>
                <div className="flex justify-between"><span className="text-ink-muted">Top Tool</span><span className="font-semibold">{snap.tools?.[0]?.name || 'N/A'}</span></div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Side by Side Skills */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 mb-8">
        <h2 className="text-lg font-bold text-ink mb-6">Hard Skills — Side by Side</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 text-ink-muted font-medium w-8">#</th>
                {roles.map((role, i) => (
                  <th key={role} className="text-left py-2 font-semibold" style={{ color: COLORS[i] }}>{ROLE_LABELS[role] || role}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }).map((_, idx) => (
                <tr key={idx} className="border-b border-slate-50">
                  <td className="py-2 text-ink-muted">{idx + 1}</td>
                  {roles.map(role => {
                    const skill = data[role]?.hard_skills?.[idx]
                    return (
                      <td key={role} className="py-2 text-ink">
                        {skill ? `${skill.name} (${skill.count})` : '—'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side by Side Tools */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100">
        <h2 className="text-lg font-bold text-ink mb-6">Tools & Technologies — Side by Side</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 text-ink-muted font-medium w-8">#</th>
                {roles.map((role, i) => (
                  <th key={role} className="text-left py-2 font-semibold" style={{ color: COLORS[i] }}>{ROLE_LABELS[role] || role}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }).map((_, idx) => (
                <tr key={idx} className="border-b border-slate-50">
                  <td className="py-2 text-ink-muted">{idx + 1}</td>
                  {roles.map(role => {
                    const tool = data[role]?.tools?.[idx]
                    return (
                      <td key={role} className="py-2 text-ink">
                        {tool ? `${tool.name} (${tool.count})` : '—'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
