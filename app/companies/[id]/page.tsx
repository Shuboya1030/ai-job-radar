'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronRight, MapPin, Users, Globe, TrendingUp, Briefcase,
  ExternalLink, Linkedin, Mail, Calendar,
} from 'lucide-react'

export default function CompanyDetail() {
  const params = useParams()
  const id = params?.id as string
  const [company, setCompany] = useState<any>(null)
  const [jobs, setJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    fetch(`/api/companies/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setCompany(d?.company)
        setJobs(d?.jobs || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) return <div className="max-w-5xl mx-auto px-6 py-20 text-center text-tertiary text-sm">Loading...</div>
  if (!company) return <div className="max-w-5xl mx-auto px-6 py-20 text-center text-tertiary text-sm">Company not found.</div>

  const funding = company.funding_amount_cents && company.funding_amount_status === 'known'
    ? formatFunding(company.funding_amount_cents) : null

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-tertiary mb-6">
        <Link href="/companies" className="hover:text-primary">Companies</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-primary font-medium truncate">{company.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-primary mb-1">{company.name}</h1>
            {company.product_description && (
              <p className="text-secondary text-base leading-relaxed">{company.product_description}</p>
            )}
            {!company.product_description && company.description && (
              <p className="text-secondary text-sm leading-relaxed">{company.description}</p>
            )}

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mt-4">
              {company.funding_stage && company.funding_stage !== 'Unknown' && (
                <span className="badge bg-lime text-black font-semibold">
                  {company.funding_stage}{funding ? ` · $${funding}` : ''}
                </span>
              )}
              {company.industry && company.industry !== 'Other' && (
                <span className="badge bg-primary/5 text-primary">{company.industry}</span>
              )}
              {company.employee_range && (
                <span className="badge bg-surface-raised text-tertiary">{company.employee_range} employees</span>
              )}
            </div>
          </div>

          {/* Website CTA */}
          {company.website && (
            <a
              href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-primary text-white text-sm font-bold rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Visit Website <ExternalLink className="w-4 h-4" />
            </a>
          )}

          {/* Open Positions */}
          {jobs.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-emerald-600" />
                Open Positions ({jobs.length})
              </h2>
              <div className="space-y-2">
                {jobs.map((job: any) => {
                  const salary = job.salary_annual_min || job.salary_annual_max
                    ? `$${Math.round((job.salary_annual_min || 0) / 1000)}K–$${Math.round((job.salary_annual_max || 0) / 1000)}K`
                    : null
                  return (
                    <Link
                      key={job.id}
                      href={`/jobs/${job.id}`}
                      className="card card-hover p-4 flex items-center justify-between group"
                    >
                      <div>
                        <p className="text-sm font-semibold text-primary group-hover:text-lime-dark transition-colors">{job.title}</p>
                        <div className="flex items-center gap-2 text-2xs text-tertiary mt-1">
                          {job.location && <span>{job.location}</span>}
                          {job.work_type && job.work_type !== 'Unknown' && <span>{job.work_type}</span>}
                          {job.seniority && job.seniority !== 'Unknown' && <span>{job.seniority}</span>}
                          {salary && <span className="font-mono font-semibold text-primary">{salary}</span>}
                        </div>
                      </div>
                      {job.apply_url && (
                        <span className="text-2xs font-semibold text-primary px-2 py-1 rounded border border-zinc-200 opacity-0 group-hover:opacity-100 transition-opacity">
                          Apply
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* No positions CTA */}
          {jobs.length === 0 && (
            <div className="card p-6 text-center border-dashed">
              <Briefcase className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-primary mb-1">No open positions listed</p>
              <p className="text-2xs text-tertiary mb-4">
                Many startups hire through referrals before posting publicly.
                Reach out directly — they might have unlisted roles.
              </p>
              {company.founder_linkedin && (
                <a
                  href={company.founder_linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Linkedin className="w-4 h-4" /> Message Founder on LinkedIn
                </a>
              )}
              {!company.founder_linkedin && company.website && (
                <a
                  href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  <Globe className="w-4 h-4" /> Visit their website
                </a>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="card p-5 sticky top-24 space-y-4">
            <h2 className="font-bold text-primary text-sm">Company Info</h2>

            <div className="space-y-3 text-sm">
              {company.industry && company.industry !== 'Other' && (
                <InfoRow icon={TrendingUp} label="Industry" value={company.industry} />
              )}
              {company.funding_stage && company.funding_stage !== 'Unknown' && (
                <InfoRow icon={TrendingUp} label="Funding" value={
                  funding ? `${company.funding_stage} · $${funding}` : company.funding_stage
                } />
              )}
              {company.employee_range && (
                <InfoRow icon={Users} label="Size" value={`${company.employee_range} employees`} />
              )}
              {company.headquarter && (
                <InfoRow icon={MapPin} label="HQ" value={company.headquarter} />
              )}
              {company.website && (
                <InfoRow icon={Globe} label="Website" value={
                  <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-lime-dark hover:underline truncate block max-w-[180px]">
                    {company.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </a>
                } />
              )}
            </div>

            {/* Founder Contact */}
            {(company.founder_name || company.founder_linkedin || company.founder_email) && (
              <>
                <div className="border-t border-zinc-100 pt-4">
                  <h3 className="font-bold text-primary text-sm mb-3">Founder</h3>
                  {company.founder_name && (
                    <p className="text-sm text-primary font-medium mb-2">{company.founder_name}</p>
                  )}
                  <div className="flex flex-col gap-2">
                    {company.founder_linkedin && (
                      <a
                        href={company.founder_linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-blue-600 hover:underline"
                      >
                        <Linkedin className="w-3.5 h-3.5" /> LinkedIn Profile
                      </a>
                    )}
                    {company.founder_email && (
                      <a
                        href={`mailto:${company.founder_email}`}
                        className="flex items-center gap-2 text-xs text-secondary hover:underline"
                      >
                        <Mail className="w-3.5 h-3.5" /> {company.founder_email}
                      </a>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="w-4 h-4 text-tertiary flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-xs text-tertiary">{label}</p>
        <div className="text-primary font-medium">{value}</div>
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
