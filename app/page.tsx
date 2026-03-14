import { Radar, BarChart3, Briefcase, TrendingUp } from 'lucide-react'
import Link from 'next/link'

const roles = [
  {
    slug: 'ai-pm',
    title: 'AI Product Manager',
    emoji: '🎯',
    color: 'from-violet-500 to-purple-600',
  },
  {
    slug: 'ai-engineer',
    title: 'AI Engineer',
    emoji: '🤖',
    color: 'from-brand-500 to-cyan-500',
  },
  {
    slug: 'swe',
    title: 'Software Engineer',
    emoji: '💻',
    color: 'from-emerald-500 to-teal-600',
  },
]

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.08),transparent)]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <div className="px-3 py-1 rounded-full bg-white/10 text-sm font-medium">
                Updated weekly
              </div>
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
              Your AI Career
              <span className="text-accent-light"> Intelligence</span>
            </h1>
            <p className="text-lg text-blue-100 mb-8 leading-relaxed">
              Real-time skill demand, salary benchmarks, and a unified job board
              for AI professionals. Powered by data from 500+ weekly job postings.
            </p>
            <div className="flex gap-3">
              <Link
                href="/market/ai-engineer"
                className="px-6 py-3 bg-white text-brand-700 font-semibold rounded-xl hover:bg-blue-50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Market Analysis
                </span>
              </Link>
              <Link
                href="/jobs"
                className="px-6 py-3 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/20 transition-colors border border-white/20"
              >
                <span className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  Job Board
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Role Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {roles.map((role) => (
            <Link
              key={role.slug}
              href={`/market/${role.slug}`}
              className="group bg-white rounded-2xl p-6 shadow-lg shadow-slate-200/50 border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-200"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${role.color} flex items-center justify-center text-2xl mb-4`}>
                {role.emoji}
              </div>
              <h3 className="text-lg font-bold text-ink mb-1">{role.title}</h3>
              <p className="text-sm text-ink-muted mb-4">
                Skills, salary, and resume insights
              </p>
              <div className="flex items-center text-sm font-medium text-brand-600 group-hover:text-brand-700">
                View Analysis
                <TrendingUp className="w-4 h-4 ml-1" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-2xl font-bold text-center mb-12">
          Two products. One goal: <span className="text-brand-600">land your AI role.</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl p-8 border border-slate-100">
            <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center mb-4">
              <BarChart3 className="w-5 h-5 text-brand-600" />
            </div>
            <h3 className="text-lg font-bold mb-2">Market Analysis</h3>
            <p className="text-ink-secondary leading-relaxed">
              See what skills employers actually want. Ranked by frequency from
              real job postings. Know exactly what to put on your resume.
            </p>
          </div>
          <div className="bg-white rounded-2xl p-8 border border-slate-100">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
              <Briefcase className="w-5 h-5 text-accent" />
            </div>
            <h3 className="text-lg font-bold mb-2">Job Board</h3>
            <p className="text-ink-secondary leading-relaxed">
              All AI jobs in one place. LinkedIn, Wellfound, YC startups.
              Filter by role, industry, salary, and more. Apply in one click.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
