'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, MapPin, DollarSign, TrendingUp, ExternalLink } from 'lucide-react'
import Link from 'next/link'

const ROLE_OPTIONS = ['AI PM', 'AI Engineer', 'Software Engineer']
const WORK_TYPE_OPTIONS = ['Remote', 'Hybrid', 'On-site']
const INDUSTRY_OPTIONS = [
  'AI/ML', 'Fintech', 'Healthcare', 'E-commerce', 'SaaS', 'Cybersecurity',
  'Robotics', 'EdTech', 'Adtech', 'Cloud/Infra', 'Gaming', 'Automotive',
  'Biotech', 'Enterprise Software', 'Social/Media',
]

export default function JobBoard() {
  const [jobs, setJobs] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [offset, setOffset] = useState(0)
  const limit = 30

  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [workType, setWorkType] = useState('')
  const [industry, setIndustry] = useState('')
  const [sort, setSort] = useState('posted_at')

  const fetchJobs = useCallback(async (reset = false) => {
    setLoading(true)
    const newOffset = reset ? 0 : offset
    const params = new URLSearchParams()
    if (role) params.set('role', role)
    if (workType) params.set('work_type', workType)
    if (industry) params.set('industry', industry)
    if (search) params.set('search', search)
    params.set('sort', sort)
    params.set('limit', String(limit))
    params.set('offset', String(newOffset))

    const res = await fetch(`/api/jobs?${params}`)
    const data = await res.json()

    if (reset) {
      setJobs(data.jobs || [])
      setOffset(0)
    } else {
      setJobs(prev => [...prev, ...(data.jobs || [])])
    }
    setTotal(data.total || 0)
    setLoading(false)
  }, [role, workType, industry, search, sort, offset])

  useEffect(() => { fetchJobs(true) }, [role, workType, industry, sort])

  const handleSearch = () => fetchJobs(true)
  const loadMore = () => {
    const newOffset = offset + limit
    setOffset(newOffset)
    // fetch with new offset
    const params = new URLSearchParams()
    if (role) params.set('role', role)
    if (workType) params.set('work_type', workType)
    if (industry) params.set('industry', industry)
    if (search) params.set('search', search)
    params.set('sort', sort)
    params.set('limit', String(limit))
    params.set('offset', String(newOffset))
    fetch(`/api/jobs?${params}`)
      .then(r => r.json())
      .then(data => setJobs(prev => [...prev, ...(data.jobs || [])]))
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-ink mb-1">AI Job Board</h1>
      <p className="text-ink-secondary mb-6">
        {total} active positions · Updated daily
      </p>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              placeholder="Search jobs or companies..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>
          <Select value={role} onChange={setRole} options={ROLE_OPTIONS} placeholder="All Roles" />
          <Select value={workType} onChange={setWorkType} options={WORK_TYPE_OPTIONS} placeholder="Work Type" />
          <Select value={industry} onChange={setIndustry} options={INDUSTRY_OPTIONS} placeholder="Industry" />
          <Select
            value={sort}
            onChange={setSort}
            options={['posted_at', 'salary']}
            labels={['Newest', 'Highest Salary']}
            placeholder="Sort"
          />
        </div>
      </div>

      {/* Job Cards — 3 column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {jobs.map(job => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>

      {loading && <p className="text-center text-ink-muted py-8">Loading...</p>}

      {!loading && jobs.length < total && (
        <button
          onClick={loadMore}
          className="w-full mt-6 py-3 text-sm font-medium text-brand-600 bg-brand-50 rounded-xl hover:bg-brand-100 transition-colors"
        >
          Load More ({jobs.length} of {total})
        </button>
      )}

      {!loading && jobs.length === 0 && (
        <p className="text-center text-ink-muted py-12">No jobs found matching your filters.</p>
      )}
    </div>
  )
}

function JobCard({ job }: { job: any }) {
  const salary = job.salary_annual_min || job.salary_annual_max
    ? `$${Math.round((job.salary_annual_min || 0) / 1000)}K — $${Math.round((job.salary_annual_max || 0) / 1000)}K`
    : null

  const fundingDisplay = (() => {
    if (!job.funding_stage || job.funding_stage === 'Unknown') return null
    if (job.funding_amount_cents && job.funding_amount_status === 'known') {
      return `${job.funding_stage} · $${formatFunding(job.funding_amount_cents)}`
    }
    return job.funding_stage
  })()

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="flex flex-col bg-white rounded-2xl p-5 border border-slate-100 hover:shadow-lg hover:border-brand-200 transition-all group"
    >
      {/* Company + Industry */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-ink truncate">{job.company_name || 'Unknown'}</span>
        {job.industry && job.industry !== 'Other' && (
          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs font-medium whitespace-nowrap ml-2">
            {job.industry}
          </span>
        )}
      </div>

      {/* Job Title */}
      <h3 className="font-bold text-ink text-base mb-2 leading-snug group-hover:text-brand-600 transition-colors line-clamp-2">
        {job.title}
      </h3>

      {/* Funding */}
      {fundingDisplay && (
        <div className="flex items-center gap-1.5 text-xs text-violet-600 font-medium mb-2">
          <TrendingUp className="w-3 h-3" />
          {fundingDisplay}
        </div>
      )}

      {/* Salary */}
      {salary && (
        <div className="flex items-center gap-1.5 text-sm text-emerald-600 font-semibold mb-3">
          <DollarSign className="w-3.5 h-3.5" />
          {salary}
        </div>
      )}

      {/* Meta tags */}
      <div className="flex flex-wrap gap-1.5 mt-auto pt-2">
        {job.role_category && (
          <span className="px-2 py-0.5 bg-violet-50 text-violet-600 rounded text-xs font-medium">
            {job.role_category}
          </span>
        )}
        {job.work_type && job.work_type !== 'Unknown' && (
          <span className="px-2 py-0.5 bg-slate-100 text-ink-secondary rounded text-xs">
            {job.work_type}
          </span>
        )}
        {job.location && (
          <span className="flex items-center gap-1 text-xs text-ink-muted truncate max-w-[140px]">
            <MapPin className="w-3 h-3 flex-shrink-0" />{job.location}
          </span>
        )}
      </div>
    </Link>
  )
}

function Select({ value, onChange, options, labels, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: string[]; labels?: string[]; placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-ink-secondary bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
    >
      <option value="">{placeholder}</option>
      {options.map((opt, i) => (
        <option key={opt} value={opt}>{labels ? labels[i] : opt}</option>
      ))}
    </select>
  )
}

function formatFunding(cents: number): string {
  const dollars = cents / 100
  if (dollars >= 1_000_000_000) return `${(dollars / 1_000_000_000).toFixed(1)}B`
  if (dollars >= 1_000_000) return `${Math.round(dollars / 1_000_000)}M`
  if (dollars >= 1_000) return `${Math.round(dollars / 1_000)}K`
  return `${dollars}`
}
