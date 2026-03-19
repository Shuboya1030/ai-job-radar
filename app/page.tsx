'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'

const roles = [
  { slug: 'ai-pm', title: 'AI PM', jobs: '130+', topSkill: 'Product Strategy' },
  { slug: 'ai-engineer', title: 'AI Engineer', jobs: '120+', topSkill: 'Machine Learning' },
  { slug: 'swe', title: 'SWE', jobs: '110+', topSkill: 'Algorithms' },
]

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="noise-bg bg-primary text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 relative z-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-white/5 border border-white/10 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-lime animate-pulse" />
              <span className="text-2xs font-mono text-zinc-400">LIVE DATA &middot; UPDATED DAILY</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1] mb-4">
              Find AI startups
              <br />
              <span className="text-lime">that match you.</span>
            </h1>

            <p className="text-base text-zinc-400 leading-relaxed mb-10 max-w-lg">
              Drop your resume — our AI scans 600+ roles at funded startups and finds
              the ones you&apos;re most qualified for. Ranked, scored, and explained in seconds.
            </p>

            {/* Primary CTA — large and prominent */}
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2.5 px-8 py-4 bg-lime text-black font-bold text-base rounded-lg hover:bg-lime-dark transition-all hover:shadow-[0_0_30px_rgba(191,255,0,0.3)] mb-5"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Upload Resume &mdash; Find Your Best Matches
            </Link>

            <p className="text-2xs text-zinc-500 mb-6">PDF, DOCX, or Markdown &middot; Free &middot; Takes 30 seconds</p>

            {/* Secondary CTAs */}
            <div className="flex gap-3">
              <Link
                href="/jobs"
                className="group flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white font-semibold text-sm rounded-lg border border-white/20 hover:bg-white/20 hover:border-white/30 transition-all"
              >
                <svg className="w-4 h-4 text-zinc-400 group-hover:text-lime transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Browse 600+ jobs
              </Link>
              <Link
                href="/market/ai-engineer"
                className="group flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white font-semibold text-sm rounded-lg border border-white/20 hover:bg-white/20 hover:border-white/30 transition-all"
              >
                <svg className="w-4 h-4 text-zinc-400 group-hover:text-lime transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Market analysis
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Role Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-10">
        <div className="grid grid-cols-3 gap-3">
          {roles.map((role) => (
            <Link
              key={role.slug}
              href={`/market/${role.slug}`}
              className="card card-hover p-4 group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-xs font-semibold text-tertiary">{role.title}</span>
                <span className="badge bg-surface-raised text-tertiary">{role.jobs} jobs</span>
              </div>
              <p className="text-sm font-semibold text-primary mb-1">Top skill</p>
              <p className="text-sm text-secondary">{role.topSkill}</p>
              <div className="mt-3 text-xs font-medium text-lime-dark opacity-0 group-hover:opacity-100 transition-opacity">
                View analysis &rarr;
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Alert CTA — dark interruption band */}
      <AlertCTA />

      {/* Industry Heat Map */}
      <IndustryHeat />

      {/* Upcoming Feature — Resume Matching */}
      <UpcomingResumeMatch />

      {/* What we do */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div>
            <span className="section-label">Market Intelligence</span>
            <h2 className="text-2xl font-bold text-primary mt-2 mb-3">
              Know what employers want
            </h2>
            <p className="text-sm text-secondary leading-relaxed mb-4">
              We analyze 300+ job descriptions weekly using AI. Skills, tools, and
              keywords ranked by frequency — so you know exactly what to put on your resume.
            </p>
            <div className="space-y-2">
              {['Hard skills ranked by % of JDs', 'Salary data by seniority', 'Must-have vs nice-to-have keywords'].map(item => (
                <div key={item} className="flex items-center gap-2 text-sm text-secondary">
                  <span className="w-1 h-1 rounded-full bg-lime" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div>
            <span className="section-label">Job Aggregator</span>
            <h2 className="text-2xl font-bold text-primary mt-2 mb-3">
              Startup jobs you can&apos;t find on LinkedIn
            </h2>
            <p className="text-sm text-secondary leading-relaxed mb-4">
              We pull from LinkedIn, YC startups, Greenhouse, and Lever career pages.
              Every listing shows company funding so you can judge quality at a glance.
            </p>
            <div className="space-y-2">
              {['4 data sources, updated daily', 'Funding stage + amount on every card', 'Filter by industry, role, salary'].map(item => (
                <div key={item} className="flex items-center gap-2 text-sm text-secondary">
                  <span className="w-1 h-1 rounded-full bg-lime" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function AlertCTA() {
  const { user, signInWithGoogle } = useAuth()

  function handleClick() {
    if (user) {
      window.location.href = '/settings'
    } else {
      signInWithGoogle()
    }
  }

  return (
    <section className="relative overflow-hidden">
      {/* Lime band — impossible to miss */}
      <div className="bg-lime">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 md:grid-cols-[1fr,auto] gap-8 items-center">

            {/* Left: Message */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex -space-x-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-black animate-pulse" style={{ animationDelay: '0ms' }} />
                  <span className="w-2.5 h-2.5 rounded-full bg-black/40 animate-pulse" style={{ animationDelay: '200ms' }} />
                  <span className="w-2.5 h-2.5 rounded-full bg-black/15 animate-pulse" style={{ animationDelay: '400ms' }} />
                </div>
                <span className="text-2xs font-mono text-black/50 uppercase tracking-widest">Job Alerts</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-bold text-black leading-tight mb-3">
                New AI startup jobs,<br />
                straight to your inbox.
              </h2>

              <p className="text-sm text-black/60 leading-relaxed max-w-md mb-6">
                Set your filters — role, industry, funding stage — and get matched jobs
                delivered {user ? 'on your schedule' : 'weekly'}. Never miss a hiring window at a freshly funded startup.
              </p>

              <div className="flex items-center gap-4">
                <button
                  onClick={handleClick}
                  className="px-5 py-2.5 bg-black text-lime font-bold text-sm rounded hover:bg-zinc-800 transition-colors"
                >
                  {user ? 'Set up alerts' : 'Sign in to get alerts'}
                </button>
                <span className="text-2xs font-mono text-black/40">Free · No spam · Unsubscribe anytime</span>
              </div>
            </div>

            {/* Right: Visual — fake email preview */}
            <div className="hidden md:block w-72 -rotate-2 hover:rotate-0 transition-transform duration-500">
              <div className="bg-black rounded-lg p-4 shadow-2xl">
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-zinc-800">
                  <div className="w-1.5 h-1.5 rounded-full bg-lime" />
                  <span className="text-2xs font-mono text-zinc-500">AIJobRadar Alert</span>
                </div>
                <p className="text-xs font-semibold text-white mb-2">3 new jobs match your alert</p>
                {[
                  { company: 'Decagon', role: 'AI Engineer', funding: 'Series D · $481M' },
                  { company: 'Nscale', role: 'ML Platform', funding: 'Series C · $2B' },
                  { company: 'Grow Therapy', role: 'Senior SWE', funding: 'Series D · $328M' },
                ].map((j, i) => (
                  <div key={i} className="py-2 border-t border-zinc-800">
                    <div className="flex justify-between items-center">
                      <span className="text-2xs font-semibold text-zinc-300">{j.company}</span>
                      <span className="text-2xs font-mono text-lime">{j.funding}</span>
                    </div>
                    <span className="text-2xs text-zinc-500">{j.role}</span>
                  </div>
                ))}
                <div className="mt-2 pt-2 border-t border-zinc-800">
                  <span className="text-2xs font-mono text-lime">View all matches →</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  )
}

function IndustryHeat() {
  const [data, setData] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/industries')
      .then(r => r.json())
      .then(d => setData(d.industries || []))
      .catch(() => {})
  }, [])

  if (data.length === 0) return null

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center justify-between mb-6">
        <div>
          <span className="section-label">Industry Pulse</span>
          <h2 className="text-xl font-bold text-primary mt-1">Hottest AI sectors right now</h2>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {data.slice(0, 8).map((ind) => (
          <Link
            key={ind.name}
            href={`/jobs?industry=${encodeURIComponent(ind.name)}`}
            className="card card-hover p-4 group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-primary">{ind.name}</span>
              {ind.hotCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
            </div>
            <div className="space-y-1 text-2xs font-mono text-tertiary">
              <div className="flex justify-between">
                <span>Jobs</span>
                <span className="text-primary font-semibold">{ind.jobs}</span>
              </div>
              <div className="flex justify-between">
                <span>Companies</span>
                <span>{ind.companies}</span>
              </div>
              {ind.totalFundingCents > 0 && (
                <div className="flex justify-between">
                  <span>Funding</span>
                  <span className="text-lime-dark font-semibold">${formatFundingShort(ind.totalFundingCents)}</span>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

function UpcomingResumeMatch() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="relative overflow-hidden rounded-xl bg-primary border border-zinc-800">
        {/* Animated scan lines background */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, #BFFF00 2px, #BFFF00 3px)`,
          backgroundSize: '100% 8px',
          animation: 'scanlines 8s linear infinite',
        }} />

        {/* Radial glow from center-right */}
        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #BFFF00 0%, transparent 70%)' }}
        />

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-[1fr,auto] gap-8 items-center p-8 sm:p-12">
          {/* Left: Content */}
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-lime/10 border border-lime/20 mb-5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-lime" />
              </span>
              <span className="text-2xs font-mono text-lime tracking-widest uppercase">New Feature</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-3">
              Upload your resume.
              <br />
              <span className="text-lime">Get matched instantly.</span>
            </h2>

            <p className="text-sm text-zinc-400 leading-relaxed max-w-lg mb-6">
              Drop your resume and our AI will match you with the best roles from 600+
              job listings — scored, ranked, and explained. See exactly which skills you
              have, which you&apos;re missing, and what to learn next.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 mb-8">
              {[
                'AI-powered matching',
                'Strong / Good / Stretch scores',
                'Skills gap analysis',
                'PDF, DOCX & Markdown',
              ].map((feature) => (
                <span
                  key={feature}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-2xs font-mono text-zinc-400"
                >
                  <span className="w-1 h-1 rounded-full bg-lime" />
                  {feature}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="px-5 py-2.5 bg-lime text-black font-bold text-sm rounded hover:bg-lime-dark transition-colors"
              >
                Upload Resume
              </Link>
              <span className="text-2xs font-mono text-zinc-600">Free for all users</span>
            </div>
          </div>

          {/* Right: Visual — match preview card */}
          <div className="hidden md:block w-72">
            <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-lg p-4 shadow-2xl -rotate-1 hover:rotate-0 transition-transform duration-500">
              {/* Header */}
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-zinc-800">
                <div className="w-6 h-6 rounded bg-lime/20 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-lime" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-2xs font-mono text-zinc-500">Your Top Matches</span>
              </div>

              {/* Mock matches */}
              {[
                { company: 'OpenAI', role: 'ML Engineer', score: 94, tier: 'strong', color: 'bg-lime text-black' },
                { company: 'Anthropic', role: 'Research Engineer', score: 87, tier: 'strong', color: 'bg-lime text-black' },
                { company: 'Waymo', role: 'Senior SWE', score: 72, tier: 'good', color: 'bg-yellow-400 text-black' },
                { company: 'Nuro', role: 'AI Engineer', score: 48, tier: 'stretch', color: 'bg-orange-400 text-black' },
              ].map((match, i) => (
                <div key={i} className={`py-2.5 ${i > 0 ? 'border-t border-zinc-800' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-zinc-200">{match.company}</span>
                    <span className={`text-2xs font-mono font-bold px-1.5 py-0.5 rounded ${match.color}`}>
                      {match.score}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-2xs text-zinc-500">{match.role}</span>
                    <span className="text-2xs font-mono text-zinc-600 capitalize">{match.tier}</span>
                  </div>
                </div>
              ))}

              {/* Skills gap teaser */}
              <div className="mt-3 pt-3 border-t border-zinc-800">
                <div className="text-2xs font-mono text-zinc-600 mb-2">Skills Gap</div>
                <div className="flex gap-1.5">
                  {['Python', 'PyTorch', 'NLP'].map(s => (
                    <span key={s} className="text-2xs px-1.5 py-0.5 rounded bg-lime/10 text-lime border border-lime/20">{s}</span>
                  ))}
                  <span className="text-2xs px-1.5 py-0.5 rounded bg-red-400/10 text-red-400 border border-red-400/20">K8s</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CSS for scan animation */}
        <style jsx>{`
          @keyframes scanlines {
            0% { transform: translateY(0); }
            100% { transform: translateY(8px); }
          }
        `}</style>
      </div>
    </section>
  )
}

function formatFundingShort(cents: number): string {
  const d = cents / 100
  if (d >= 1e12) return `${(d / 1e12).toFixed(1)}T`
  if (d >= 1e9) return `${(d / 1e9).toFixed(1)}B`
  if (d >= 1e6) return `${Math.round(d / 1e6)}M`
  return `${Math.round(d / 1e3)}K`
}
