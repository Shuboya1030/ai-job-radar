'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import { Bookmark, MapPin, DollarSign, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import SaveButton from '@/components/save-button'

export default function SavedJobsPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuth()
  const [jobs, setJobs] = useState<any[]>([])
  const [inactiveJobs, setInactiveJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    fetch('/api/saved-jobs')
      .then(r => r.json())
      .then(d => {
        setJobs(d.jobs || [])
        setInactiveJobs(d.inactiveJobs || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [user])

  if (authLoading) return <div className="max-w-5xl mx-auto px-6 py-20 text-center text-tertiary text-sm">Loading...</div>

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20 text-center">
        <Bookmark className="w-10 h-10 text-faint mx-auto mb-4" />
        <h1 className="text-xl font-bold text-primary mb-2">Saved Jobs</h1>
        <p className="text-sm text-secondary mb-6">Sign in to save jobs and access them later.</p>
        <button onClick={signInWithGoogle} className="px-5 py-2.5 bg-lime text-black font-bold text-sm rounded hover:bg-lime-dark transition-colors">
          Sign in with Google
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-xl font-bold text-primary mb-1">Saved Jobs</h1>
      <p className="text-xs font-mono text-tertiary mb-6">{jobs.length} saved</p>

      {loading ? (
        <p className="text-tertiary text-sm text-center py-12">Loading...</p>
      ) : jobs.length === 0 && inactiveJobs.length === 0 ? (
        <div className="text-center py-16">
          <Bookmark className="w-8 h-8 text-faint mx-auto mb-3" />
          <p className="text-sm text-tertiary mb-4">No saved jobs yet.</p>
          <Link href="/jobs" className="text-xs font-semibold text-lime-dark hover:underline">
            Browse the Job Board
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job: any) => (
            <Link key={job.id} href={`/jobs/${job.id}`} className="card card-hover p-4 flex items-center justify-between group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-primary">{job.company_name}</span>
                  {job.funding_stage && job.funding_stage !== 'Unknown' && (
                    <span className="badge bg-lime/20 text-lime-dark text-2xs">{job.funding_stage}</span>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-primary truncate group-hover:text-lime-dark transition-colors">{job.title}</h3>
                <div className="flex items-center gap-3 mt-1 text-2xs text-tertiary">
                  {job.salary_annual_min && (
                    <span className="font-mono">${Math.round(job.salary_annual_min/1000)}K–${Math.round((job.salary_annual_max||job.salary_annual_min)/1000)}K</span>
                  )}
                  {job.location && <span>{job.location}</span>}
                  {job.work_type && job.work_type !== 'Unknown' && <span>{job.work_type}</span>}
                </div>
              </div>
              <SaveButton jobId={job.id} initialSaved={true} />
            </Link>
          ))}

          {inactiveJobs.length > 0 && (
            <>
              <p className="section-label pt-4">No longer active</p>
              {inactiveJobs.map((job: any) => (
                <div key={job.id} className="card p-4 opacity-50">
                  <p className="text-sm text-tertiary">{job.title}</p>
                  <span className="badge bg-red-50 text-red-500 text-2xs mt-1">Closed</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
