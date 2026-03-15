'use client'

import { useEffect, useState } from 'react'
import { Search, TrendingUp, Users, MapPin, Briefcase, Globe, ArrowRight } from 'lucide-react'
import Link from 'next/link'

const INDUSTRY_OPTIONS = [
  'AI/ML', 'Fintech', 'Healthcare', 'E-commerce', 'SaaS', 'Cybersecurity',
  'Robotics', 'EdTech', 'Adtech', 'Cloud/Infra', 'Gaming', 'Automotive',
  'Biotech', 'Enterprise Software', 'Social/Media',
]

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [industry, setIndustry] = useState('')
  const [fundedOnly, setFundedOnly] = useState(false)

  const fetchCompanies = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (industry) params.set('industry', industry)
    if (fundedOnly) params.set('funded_only', 'true')
    params.set('sort', 'funding')
    params.set('limit', '100')

    const res = await fetch(`/api/companies?${params}`)
    const data = await res.json()
    setCompanies(data.companies || [])
    setTotal(data.total || 0)
    setLoading(false)
  }

  useEffect(() => { fetchCompanies() }, [industry, fundedOnly])

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-ink mb-1">Companies Hiring in AI</h1>
      <p className="text-ink-secondary mb-6">
        {total} companies · Sorted by funding
      </p>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              placeholder="Search companies..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchCompanies()}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            />
          </div>
          <select
            value={industry}
            onChange={e => setIndustry(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-ink-secondary bg-white"
          >
            <option value="">All Industries</option>
            {INDUSTRY_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-ink-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={fundedOnly}
              onChange={e => setFundedOnly(e.target.checked)}
              className="rounded border-slate-300"
            />
            Funded only
          </label>
        </div>
      </div>

      {/* Company Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {companies.map(co => (
          <CompanyCard key={co.id} company={co} />
        ))}
      </div>

      {loading && <p className="text-center text-ink-muted py-8">Loading...</p>}
      {!loading && companies.length === 0 && (
        <p className="text-center text-ink-muted py-12">No companies found.</p>
      )}
    </div>
  )
}

function CompanyCard({ company: co }: { company: any }) {
  const funding = co.funding_amount_cents && co.funding_amount_status === 'known'
    ? formatFunding(co.funding_amount_cents)
    : null

  return (
    <Link
      href={`/jobs?search=${encodeURIComponent(co.name)}`}
      className="flex flex-col bg-white rounded-2xl p-5 border border-slate-100 hover:shadow-lg hover:border-brand-200 transition-all group"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-ink text-base group-hover:text-brand-600 transition-colors truncate">
          {co.name}
        </h3>
        {co.industry && co.industry !== 'Other' && (
          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs font-medium whitespace-nowrap ml-2">
            {co.industry}
          </span>
        )}
      </div>

      {/* Funding */}
      {(funding || co.funding_stage) && (
        <div className="flex items-center gap-1.5 text-sm mb-2">
          <TrendingUp className="w-3.5 h-3.5 text-violet-500" />
          <span className="text-violet-600 font-semibold">
            {co.funding_stage && co.funding_stage !== 'Unknown' ? co.funding_stage : ''}
            {funding ? ` · $${funding} raised` : ''}
          </span>
        </div>
      )}

      {/* Meta */}
      <div className="flex flex-wrap gap-2 text-xs text-ink-muted mt-1">
        {co.employee_range && (
          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{co.employee_range}</span>
        )}
        {co.headquarter && (
          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{co.headquarter}</span>
        )}
      </div>

      {/* Open Jobs */}
      {co.open_jobs > 0 && (
        <div className="mt-auto pt-3 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-medium text-brand-600">
            <Briefcase className="w-3.5 h-3.5" />
            {co.open_jobs} open position{co.open_jobs > 1 ? 's' : ''}
          </span>
          <ArrowRight className="w-4 h-4 text-brand-400 group-hover:translate-x-1 transition-transform" />
        </div>
      )}
    </Link>
  )
}

function formatFunding(cents: number): string {
  const dollars = cents / 100
  if (dollars >= 1_000_000_000) return `${(dollars / 1_000_000_000).toFixed(1)}B`
  if (dollars >= 1_000_000) return `${Math.round(dollars / 1_000_000)}M`
  if (dollars >= 1_000) return `${Math.round(dollars / 1_000)}K`
  return `${dollars}`
}
