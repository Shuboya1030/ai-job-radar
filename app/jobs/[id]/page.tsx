'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronRight, MapPin, DollarSign, Building2, Users, Calendar,
  ExternalLink, Briefcase, Globe,
} from 'lucide-react'
import type { JobFull } from '@/types/database'

export default function JobDetail() {
  const params = useParams()
  const [job, setJob] = useState<JobFull | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/jobs/${params.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setJob(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [params.id])

  if (loading) return <div className="max-w-5xl mx-auto px-6 py-20 text-center text-ink-muted">Loading...</div>
  if (!job) return <div className="max-w-5xl mx-auto px-6 py-20 text-center text-ink-muted">Job not found.</div>

  const salary = job.salary_annual_min || job.salary_annual_max
    ? `$${Math.round((job.salary_annual_min || 0) / 1000)}K — $${Math.round((job.salary_annual_max || 0) / 1000)}K`
    : null

  const skills = [
    ...(job.hard_skills || []).map(s => typeof s === 'string' ? s : ''),
    ...(job.tools || []).map(s => typeof s === 'string' ? s : ''),
  ].filter(Boolean)

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
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-ink">{job.title}</h1>
              {job.company_type === 'Startup' && (
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-medium">Startup</span>
              )}
            </div>
            <p className="text-ink-secondary text-lg">{job.company_name || 'Unknown Company'}</p>

            <div className="flex flex-wrap gap-3 mt-4 text-sm text-ink-muted">
              {job.location && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{job.location}</span>}
              {salary && <span className="flex items-center gap-1 text-emerald-600 font-semibold"><DollarSign className="w-4 h-4" />{salary}</span>}
              {job.work_type && job.work_type !== 'Unknown' && <span className="flex items-center gap-1"><Briefcase className="w-4 h-4" />{job.work_type}</span>}
              {job.seniority && job.seniority !== 'Unknown' && <span className="flex items-center gap-1"><Users className="w-4 h-4" />{job.seniority}</span>}
              {job.posted_at && <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{new Date(job.posted_at).toLocaleDateString()}</span>}
            </div>
          </div>

          {/* Apply Button */}
          {job.apply_url && (
            <a
              href={job.apply_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-colors"
            >
              Apply Now <ExternalLink className="w-4 h-4" />
            </a>
          )}

          {/* Skills Tags */}
          {skills.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-ink-muted uppercase tracking-wide mb-3">Required Skills & Tools</h2>
              <div className="flex flex-wrap gap-2">
                {skills.map(s => (
                  <span key={s} className="px-3 py-1 bg-brand-50 text-brand-700 rounded-full text-sm font-medium">{s}</span>
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
                <InfoRow icon={DollarSign} label="Funding" value={
                  job.funding_amount_cents && job.funding_amount_status === 'known'
                    ? `${job.funding_stage} · $${Math.round(job.funding_amount_cents / 100_000_000)}M`
                    : job.funding_stage
                } />
              )}
              {job.employee_range && (
                <InfoRow icon={Users} label="Size" value={`${job.employee_range} employees`} />
              )}
              {job.headquarter && (
                <InfoRow icon={MapPin} label="HQ" value={job.headquarter} />
              )}
              {job.company_type && (
                <InfoRow icon={Building2} label="Type" value={job.company_type} />
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
