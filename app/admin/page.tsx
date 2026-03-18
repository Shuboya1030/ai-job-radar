'use client'

import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { Eye, Users, Briefcase, Building2, TrendingUp, Lock, Activity, UserCheck, UserX, Zap } from 'lucide-react'

interface Stats {
  dau: { date: string; count: number }[]
  topPages: { path: string; count: number }[]
  totalViews: number
  uniqueVisitors: number
  todayVisitors: number
  totalJobs: number
  totalCompanies: number
  retention: {
    segments: {
      new: number; power: number; retained: number
      resurrected: number; stale: number; churned: number; total: number
    }
    cohorts: { date: string; total: number; d1: number; d3: number; d7: number }[]
    powerUsers: { visitor_id: string; days_active: number; total_views: number; first_seen: string }[]
  }
}

export default function AdminDashboard() {
  const [password, setPassword] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'overview' | 'retention'>('overview')

  const login = async () => {
    setLoading(true); setError('')
    const res = await fetch(`/api/admin/stats?pwd=${encodeURIComponent(password)}`)
    if (res.ok) {
      setStats(await res.json()); setAuthenticated(true)
      sessionStorage.setItem('admin_pwd', password)
    } else { setError('Wrong password') }
    setLoading(false)
  }

  useEffect(() => {
    const saved = sessionStorage.getItem('admin_pwd')
    if (saved) {
      setPassword(saved)
      fetch(`/api/admin/stats?pwd=${encodeURIComponent(saved)}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) { setStats(data); setAuthenticated(true) } })
    }
  }, [])

  if (!authenticated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="card p-8 w-full max-w-sm">
          <div className="flex items-center gap-2 mb-6">
            <Lock className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-bold text-primary">Admin</h1>
          </div>
          <input
            type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            className="w-full px-3 py-2 rounded border border-zinc-200 text-sm mb-3 focus:outline-none focus:border-zinc-400"
          />
          {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
          <button onClick={login} disabled={loading}
            className="w-full py-2 bg-primary text-white text-sm font-medium rounded hover:bg-zinc-800 transition-colors disabled:opacity-50">
            {loading ? 'Loading...' : 'Log In'}
          </button>
        </div>
      </div>
    )
  }

  if (!stats) return <div className="text-center py-20 text-tertiary text-sm">Loading...</div>

  const seg = stats.retention?.segments

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-bold text-primary">Admin Dashboard</h1>
        <div className="flex gap-0.5 border-b border-zinc-200">
          {(['overview', 'retention'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors ${
                tab === t ? 'border-primary text-primary' : 'border-transparent text-tertiary hover:text-secondary'
              }`}>
              {t === 'overview' ? 'Overview' : 'Retention'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' && (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
            <StatCard icon={Users} label="Today" value={stats.todayVisitors} />
            <StatCard icon={Eye} label="Views (30d)" value={stats.totalViews} />
            <StatCard icon={TrendingUp} label="Uniques (30d)" value={stats.uniqueVisitors} />
            <StatCard icon={Briefcase} label="Active Jobs" value={stats.totalJobs} />
            <StatCard icon={Building2} label="Companies" value={stats.totalCompanies} />
          </div>

          {/* DAU Chart */}
          <div className="card p-5 mb-6">
            <h2 className="section-label mb-4">Daily Active Users</h2>
            {stats.dau.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.dau}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }}
                    tickFormatter={(d: string) => d.slice(5)} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 4, border: '1px solid #e4e4e7', fontSize: 12, fontFamily: 'JetBrains Mono' }} />
                  <Bar dataKey="count" fill="#BFFF00" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-tertiary text-xs text-center py-8">No data yet</p>}
          </div>

          {/* Top Pages */}
          <div className="card p-5">
            <h2 className="section-label mb-4">Top Pages</h2>
            {stats.topPages.map((p, i) => (
              <div key={p.path} className="flex items-center justify-between py-1.5 border-b border-zinc-50 last:border-0">
                <span className="text-xs text-primary"><span className="font-mono text-faint mr-2">{String(i + 1).padStart(2, '0')}</span>{p.path}</span>
                <span className="text-xs font-mono font-semibold text-primary">{p.count}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'retention' && seg && (
        <>
          {/* Segment Cards */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-8">
            <SegmentCard label="New" value={seg.new} total={seg.total} color="#BFFF00" icon={Zap} />
            <SegmentCard label="Power" value={seg.power} total={seg.total} color="#18181B" icon={Activity} />
            <SegmentCard label="Retained" value={seg.retained} total={seg.total} color="#22c55e" icon={UserCheck} />
            <SegmentCard label="Resurrected" value={seg.resurrected} total={seg.total} color="#3b82f6" icon={Users} />
            <SegmentCard label="Stale" value={seg.stale} total={seg.total} color="#f59e0b" icon={Eye} />
            <SegmentCard label="Churned" value={seg.churned} total={seg.total} color="#ef4444" icon={UserX} />
          </div>

          {/* Segment Pie */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="card p-5">
              <h2 className="section-label mb-4">User Segments</h2>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'New', value: seg.new },
                      { name: 'Power', value: seg.power },
                      { name: 'Retained', value: seg.retained },
                      { name: 'Resurrected', value: seg.resurrected },
                      { name: 'Stale', value: seg.stale },
                      { name: 'Churned', value: seg.churned },
                    ].filter(d => d.value > 0)}
                    cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value" strokeWidth={0}
                  >
                    {['#BFFF00', '#18181B', '#22c55e', '#3b82f6', '#f59e0b', '#ef4444'].map((c, i) => (
                      <Cell key={i} fill={c} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 4, border: '1px solid #e4e4e7', fontSize: 12, fontFamily: 'JetBrains Mono' }} />
                  <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11, fontFamily: 'DM Sans' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Segment Definitions */}
            <div className="card p-5">
              <h2 className="section-label mb-4">Definitions</h2>
              <div className="space-y-3 text-xs text-secondary">
                <Def color="#BFFF00" term="New" desc="First seen today" />
                <Def color="#18181B" term="Power" desc="Visited 3+ different days" />
                <Def color="#22c55e" term="Retained" desc="Visited 2 different days" />
                <Def color="#3b82f6" term="Resurrected" desc="First seen >7d ago, returned in last 3d" />
                <Def color="#f59e0b" term="Stale" desc="Last active 3-7 days ago" />
                <Def color="#ef4444" term="Churned" desc="Last active >7 days ago" />
              </div>
            </div>
          </div>

          {/* Cohort Retention Table */}
          <div className="card p-5 mb-6">
            <h2 className="section-label mb-4">Cohort Retention</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-left py-2 font-mono text-tertiary">Cohort</th>
                    <th className="text-right py-2 font-mono text-tertiary">Users</th>
                    <th className="text-right py-2 font-mono text-tertiary">D1</th>
                    <th className="text-right py-2 font-mono text-tertiary">D3</th>
                    <th className="text-right py-2 font-mono text-tertiary">D7</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.retention.cohorts.map(c => (
                    <tr key={c.date} className="border-b border-zinc-50">
                      <td className="py-2 font-mono text-primary">{c.date}</td>
                      <td className="py-2 text-right font-mono text-primary">{c.total}</td>
                      <td className="py-2 text-right font-mono"><RetPct v={c.d1} /></td>
                      <td className="py-2 text-right font-mono"><RetPct v={c.d3} /></td>
                      <td className="py-2 text-right font-mono"><RetPct v={c.d7} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {stats.retention.cohorts.length === 0 && (
              <p className="text-tertiary text-xs text-center py-4">Need more data (2+ days) to show retention</p>
            )}
          </div>

          {/* Power Users */}
          <div className="card p-5">
            <h2 className="section-label mb-4">Power Users (3+ days active)</h2>
            {stats.retention.powerUsers.length > 0 ? (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-left py-2 font-mono text-tertiary">Visitor</th>
                    <th className="text-right py-2 font-mono text-tertiary">Days</th>
                    <th className="text-right py-2 font-mono text-tertiary">Views</th>
                    <th className="text-right py-2 font-mono text-tertiary">First Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.retention.powerUsers.map((u, i) => (
                    <tr key={i} className="border-b border-zinc-50">
                      <td className="py-2 font-mono text-primary">{u.visitor_id}</td>
                      <td className="py-2 text-right font-mono font-semibold text-primary">{u.days_active}</td>
                      <td className="py-2 text-right font-mono text-secondary">{u.total_views}</td>
                      <td className="py-2 text-right font-mono text-tertiary">{u.first_seen}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="text-tertiary text-xs text-center py-4">No power users yet (need 3+ days of data)</p>}
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-tertiary" />
        <span className="text-2xs font-mono text-tertiary">{label}</span>
      </div>
      <p className="text-xl font-mono font-bold text-primary">{value.toLocaleString()}</p>
    </div>
  )
}

function SegmentCard({ label, value, total, color, icon: Icon }: {
  label: string; value: number; total: number; color: string; icon: any
}) {
  const pct = total > 0 ? Math.round(value / total * 100) : 0
  return (
    <div className="card p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-2xs font-mono text-tertiary">{label}</span>
      </div>
      <p className="text-lg font-mono font-bold text-primary">{value}</p>
      <p className="text-2xs font-mono text-faint">{pct}%</p>
    </div>
  )
}

function Def({ color, term, desc }: { color: string; term: string; desc: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-2.5 h-2.5 rounded-sm mt-0.5 flex-shrink-0" style={{ backgroundColor: color }} />
      <div><span className="font-semibold text-primary">{term}</span>: {desc}</div>
    </div>
  )
}

function RetPct({ v }: { v: number }) {
  const bg = v >= 30 ? 'bg-lime/30 text-lime-dark' : v >= 10 ? 'bg-yellow-100 text-yellow-700' : v > 0 ? 'bg-red-50 text-red-500' : 'text-faint'
  return <span className={`px-1.5 py-0.5 rounded text-2xs font-semibold ${bg}`}>{v}%</span>
}
