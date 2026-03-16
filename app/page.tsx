import Link from 'next/link'

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
              AI startup jobs,
              <br />
              <span className="text-lime">decoded.</span>
            </h1>

            <p className="text-base text-zinc-400 leading-relaxed mb-8 max-w-lg">
              Real-time skill demand from 365+ job postings. Salary benchmarks.
              Company funding data. Everything you need to land your next AI role.
            </p>

            <div className="flex gap-3">
              <Link
                href="/jobs"
                className="px-5 py-2.5 bg-lime text-black font-semibold text-sm rounded hover:bg-lime-dark transition-colors"
              >
                Browse jobs
              </Link>
              <Link
                href="/market/ai-engineer"
                className="px-5 py-2.5 bg-white/5 text-white font-medium text-sm rounded border border-white/10 hover:bg-white/10 transition-colors"
              >
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
