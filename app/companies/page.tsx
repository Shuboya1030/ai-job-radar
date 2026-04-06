'use client'

import { useEffect, useState, useCallback } from 'react'
import { Search, TrendingUp, Users, MapPin, Briefcase, Globe, ExternalLink, Linkedin, Sparkles } from 'lucide-react'
import Link from 'next/link'
import NewsSidebar from '@/components/news-sidebar'

const INDUSTRY_OPTIONS = [
  'AI/ML', 'Fintech', 'Healthcare', 'E-commerce', 'SaaS', 'Cybersecurity',
  'Robotics', 'EdTech', 'Adtech', 'Cloud/Infra', 'Gaming', 'Automotive',
  'Biotech', 'Enterprise Software', 'Social/Media',
]

const FUNDING_OPTIONS = [
  'Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Series D+', 'Public',
]

const SIZE_OPTIONS = [
  '1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+',
]

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [industry, setIndustry] = useState('')
  const [fundingStage, setFundingStage] = useState('')
  const [hasJobs, setHasJobs] = useState('')
  const [offset, setOffset] = useState(0)
  const limit = 30

  const fetchCompanies = useCallback(async (reset = false) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (industry) params.set('industry', industry)
    if (fundingStage) params.set('funding_stage', fundingStage)
    if (hasJobs) params.set('has_jobs', hasJobs)
    params.set('sort', 'hot_score')
    params.set('limit', String(limit))
    params.set('offset', reset ? '0' : String(offset))

    const res = await fetch(`/api/companies?${params}`)
    const data = await res.json()

    if (reset) {
      setCompanies(data.companies || [])
      setOffset(0)
    } else {
      setCompanies(prev => [...prev, ...(data.companies || [])])
    }
    setTotal(data.total || 0)
    setLoading(false)
  }, [search, industry, fundingStage, hasJobs, offset])

  useEffect(() => { fetchCompanies(true) }, [industry, fundingStage, hasJobs])

  const handleSearch = () => fetchCompanies(true)
  const loadMore = () => {
    const newOffset = offset + limit
    setOffset(newOffset)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (industry) params.set('industry', industry)
    if (fundingStage) params.set('funding_stage', fundingStage)
    if (hasJobs) params.set('has_jobs', hasJobs)
    params.set('sort', 'hot_score')
    params.set('limit', String(limit))
    params.set('offset', String(newOffset))
    fetch(`/api/companies?${params}`)
      .then(r => r.json())
      .then(data => setCompanies(prev => [...prev, ...(data.companies || [])]))
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-3">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl font-bold text-primary">Discover AI Startups</h1>
            <p className="text-xs font-mono text-tertiary mt-0.5">
              {total} companies &middot; ranked by activity &middot; updated daily
            </p>
          </div>

          {/* Suggest Banner */}
          <Link
            href="/companies/suggest"
            className="block mb-4 px-4 py-2.5 rounded border border-zinc-200 bg-surface-raised hover:border-zinc-400 transition-colors group"
          >
            <span className="text-xs text-secondary group-hover:text-primary transition-colors">
              Know a great AI startup? <span className="font-semibold text-primary">Suggest it &rarr;</span>
            </span>
          </Link>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            <div className="flex-1 min-w-[200px] relative">
              <input
                type="text"
                placeholder="Search companies..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="w-full px-3 py-1.5 rounded border border-zinc-200 text-sm bg-white placeholder:text-faint focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400/20"
              />
            </div>
            <FilterSelect value={industry} onChange={setIndustry} options={INDUSTRY_OPTIONS} placeholder="Industry" />
            <FilterSelect value={fundingStage} onChange={setFundingStage} options={FUNDING_OPTIONS} placeholder="Funding" />
            <FilterSelect value={hasJobs} onChange={setHasJobs} options={['true', 'false']} labels={['Hiring now', 'Not hiring']} placeholder="Hiring status" />
          </div>

          {/* Company Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {companies.map(co => (
              <CompanyCard key={co.id} company={co} />
            ))}
          </div>

          {loading && <p className="text-center text-tertiary text-sm py-12">Loading...</p>}

          {!loading && companies.length < total && (
            <button
              onClick={loadMore}
              className="w-full mt-6 py-2.5 text-xs font-mono font-semibold text-primary bg-surface-raised rounded border border-zinc-200 hover:border-zinc-400 transition-colors"
            >
              LOAD MORE &middot; {companies.length}/{total}
            </button>
          )}

          {!loading && companies.length === 0 && (
            <p className="text-center text-tertiary text-sm py-16">No companies match your filters.</p>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <NewsSidebar />
        </div>
      </div>
    </div>
  )
}

function CompanyCard({ company: co }: { company: any }) {
  const funding = co.funding_amount_cents && co.funding_amount_status === 'known'
    ? formatFunding(co.funding_amount_cents)
    : null

  const fundingDisplay = (() => {
    const hasAmount = funding
    const hasStage = co.funding_stage && co.funding_stage !== 'Unknown'
    if (hasAmount && hasStage) return `${co.funding_stage} · $${funding}`
    if (hasAmount) return `$${funding} raised`
    if (hasStage) return co.funding_stage
    return null
  })()

  return (
    <Link
      href={`/companies/${co.id}`}
      className="card card-hover p-4 flex flex-col group"
    >
      {/* Company name + Industry */}
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-sm font-semibold text-primary truncate group-hover:text-lime-dark transition-colors">
          {co.name}
        </h3>
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {co.is_hot && (
            <span className="badge bg-red-500 text-white text-2xs font-bold animate-pulse">HOT</span>
          )}
          {co.founder_linkedin && (
            <Linkedin className="w-3.5 h-3.5 text-blue-600" />
          )}
        </div>
      </div>

      {/* Funding */}
      {fundingDisplay && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="badge bg-lime text-black font-semibold">{fundingDisplay}</span>
          {co.industry && co.industry !== 'Other' && (
            <span className="badge bg-primary/5 text-primary font-medium">{co.industry}</span>
          )}
        </div>
      )}
      {!fundingDisplay && co.industry && co.industry !== 'Other' && (
        <div className="mb-2">
          <span className="badge bg-primary/5 text-primary font-medium">{co.industry}</span>
        </div>
      )}

      {/* Product description */}
      {co.product_description && (
        <p className="text-2xs text-secondary line-clamp-2 mb-2 leading-relaxed">{co.product_description}</p>
      )}

      {/* Meta */}
      <div className="flex flex-wrap gap-2 text-2xs text-faint mt-auto pt-2">
        {co.employee_range && (
          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{co.employee_range}</span>
        )}
        {co.headquarter && (
          <span className="flex items-center gap-1 truncate max-w-[140px]"><MapPin className="w-3 h-3" />{co.headquarter}</span>
        )}
        {co.website && (
          <span className="flex items-center gap-1"><Globe className="w-3 h-3" />Website</span>
        )}
      </div>

      {/* Open Jobs Badge */}
      {co.open_jobs > 0 ? (
        <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <Briefcase className="w-3.5 h-3.5" />
            {co.open_jobs} open position{co.open_jobs > 1 ? 's' : ''}
          </span>
          <span className="text-2xs text-lime-dark font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            View &rarr;
          </span>
        </div>
      ) : (
        <div className="mt-2 pt-2 border-t border-zinc-100">
          <span className="text-2xs text-tertiary">No open positions &middot; reach out directly</span>
        </div>
      )}
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
