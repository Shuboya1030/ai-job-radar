'use client'

import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Eye, Users, Briefcase, Building2, TrendingUp, Lock } from 'lucide-react'

interface Stats {
  dau: { date: string; count: number }[]
  topPages: { path: string; count: number }[]
  totalViews: number
  uniqueVisitors: number
  todayVisitors: number
  totalJobs: number
  totalCompanies: number
}

export default function AdminDashboard() {
  const [password, setPassword] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const login = async () => {
    setLoading(true)
    setError('')
    const res = await fetch(`/api/admin/stats?pwd=${encodeURIComponent(password)}`)
    if (res.ok) {
      const data = await res.json()
      setStats(data)
      setAuthenticated(true)
      // Save password for session
      sessionStorage.setItem('admin_pwd', password)
    } else {
      setError('Wrong password')
    }
    setLoading(false)
  }

  useEffect(() => {
    const saved = sessionStorage.getItem('admin_pwd')
    if (saved) {
      setPassword(saved)
      fetch(`/api/admin/stats?pwd=${encodeURIComponent(saved)}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data) {
            setStats(data)
            setAuthenticated(true)
          }
        })
    }
  }, [])

  if (!authenticated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm w-full max-w-sm">
          <div className="flex items-center gap-2 mb-6">
            <Lock className="w-5 h-5 text-brand-600" />
            <h1 className="text-lg font-bold text-ink">Admin Dashboard</h1>
          </div>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            className="w-full px-4 py-2 rounded-lg border border-slate-200 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <button
            onClick={login}
            disabled={loading}
            className="w-full py-2 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Log In'}
          </button>
        </div>
      </div>
    )
  }

  if (!stats) return <div className="text-center py-20 text-ink-muted">Loading...</div>

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-ink mb-8">Admin Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <StatCard icon={Users} label="Today" value={stats.todayVisitors} />
        <StatCard icon={Eye} label="Total Views (30d)" value={stats.totalViews} />
        <StatCard icon={TrendingUp} label="Unique Visitors (30d)" value={stats.uniqueVisitors} />
        <StatCard icon={Briefcase} label="Active Jobs" value={stats.totalJobs} />
        <StatCard icon={Building2} label="Companies" value={stats.totalCompanies} />
      </div>

      {/* DAU Chart */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 mb-8">
        <h2 className="text-lg font-bold text-ink mb-4">Daily Active Users (30 days)</h2>
        {stats.dau.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.dau}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(d: string) => d.slice(5)} // MM-DD
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-ink-muted text-sm py-8 text-center">No data yet. Views will appear once users visit the site.</p>
        )}
      </div>

      {/* Top Pages */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100">
        <h2 className="text-lg font-bold text-ink mb-4">Top Pages (30 days)</h2>
        <div className="space-y-2">
          {stats.topPages.map((p, i) => (
            <div key={p.path} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
              <span className="text-sm text-ink">
                <span className="text-ink-muted mr-2">{i + 1}.</span>
                {p.path}
              </span>
              <span className="text-sm font-semibold text-brand-600">{p.count}</span>
            </div>
          ))}
          {stats.topPages.length === 0 && (
            <p className="text-ink-muted text-sm text-center py-4">No page views yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-100">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-brand-500" />
        <span className="text-xs text-ink-muted">{label}</span>
      </div>
      <p className="text-2xl font-bold text-ink">{value.toLocaleString()}</p>
    </div>
  )
}
