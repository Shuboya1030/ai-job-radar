'use client'

import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { Eye, Users, Briefcase, Building2, TrendingUp, Lock, Activity, UserCheck, UserX, Zap } from 'lucide-react'

function toSeattle(utcStr: string | null | undefined): string {
  if (!utcStr) return '—'
  return new Date(utcStr).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
}

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
  const [tab, setTab] = useState<'overview' | 'retention' | 'matches' | 'subscribers' | 'suggestions'>('overview')

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
          {(['overview', 'retention', 'matches', 'subscribers', 'suggestions'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors ${
                tab === t ? 'border-primary text-primary' : 'border-transparent text-tertiary hover:text-secondary'
              }`}>
              {t === 'overview' ? 'Overview' : t === 'retention' ? 'Retention' : t === 'matches' ? 'Match Quality' : t === 'subscribers' ? 'Subscribers' : 'Suggestions'}
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

      {tab === 'matches' && <MatchQualityPanel password={password} />}

      {tab === 'subscribers' && <SubscriberHealthPanel password={password} />}

      {tab === 'suggestions' && <SuggestionsPanel password={password} />}
    </div>
  )
}

function MatchQualityPanel({ password }: { password: string }) {
  const [matches, setMatches] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ tier: '', feedback: '' })
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({})

  const fetchMatches = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filter.tier) params.set('tier', filter.tier)
    if (filter.feedback) params.set('feedback', filter.feedback)
    params.set('limit', '30')

    const res = await fetch(`/api/admin/match-reviews?${params}`, {
      headers: { 'x-admin-password': password },
    })
    const data = await res.json()
    setMatches(data.matches || [])
    setTotal(data.total || 0)
    setLoading(false)
  }

  useEffect(() => { fetchMatches() }, [filter])

  const submitReview = async (matchId: string, verdict: string) => {
    await fetch('/api/admin/match-reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ match_id: matchId, verdict, notes: reviewNotes[matchId] || '' }),
    })
    fetchMatches()
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-2 mb-6">
        <select value={filter.tier} onChange={e => setFilter(f => ({ ...f, tier: e.target.value }))}
          className="px-3 py-1.5 rounded border border-zinc-200 text-xs bg-white">
          <option value="">All Tiers</option>
          <option value="strong">Strong</option>
          <option value="good">Good</option>
          <option value="stretch">Stretch</option>
        </select>
        <select value={filter.feedback} onChange={e => setFilter(f => ({ ...f, feedback: e.target.value }))}
          className="px-3 py-1.5 rounded border border-zinc-200 text-xs bg-white">
          <option value="">All Feedback</option>
          <option value="up">Thumbs Up</option>
          <option value="down">Thumbs Down</option>
        </select>
        <span className="text-2xs font-mono text-tertiary self-center">{total} matches</span>
      </div>

      {loading ? (
        <p className="text-center text-tertiary text-sm py-8">Loading...</p>
      ) : matches.length === 0 ? (
        <p className="text-center text-tertiary text-sm py-8">No matches found.</p>
      ) : (
        <div className="space-y-3">
          {matches.map((m: any) => {
            const job = m.jobs
            const company = job?.companies
            const resume = m.user_resumes
            const profile = resume?.parsed_profile
            const review = m.match_reviews?.[0]
            const events = m.match_events || []
            const clicked = events.some((e: any) => e.event_type === 'click')
            const applied = events.some((e: any) => e.event_type === 'apply')

            return (
              <div key={m.id} className="card p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Resume summary */}
                  <div>
                    <p className="text-2xs font-mono text-tertiary mb-1">Resume</p>
                    <p className="text-xs text-primary font-medium">{profile?.job_titles?.[0] || 'Unknown'}</p>
                    <p className="text-2xs text-secondary">{profile?.seniority} &middot; {profile?.experience_years || '?'}y</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {profile?.skills?.slice(0, 5).map((s: string) => (
                        <span key={s} className="text-2xs px-1 py-0.5 rounded bg-zinc-100 text-tertiary">{s}</span>
                      ))}
                    </div>
                  </div>

                  {/* Job info */}
                  <div>
                    <p className="text-2xs font-mono text-tertiary mb-1">Job</p>
                    <p className="text-xs text-primary font-medium">{job?.title}</p>
                    <p className="text-2xs text-secondary">{company?.name} &middot; {company?.funding_stage}</p>
                  </div>

                  {/* Match info */}
                  <div>
                    <p className="text-2xs font-mono text-tertiary mb-1">Match</p>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold ${m.match_tier === 'strong' ? 'text-lime' : m.match_tier === 'good' ? 'text-yellow-500' : 'text-orange-400'}`}>
                        {m.match_tier} ({m.match_score})
                      </span>
                      {m.user_feedback && (
                        <span className={`text-2xs ${m.user_feedback === 'up' ? 'text-lime' : 'text-red-400'}`}>
                          {m.user_feedback === 'up' ? 'thumbs up' : 'thumbs down'}
                          {m.feedback_reason && ` (${m.feedback_reason})`}
                        </span>
                      )}
                    </div>
                    <p className="text-2xs text-tertiary">{m.match_reasoning}</p>
                    <div className="flex gap-2 mt-1 text-2xs">
                      <span className={clicked ? 'text-primary' : 'text-faint'}>{clicked ? 'Clicked' : 'No click'}</span>
                      <span className={applied ? 'text-lime' : 'text-faint'}>{applied ? 'Applied' : 'No apply'}</span>
                    </div>
                  </div>
                </div>

                {/* Admin verdict */}
                <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center gap-2">
                  <span className="text-2xs text-tertiary mr-2">Verdict:</span>
                  {['good', 'bad', 'borderline'].map(v => (
                    <button
                      key={v}
                      onClick={() => submitReview(m.id, v)}
                      className={`px-2 py-1 text-2xs rounded border transition-colors ${
                        review?.verdict === v
                          ? v === 'good' ? 'bg-lime/20 border-lime/30 text-lime' : v === 'bad' ? 'bg-red-400/20 border-red-400/30 text-red-400' : 'bg-yellow-400/20 border-yellow-400/30 text-yellow-600'
                          : 'border-zinc-200 text-tertiary hover:text-primary hover:border-zinc-400'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                  <input
                    type="text"
                    placeholder="Notes..."
                    value={reviewNotes[m.id] || review?.notes || ''}
                    onChange={e => setReviewNotes(n => ({ ...n, [m.id]: e.target.value }))}
                    className="flex-1 px-2 py-1 text-2xs rounded border border-zinc-200 focus:outline-none focus:border-zinc-400"
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SubscriberHealthPanel({ password }: { password: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/subscribers', { headers: { 'x-admin-password': password } })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [password])

  if (loading) return <p className="text-center text-tertiary text-sm py-8">Loading...</p>
  if (!data?.metrics) return <p className="text-center text-tertiary text-sm py-8">Failed to load subscriber data.</p>

  const m = data.metrics
  const subs = data.subscribers || []

  return (
    <div className="space-y-6">
      {/* Health metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="card p-4 text-center">
          <p className="text-2xs font-mono text-tertiary mb-1">Total Users</p>
          <p className="text-2xl font-mono font-bold text-primary">{m.total_users}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xs font-mono text-tertiary mb-1">Active Subscribers</p>
          <p className="text-2xl font-mono font-bold text-emerald-600">{m.active_subscribers}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xs font-mono text-tertiary mb-1">With Resume</p>
          <p className="text-2xl font-mono font-bold text-primary">{m.users_with_resume}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xs font-mono text-tertiary mb-1">Match Success Rate</p>
          <p className={`text-2xl font-mono font-bold ${m.match_success_rate === 100 ? 'text-emerald-600' : 'text-red-500'}`}>{m.match_success_rate}%</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xs font-mono text-tertiary mb-1">Stuck Paid Users</p>
          <p className={`text-2xl font-mono font-bold ${m.stuck_paid_users === 0 ? 'text-emerald-600' : 'text-red-500'}`}>{m.stuck_paid_users}</p>
        </div>
      </div>

      {/* Timing metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <p className="text-2xs font-mono text-tertiary mb-1">Avg Parse Time</p>
          <p className="text-2xl font-mono font-bold text-primary">{m.avg_parse_seconds ? m.avg_parse_seconds + 's' : '—'}</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xs font-mono text-tertiary mb-1">Avg Match Time</p>
          <p className={`text-2xl font-mono font-bold ${m.avg_match_seconds > 120 ? 'text-red-500' : m.avg_match_seconds > 60 ? 'text-amber-500' : 'text-emerald-600'}`}>
            {m.avg_match_seconds ? m.avg_match_seconds + 's' : '—'}
          </p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xs font-mono text-tertiary mb-1">Max Match Time</p>
          <p className={`text-2xl font-mono font-bold ${m.max_match_seconds > 180 ? 'text-red-500' : 'text-primary'}`}>
            {m.max_match_seconds ? m.max_match_seconds + 's' : '—'}
          </p>
        </div>
      </div>

      {/* Conversion funnel */}
      <div className="card p-5">
        <h2 className="section-label mb-4">Conversion Funnel</h2>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-lg font-mono font-bold text-primary">{m.total_users}</p>
            <p className="text-2xs text-tertiary">Registered</p>
          </div>
          <div className="text-xs text-faint">→ {m.signup_to_resume_rate}%</div>
          <div className="text-center">
            <p className="text-lg font-mono font-bold text-primary">{m.users_with_resume}</p>
            <p className="text-2xs text-tertiary">Uploaded Resume</p>
          </div>
          <div className="text-xs text-faint">→ {m.resume_to_pay_rate}%</div>
          <div className="text-center">
            <p className="text-lg font-mono font-bold text-emerald-600">{m.active_subscribers}</p>
            <p className="text-2xs text-tertiary">Paying</p>
          </div>
        </div>
      </div>

      {/* User table */}
      <div className="card p-5">
        <h2 className="section-label mb-4">All Users</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left py-2 font-mono text-tertiary">Email</th>
                <th className="text-left py-2 font-mono text-tertiary">Status</th>
                <th className="text-left py-2 font-mono text-tertiary">Resume</th>
                <th className="text-right py-2 font-mono text-tertiary">Matches</th>
                <th className="text-right py-2 font-mono text-tertiary">Retries</th>
                <th className="text-right py-2 font-mono text-tertiary">Parse</th>
                <th className="text-right py-2 font-mono text-tertiary">Match</th>
                <th className="text-left py-2 font-mono text-tertiary">Joined</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((u: any) => (
                <tr key={u.id} className="border-b border-zinc-50">
                  <td className="py-2 font-mono text-primary">{u.email}</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded text-2xs font-bold ${
                      u.subscription_status === 'active' ? 'bg-emerald-50 text-emerald-700' :
                      u.subscription_status === 'cancelled' ? 'bg-red-50 text-red-600' :
                      'bg-zinc-100 text-zinc-600'
                    }`}>
                      {u.subscription_status || 'free'}
                    </span>
                  </td>
                  <td className="py-2">
                    {u.resume ? (
                      <span className={`px-2 py-0.5 rounded text-2xs font-semibold ${
                        u.resume.processing_status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                        u.resume.processing_status === 'failed' ? 'bg-red-50 text-red-600' :
                        'bg-yellow-50 text-yellow-700'
                      }`}>
                        {u.resume.processing_status}
                      </span>
                    ) : (
                      <span className="text-faint">none</span>
                    )}
                  </td>
                  <td className="py-2 text-right font-mono">
                    <span className={u.subscription_status === 'active' && u.match_count === 0 ? 'text-red-500 font-bold' : 'text-primary'}>
                      {u.match_count}
                    </span>
                  </td>
                  <td className="py-2 text-right font-mono">
                    <span className={u.resume?.match_retry_count > 0 ? 'text-amber-600' : 'text-faint'}>
                      {u.resume?.match_retry_count || 0}
                    </span>
                  </td>
                  <td className="py-2 text-right font-mono text-tertiary">{u.resume?.parse_duration_seconds ? u.resume.parse_duration_seconds + 's' : '—'}</td>
                  <td className="py-2 text-right font-mono">
                    <span className={u.resume?.match_duration_seconds > 120 ? 'text-red-500' : 'text-tertiary'}>
                      {u.resume?.match_duration_seconds ? u.resume.match_duration_seconds + 's' : '—'}
                    </span>
                  </td>
                  <td className="py-2 font-mono text-tertiary">{toSeattle(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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

function SuggestionsPanel({ password }: { password: string }) {
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchSuggestions = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/suggestions', {
        headers: { 'x-admin-password': password },
      })
      const data = await res.json()
      setSuggestions(data.suggestions || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchSuggestions() }, [password])

  const handleAction = async (id: string, action: 'approved' | 'rejected') => {
    setActionLoading(id)
    await fetch('/api/admin/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-password': password },
      body: JSON.stringify({ suggestion_id: id, action }),
    })
    setActionLoading(null)
    fetchSuggestions()
  }

  if (loading) return <p className="text-center text-tertiary text-sm py-8">Loading...</p>

  const pending = suggestions.filter(s => s.status === 'pending')
  const resolved = suggestions.filter(s => s.status !== 'pending')

  return (
    <div className="space-y-6">
      {/* Pending */}
      <div className="card p-5">
        <h2 className="section-label mb-4">Pending Suggestions ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="text-tertiary text-xs text-center py-4">No pending suggestions.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="text-left py-2 font-mono text-tertiary">Company</th>
                  <th className="text-left py-2 font-mono text-tertiary">Website</th>
                  <th className="text-left py-2 font-mono text-tertiary">Reason</th>
                  <th className="text-left py-2 font-mono text-tertiary">Submitted By</th>
                  <th className="text-left py-2 font-mono text-tertiary">Date</th>
                  <th className="text-right py-2 font-mono text-tertiary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((s: any) => (
                  <tr key={s.id} className="border-b border-zinc-50">
                    <td className="py-2 font-medium text-primary">{s.company_name}</td>
                    <td className="py-2">
                      <a href={s.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-[200px] block">
                        {s.website}
                      </a>
                    </td>
                    <td className="py-2 text-secondary max-w-[200px] truncate">{s.reason || '—'}</td>
                    <td className="py-2 font-mono text-tertiary">{s.user_id?.slice(0, 8)}...</td>
                    <td className="py-2 font-mono text-tertiary">{new Date(s.created_at).toLocaleDateString()}</td>
                    <td className="py-2 text-right">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => handleAction(s.id, 'approved')}
                          disabled={actionLoading === s.id}
                          className="px-2 py-1 text-2xs rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleAction(s.id, 'rejected')}
                          disabled={actionLoading === s.id}
                          className="px-2 py-1 text-2xs rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Resolved */}
      {resolved.length > 0 && (
        <div className="card p-5">
          <h2 className="section-label mb-4">Resolved ({resolved.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="text-left py-2 font-mono text-tertiary">Company</th>
                  <th className="text-left py-2 font-mono text-tertiary">Website</th>
                  <th className="text-left py-2 font-mono text-tertiary">Status</th>
                  <th className="text-left py-2 font-mono text-tertiary">Date</th>
                </tr>
              </thead>
              <tbody>
                {resolved.map((s: any) => (
                  <tr key={s.id} className="border-b border-zinc-50">
                    <td className="py-2 font-medium text-primary">{s.company_name}</td>
                    <td className="py-2">
                      <a href={s.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {s.website}
                      </a>
                    </td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded text-2xs font-bold ${
                        s.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-2 font-mono text-tertiary">{new Date(s.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
