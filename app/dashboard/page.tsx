'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/components/auth-provider'
import ResumeUpload from '@/components/resume-upload'
import MatchBadge from '@/components/match-badge'
import MatchFeedback from '@/components/match-feedback'
import SubscribeGate from '@/components/subscribe-gate'
import Link from 'next/link'
import {
  FileText, RefreshCw, Loader2, ChevronDown, ChevronUp,
  ExternalLink, Briefcase, TrendingUp, Target, Zap, BarChart3,
} from 'lucide-react'

const MAX_STRONG = 5
const MAX_GOOD = 5

export default function DashboardPage() {
  const { user, loading: authLoading, subscriptionStatus, signInWithGoogle } = useAuth()
  const [status, setStatus] = useState<any>(null)
  const [matches, setMatches] = useState<any[]>([])
  const [skillsGap, setSkillsGap] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [marketComparison, setMarketComparison] = useState<any>(null)
  const [showUpload, setShowUpload] = useState(false)
  const clickedRef = useRef(new Set<string>())

  const isPaid = subscriptionStatus === 'active'

  const fetchStatus = useCallback(async () => {
    const res = await fetch('/api/resume/status')
    const data = await res.json()
    setStatus(data)
    return data
  }, [])

  const fetchResults = useCallback(async () => {
    const [matchRes, gapRes, profileRes] = await Promise.all([
      fetch('/api/resume/matches'),
      fetch('/api/resume/skills-gap'),
      fetch('/api/resume/profile'),
    ])
    const matchData = await matchRes.json()
    const gapData = await gapRes.json()
    const profileData = await profileRes.json()
    setMatches(matchData.matches || [])
    setSkillsGap(gapData)
    setProfile(profileData.parsed_profile || null)
  }, [])

  const fetchMarketComparison = useCallback(async () => {
    const res = await fetch('/api/resume/market-comparison')
    if (res.ok) {
      const data = await res.json()
      setMarketComparison(data)
    }
  }, [])

  const fetchProfile = useCallback(async () => {
    const res = await fetch('/api/resume/profile')
    if (res.ok) {
      const data = await res.json()
      setProfile(data.parsed_profile || null)
    }
  }, [])

  // Initial load
  useEffect(() => {
    if (!user || authLoading) return
    fetchStatus().then(data => {
      if (!data.has_resume) return
      // Always fetch profile + market comparison (free)
      if (['parsed', 'completed', 'matching_stage1', 'matching_stage2'].includes(data.processing_status)) {
        fetchProfile()
        fetchMarketComparison()
      }
      // Fetch matches only for paid users with completed matching
      if (data.processing_status === 'completed' && (data.subscription_status === 'active' || data.subscription_status === 'cancelled')) {
        fetchResults()
      }
    })
  }, [user, authLoading, fetchStatus, fetchResults, fetchProfile, fetchMarketComparison])

  // Poll while processing
  useEffect(() => {
    if (!status?.has_resume) return
    const isProcessing = ['pending', 'parsing', 'matching_stage1', 'matching_stage2'].includes(status.processing_status)
    if (!isProcessing) return

    const interval = setInterval(async () => {
      const data = await fetchStatus()
      if (data.processing_status === 'parsed') {
        clearInterval(interval)
        fetchProfile()
        fetchMarketComparison()
      } else if (data.processing_status === 'completed') {
        clearInterval(interval)
        fetchProfile()
        fetchMarketComparison()
        if (isPaid || data.subscription_status === 'active') fetchResults()
      } else if (data.processing_status === 'matching_stage2' && isPaid) {
        // Stage 1 done, start showing results while stage 2 continues
        fetchResults()
      } else if (data.processing_status === 'failed') {
        clearInterval(interval)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [status?.has_resume, status?.processing_status, isPaid, fetchStatus, fetchResults, fetchProfile, fetchMarketComparison])

  // Handle ?subscription=success redirect from Stripe
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('subscription') === 'success') {
      // Clean URL
      window.history.replaceState({}, '', '/dashboard')
      // Start polling for match results
      fetchStatus()
    }
  }, [fetchStatus])

  const trackClick = useCallback((matchId: string) => {
    if (clickedRef.current.has(matchId)) return
    clickedRef.current.add(matchId)
    fetch('/api/resume/matches/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_id: matchId, event_type: 'click' }),
    }).catch(() => {})
  }, [])

  const handleUploadComplete = useCallback(() => {
    setShowUpload(false)
    setMatches([])
    setSkillsGap(null)
    setMarketComparison(null)
    setProfile(null)
    fetchStatus()
  }, [fetchStatus])

  // Auth gate
  if (authLoading) return <Loading />
  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-primary mb-3">Your Dashboard</h1>
        <p className="text-secondary mb-6">Sign in to upload your resume and get personalized job matches.</p>
        <button onClick={signInWithGoogle} className="px-6 py-3 bg-lime text-black font-bold rounded-lg hover:bg-lime-dark transition-colors">
          Sign in with Google
        </button>
      </div>
    )
  }

  // No resume yet
  if (status && !status.has_resume && !showUpload) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold text-primary mb-2">Your Dashboard</h1>
        <p className="text-secondary mb-8">Upload your resume and we&apos;ll match you with the best AI roles.</p>
        <ResumeUpload onUploadComplete={handleUploadComplete} />
        <HowItWorks />
      </div>
    )
  }

  const isParsingProfile = status && ['pending', 'parsing'].includes(status.processing_status)
  const isProfileReady = status && ['parsed', 'matching_stage1', 'matching_stage2', 'completed'].includes(status.processing_status)
  const isMatching = status && ['matching_stage1', 'matching_stage2'].includes(status.processing_status)
  const isComplete = status?.processing_status === 'completed'
  const isFailed = status?.processing_status === 'failed'

  const strongMatches = matches.filter(m => m.match_tier === 'strong').slice(0, MAX_STRONG)
  const goodMatches = matches.filter(m => m.match_tier === 'good').slice(0, MAX_GOOD)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-primary">Your Dashboard</h1>
          {status?.file_name && (
            <p className="text-2xs font-mono text-tertiary mt-0.5 flex items-center gap-1.5">
              <FileText className="w-3 h-3" />
              {status.file_name} &middot; uploaded {new Date(status.uploaded_at).toLocaleDateString()}
              {isPaid && <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-2xs font-bold border border-emerald-200">Pro</span>}
            </p>
          )}
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="text-xs font-medium text-secondary hover:text-primary flex items-center gap-1 px-3 py-1.5 rounded border border-zinc-200 hover:border-zinc-400 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Re-upload
        </button>
      </div>

      {showUpload && (
        <div className="mb-6">
          <ResumeUpload onUploadComplete={handleUploadComplete} />
        </div>
      )}

      {/* Parsing profile */}
      {isParsingProfile && (
        <div className="card p-8 text-center mb-6">
          <Loader2 className="w-10 h-10 text-zinc-400 animate-spin mx-auto mb-3" />
          <p className="text-primary font-semibold mb-1">Analyzing your resume...</p>
          <p className="text-tertiary text-sm">Extracting skills, experience, and background</p>
        </div>
      )}

      {/* Failed */}
      {isFailed && (
        <div className="card p-6 border-red-200 mb-6">
          <p className="text-red-600 font-semibold mb-1">Processing failed</p>
          <p className="text-tertiary text-sm">{status.error_message || 'Unknown error'}</p>
          <button onClick={() => setShowUpload(true)} className="mt-3 text-sm text-primary font-medium hover:underline">
            Try uploading again
          </button>
        </div>
      )}

      {/* Profile ready — show results */}
      {isProfileReady && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {profile && <ProfileCard profile={profile} />}

            {/* Market Comparison — FREE for all users */}
            {marketComparison && <MarketComparisonCard data={marketComparison} />}

            {/* Matching in progress (paid users) */}
            {isMatching && isPaid && (
              <div className="card p-6 text-center">
                <Loader2 className="w-8 h-8 text-zinc-400 animate-spin mx-auto mb-3" />
                <p className="text-primary font-semibold mb-1">
                  {status.processing_status === 'matching_stage1' ? 'Finding your top matches...' : 'Scanning more jobs in background...'}
                </p>
                <p className="text-tertiary text-sm">
                  {status.processing_status === 'matching_stage1' ? 'This takes about 10 seconds' : 'Results appearing as they\'re found'}
                </p>
              </div>
            )}

            {/* Matches — paid users see results, free users see subscribe gate */}
            {isPaid ? (
              <>
                {strongMatches.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-emerald-600" />
                      <h2 className="text-sm font-bold text-primary">Strong Matches</h2>
                      <span className="text-2xs font-mono text-tertiary">({strongMatches.length})</span>
                    </div>
                    <div className="space-y-2">
                      {strongMatches.map((m: any) => (
                        <MatchCard key={m.id || m.jobs?.id} match={m} onTrackClick={trackClick} />
                      ))}
                    </div>
                  </div>
                )}

                {goodMatches.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="w-4 h-4 text-blue-600" />
                      <h2 className="text-sm font-bold text-primary">Good Matches</h2>
                      <span className="text-2xs font-mono text-tertiary">({goodMatches.length})</span>
                    </div>
                    <div className="space-y-2">
                      {goodMatches.map((m: any) => (
                        <MatchCard key={m.id || m.jobs?.id} match={m} onTrackClick={trackClick} />
                      ))}
                    </div>
                  </div>
                )}

                {isComplete && matches.length === 0 && (
                  <div className="card p-6 text-center text-tertiary text-sm">
                    No matches found. Try uploading a different resume.
                  </div>
                )}
              </>
            ) : (
              /* Free user — subscribe gate over fake match placeholders */
              <SubscribeGate locked={true}>
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-emerald-600" />
                      <h2 className="text-sm font-bold text-primary">Strong Matches</h2>
                    </div>
                    <div className="space-y-2">
                      {[1,2,3].map(i => (
                        <div key={i} className="card p-4 h-28 bg-zinc-50" />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="w-4 h-4 text-blue-600" />
                      <h2 className="text-sm font-bold text-primary">Good Matches</h2>
                    </div>
                    <div className="space-y-2">
                      {[1,2,3].map(i => (
                        <div key={i} className="card p-4 h-28 bg-zinc-50" />
                      ))}
                    </div>
                  </div>
                </div>
              </SubscribeGate>
            )}
          </div>

          {/* Right column — Skills Gap (paid only) */}
          <div className="space-y-6">
            {isPaid && skillsGap ? (
              <SkillsGapPanel data={skillsGap} />
            ) : !isPaid ? (
              <SubscribeGate locked={true}>
                <div className="card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-semibold text-primary">Skills to Learn</h3>
                  </div>
                  <div className="space-y-3">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className="h-4 bg-zinc-100 rounded" />
                    ))}
                  </div>
                </div>
              </SubscribeGate>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

function Loading() {
  return <div className="max-w-5xl mx-auto px-6 py-20 text-center text-tertiary text-sm">Loading...</div>
}

function HowItWorks() {
  return (
    <div className="mt-12 grid grid-cols-3 gap-4">
      {[
        { step: '1', title: 'Upload', desc: 'Drop your resume (PDF, DOCX, or MD)' },
        { step: '2', title: 'AI Analysis', desc: 'We analyze your skills vs market demand' },
        { step: '3', title: 'Get Matches', desc: 'Subscribe to see your best job matches' },
      ].map(s => (
        <div key={s.step} className="text-center">
          <div className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-600 font-bold text-sm flex items-center justify-center mx-auto mb-2">
            {s.step}
          </div>
          <p className="text-sm font-semibold text-primary">{s.title}</p>
          <p className="text-2xs text-tertiary mt-1">{s.desc}</p>
        </div>
      ))}
    </div>
  )
}

function ProfileCard({ profile }: { profile: any }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="card p-4">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-zinc-500" />
          <h2 className="text-sm font-semibold text-primary">Your Profile</h2>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-tertiary" /> : <ChevronDown className="w-4 h-4 text-tertiary" />}
      </button>

      {expanded && (
        <div className="mt-4 space-y-3 text-sm">
          <div>
            <p className="text-2xs font-mono text-tertiary mb-1">Summary</p>
            <p className="text-secondary">{profile.summary}</p>
          </div>
          <div>
            <p className="text-2xs font-mono text-tertiary mb-1">Skills</p>
            <div className="flex flex-wrap gap-1">
              {profile.skills?.map((s: string) => (
                <span key={s} className="text-2xs px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">{s}</span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-2xs font-mono text-tertiary">Seniority</p>
              <p className="text-primary font-medium capitalize">{profile.seniority}</p>
            </div>
            <div>
              <p className="text-2xs font-mono text-tertiary">Experience</p>
              <p className="text-primary font-medium">{profile.experience_years || '?'} years</p>
            </div>
            <div>
              <p className="text-2xs font-mono text-tertiary">Location</p>
              <p className="text-primary font-medium">{profile.location || 'Not specified'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MarketComparisonCard({ data }: { data: any }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 className="w-4 h-4 text-zinc-500" />
        <h2 className="text-sm font-semibold text-primary">Your Skills vs Market Demand</h2>
      </div>
      <p className="text-2xs text-tertiary mb-4">Based on {data.total_jobs} {data.matched_role} positions</p>

      {/* Strengths */}
      {data.your_strengths?.length > 0 && (
        <div className="mb-4">
          <p className="text-2xs font-mono text-emerald-600 font-semibold mb-2">YOUR STRENGTHS</p>
          <div className="space-y-1.5">
            {data.your_strengths.slice(0, 6).map((s: any) => (
              <div key={s.skill} className="flex items-center gap-2">
                <span className="text-xs text-secondary w-28 truncate">{s.skill}</span>
                <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${s.demand_pct}%` }} />
                </div>
                <span className="text-2xs font-mono text-tertiary w-10 text-right">{s.demand_pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gaps */}
      {data.your_gaps?.length > 0 && (
        <div>
          <p className="text-2xs font-mono text-amber-600 font-semibold mb-2">SKILLS YOU&apos;RE MISSING</p>
          <div className="space-y-1.5">
            {data.your_gaps.slice(0, 6).map((s: any) => (
              <div key={s.skill} className="flex items-center gap-2">
                <span className="text-xs text-secondary w-28 truncate">{s.skill}</span>
                <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${s.demand_pct}%` }} />
                </div>
                <span className="text-2xs font-mono text-tertiary w-10 text-right">{s.demand_pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MatchCard({ match, onTrackClick }: { match: any; onTrackClick: (id: string) => void }) {
  const job = match.jobs
  const company = job?.companies

  const salary = job?.salary_annual_min || job?.salary_annual_max
    ? `$${Math.round((job.salary_annual_min || 0) / 1000)}K–$${Math.round((job.salary_annual_max || 0) / 1000)}K`
    : null

  return (
    <div className="card card-hover p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <Link
            href={`/jobs/${job?.id}`}
            onClick={() => onTrackClick(match.id)}
            className="text-sm font-semibold text-primary hover:text-zinc-600 transition-colors block truncate mb-1"
          >
            {job?.title || 'Unknown'}
          </Link>
          <div className="flex items-center gap-2 text-2xs text-tertiary mb-2">
            <span className="font-medium text-secondary">{company?.name || 'Unknown'}</span>
            {company?.funding_stage && company.funding_stage !== 'Unknown' && (
              <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 font-mono">{company.funding_stage}</span>
            )}
            {job?.location && <span>{job.location}</span>}
            {salary && <span className="font-mono font-semibold text-primary">{salary}</span>}
          </div>
          <p className="text-2xs text-secondary leading-relaxed mb-2">{match.match_reasoning}</p>
          <div className="flex flex-wrap gap-1">
            {(match.skills_matched as string[])?.slice(0, 5).map((s: string) => (
              <span key={s} className="text-2xs px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">{s}</span>
            ))}
            {(match.skills_missing as string[])?.slice(0, 3).map((s: string) => (
              <span key={s} className="text-2xs px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">{s}</span>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <MatchBadge tier={match.match_tier} score={match.match_score} />
          <MatchFeedback matchId={match.id} initialFeedback={match.user_feedback} />
          {job?.apply_url && (
            <a
              href={job.apply_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                fetch('/api/resume/matches/event', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ match_id: match.id, event_type: 'apply' }),
                }).catch(() => {})
              }}
              className="text-2xs font-semibold text-primary hover:text-zinc-600 flex items-center gap-1 px-2 py-1 rounded border border-zinc-200 hover:border-zinc-400 transition-colors"
            >
              Apply <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

function SkillsGapPanel({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      {data.strengths?.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-primary">Your Strengths</h3>
          </div>
          <div className="space-y-2">
            {data.strengths.slice(0, 8).map((s: any) => (
              <div key={s.skill} className="flex items-center gap-2">
                <span className="text-2xs text-secondary w-24 truncate">{s.skill}</span>
                <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${s.demand_pct}%` }} />
                </div>
                <span className="text-2xs font-mono text-tertiary w-8 text-right">{s.demand_pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.gaps?.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-primary">Skills to Learn</h3>
          </div>
          <div className="space-y-2">
            {data.gaps.slice(0, 8).map((s: any) => (
              <div key={s.skill} className="flex items-center gap-2">
                <span className="text-2xs text-secondary w-24 truncate">{s.skill}</span>
                <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${s.demand_pct}%` }} />
                </div>
                <span className="text-2xs font-mono text-tertiary w-8 text-right">{s.demand_pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
