'use client'

import { useEffect, useState, useCallback } from 'react'
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
    const params = new URLSearchParams()
    if (role) params.set('role', role)
    if (workType) params.set('work_type', workType)
    if (industry) params.set('industry', industry)
    if (search) params.set('search', search)
    params.set('sort', sort)
    params.set('limit', String(limit))
    params.set('offset', reset ? '0' : String(offset))

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
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-primary">Jobs</h1>
          <p className="text-xs font-mono text-tertiary mt-0.5">
            {total} active positions &middot; 4 sources &middot; updated daily
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <div className="flex-1 min-w-[200px] relative">
          <input
            type="text"
            placeholder="Search jobs or companies..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="w-full px-3 py-1.5 rounded border border-zinc-200 text-sm bg-white placeholder:text-faint focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400/20"
          />
        </div>
        <FilterSelect value={role} onChange={setRole} options={ROLE_OPTIONS} placeholder="Role" />
        <FilterSelect value={workType} onChange={setWorkType} options={WORK_TYPE_OPTIONS} placeholder="Work type" />
        <FilterSelect value={industry} onChange={setIndustry} options={INDUSTRY_OPTIONS} placeholder="Industry" />
        <FilterSelect
          value={sort}
          onChange={setSort}
          options={['posted_at', 'salary']}
          labels={['Newest', 'Top salary']}
          placeholder="Sort"
        />
      </div>

      {/* Job Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {jobs.map(job => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>

      {loading && <p className="text-center text-tertiary text-sm py-12">Loading...</p>}

      {!loading && jobs.length < total && (
        <button
          onClick={loadMore}
          className="w-full mt-6 py-2.5 text-xs font-mono font-semibold text-primary bg-surface-raised rounded border border-zinc-200 hover:border-zinc-400 transition-colors"
        >
          LOAD MORE &middot; {jobs.length}/{total}
        </button>
      )}

      {!loading && jobs.length === 0 && (
        <p className="text-center text-tertiary text-sm py-16">No jobs match your filters.</p>
      )}
    </div>
  )
}

function JobCard({ job }: { job: any }) {
  const salary = job.salary_annual_min || job.salary_annual_max
    ? `$${Math.round((job.salary_annual_min || 0) / 1000)}K–$${Math.round((job.salary_annual_max || 0) / 1000)}K`
    : null

  const fundingDisplay = (() => {
    const hasAmount = job.funding_amount_cents && job.funding_amount_status === 'known'
    const hasStage = job.funding_stage && job.funding_stage !== 'Unknown'
    if (hasAmount && hasStage) return `${job.funding_stage} · $${formatFunding(job.funding_amount_cents)}`
    if (hasAmount) return `$${formatFunding(job.funding_amount_cents)} raised`
    if (hasStage) return job.funding_stage
    return null
  })()

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="card card-hover p-4 flex flex-col group"
    >
      {/* Top row: company + industry */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-primary truncate">{job.company_name || 'Unknown'}</span>
        {job.industry && job.industry !== 'Other' && (
          <span className="badge bg-surface-raised text-tertiary ml-2">{job.industry}</span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-primary leading-snug mb-2 line-clamp-2 group-hover:text-lime-dark transition-colors">
        {job.title}
      </h3>

      {/* Funding */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-lime flex-shrink-0" />
        <span className="text-2xs font-mono text-tertiary truncate">
          {fundingDisplay || 'Funding unknown'}
        </span>
      </div>

      {/* Salary */}
      {salary && (
        <p className="text-sm font-mono font-semibold text-primary mb-2">{salary}</p>
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-1 mt-auto pt-2">
        {job.role_category && (
          <span className="badge bg-primary text-white">{job.role_category}</span>
        )}
        {job.work_type && job.work_type !== 'Unknown' && (
          <span className="badge bg-surface-raised text-secondary">{job.work_type}</span>
        )}
        {job.location && (
          <span className="text-2xs text-faint truncate max-w-[130px]">{job.location}</span>
        )}
      </div>
    </Link>
  )
}

function FilterSelect({ value, onChange, options, labels, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: string[]; labels?: string[]; placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="px-3 py-1.5 rounded border border-zinc-200 text-xs text-secondary bg-white focus:outline-none focus:border-zinc-400"
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
