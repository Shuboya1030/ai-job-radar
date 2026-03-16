'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronRight, MapPin, DollarSign, Users, Calendar,
  ExternalLink, Briefcase, Globe, TrendingUp,
} from 'lucide-react'

export default function JobDetail() {
  const params = useParams()
  const id = params?.id as string
  const [job, setJob] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    fetch(`/api/jobs/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setJob(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) return <div className="max-w-5xl mx-auto px-6 py-20 text-center text-ink-muted">Loading...</div>
  if (!job) return <div className="max-w-5xl mx-auto px-6 py-20 text-center text-ink-muted">Job not found.</div>

  const salary = job.salary_annual_min || job.salary_annual_max
    ? `$${Math.round((job.salary_annual_min || 0) / 1000)}K — $${Math.round((job.salary_annual_max || 0) / 1000)}K`
    : null

  const parseArr = (v: any): string[] => {
    if (Array.isArray(v)) return v
    if (typeof v === 'string') { try { return JSON.parse(v) } catch { return [] } }
    return []
  }

  const skills = [...parseArr(job.hard_skills), ...parseArr(job.tools)].filter(Boolean)
  const softSkills = parseArr(job.soft_skills)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-ink-muted mb-6">
        <Link href="/jobs" className="hover:text-brand-600">Job Board</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-ink font-medium truncate">{job.title}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-ink mb-1">{job.title}</h1>
            <p className="text-ink-secondary text-lg">{job.company_name || 'Unknown Company'}</p>

            <div className="flex flex-wrap gap-3 mt-4 text-sm text-ink-muted">
              {job.location && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{job.location}</span>}
              {salary && <span className="flex items-center gap-1 text-emerald-600 font-semibold"><DollarSign className="w-4 h-4" />{salary}</span>}
              {job.work_type && job.work_type !== 'Unknown' && <span className="flex items-center gap-1"><Briefcase className="w-4 h-4" />{job.work_type}</span>}
              {job.seniority && job.seniority !== 'Unknown' && <span className="flex items-center gap-1"><Users className="w-4 h-4" />{job.seniority}</span>}
              {job.posted_at && <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{new Date(job.posted_at).toLocaleDateString()}</span>}
            </div>
          </div>

          {/* Apply Button — prominent, full width */}
          {job.apply_url && (
            <a
              href={job.apply_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-6 py-4 bg-lime text-black text-base font-bold rounded-lg hover:bg-lime-dark transition-colors shadow-[0_0_20px_rgba(191,255,0,0.3)]"
            >
              Apply Now <ExternalLink className="w-4 h-4" />
            </a>
          )}

          {/* Skills Tags */}
          {skills.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wide mb-3">Required Skills & Tools</h2>
              <div className="flex flex-wrap gap-2">
                {skills.map((s: string) => (
                  <span key={s} className="px-3 py-1 bg-brand-50 text-brand-700 rounded-full text-sm font-medium">{s}</span>
                ))}
              </div>
            </div>
          )}

          {softSkills.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wide mb-3">Soft Skills</h2>
              <div className="flex flex-wrap gap-2">
                {softSkills.map((s: string) => (
                  <span key={s} className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Job Description */}
          <div>
            <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wide mb-3">Job Description</h2>
            <div className="prose prose-sm max-w-none text-ink-secondary leading-relaxed whitespace-pre-line">
              {job.description || 'No description available.'}
            </div>
          </div>

          {/* Similar Companies */}
          <SimilarCompanies industry={job.company_industry || job.industry} excludeName={job.company_name} />
        </div>

        {/* Sidebar — Company Card */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl p-6 border border-slate-100 sticky top-24 space-y-4">
            <h2 className="font-bold text-ink text-lg">{job.company_name || 'Unknown'}</h2>

            {job.company_description && (
              <p className="text-sm text-ink-secondary">{job.company_description}</p>
            )}

            <div className="space-y-3 text-sm">
              {job.company_industry && job.company_industry !== 'Other' && (
                <InfoRow icon={Globe} label="Industry" value={job.company_industry} />
              )}
              {job.funding_stage && job.funding_stage !== 'Unknown' && (
                <InfoRow icon={TrendingUp} label="Funding" value={
                  job.funding_amount_cents && job.funding_amount_status === 'known'
                    ? `${job.funding_stage} · $${formatFunding(job.funding_amount_cents)}`
                    : job.funding_stage
                } />
              )}
              {job.employee_range && (
                <InfoRow icon={Users} label="Size" value={`${job.employee_range} employees`} />
              )}
              {job.headquarter && (
                <InfoRow icon={MapPin} label="HQ" value={job.headquarter} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-ink-muted flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-xs text-ink-muted">{label}</p>
        <p className="text-ink font-medium">{value}</p>
      </div>
    </div>
  )
}

function SimilarCompanies({ industry, excludeName }: { industry: string | null; excludeName: string | null }) {
  const [companies, setCompanies] = useState<any[]>([])

  useEffect(() => {
    if (!industry || industry === 'Other') return
    const params = new URLSearchParams({ industry })
    if (excludeName) params.set('exclude', excludeName)
    params.set('limit', '4')
    fetch(`/api/companies/similar?${params}`)
      .then(r => r.json())
      .then(d => setCompanies(d.companies || []))
      .catch(() => {})
  }, [industry, excludeName])

  if (companies.length === 0) return null

  return (
    <div>
      <h2 className="section-label mb-3">Similar companies in {industry}</h2>
      <div className="grid grid-cols-2 gap-3">
        {companies.map((co: any) => (
          <Link
            key={co.id}
            href={`/jobs?search=${encodeURIComponent(co.name)}`}
            className="card card-hover p-3 group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-primary truncate">{co.name}</span>
              {co.is_hot && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
            </div>
            {co.funding_amount_cents && co.funding_amount_status === 'known' && (
              <p className="text-2xs font-mono text-lime-dark">
                {co.funding_stage && co.funding_stage !== 'Unknown' ? `${co.funding_stage} · ` : ''}
                ${formatFunding(co.funding_amount_cents)}
              </p>
            )}
            {co.open_jobs > 0 && (
              <p className="text-2xs text-tertiary mt-1">{co.open_jobs} open jobs</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}

function formatFunding(cents: number): string {
  const dollars = cents / 100
  if (dollars >= 1_000_000_000) return `${(dollars / 1_000_000_000).toFixed(1)}B`
  if (dollars >= 1_000_000) return `${Math.round(dollars / 1_000_000)}M`
  if (dollars >= 1_000) return `${Math.round(dollars / 1_000)}K`
  return `${dollars}`
}
