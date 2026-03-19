'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/auth-provider'
import { Upload, Bell, X } from 'lucide-react'
import Link from 'next/link'

export default function AlertBanner() {
  const { user, signInWithGoogle } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const [hasResume, setHasResume] = useState<boolean | null>(null)

  useEffect(() => {
    if (!user) return
    fetch('/api/resume/status')
      .then(r => r.json())
      .then(d => setHasResume(!!d.has_resume))
      .catch(() => {})
  }, [user])

  if (dismissed) return null

  // Priority 1: No user or no resume → push resume upload
  if (!user || hasResume === false) {
    return (
      <div className="relative rounded-lg border border-zinc-200 bg-zinc-50 p-4 flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <Upload className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary">
              Find jobs that match your skills
            </p>
            <p className="text-xs text-tertiary mt-0.5">
              Upload your resume — AI matches you to the best roles in seconds
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {user ? (
            <Link
              href="/dashboard"
              className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-zinc-800 transition-colors whitespace-nowrap"
            >
              Upload resume
            </Link>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-zinc-800 transition-colors whitespace-nowrap"
            >
              Sign in to start
            </button>
          )}
          <button onClick={() => setDismissed(true)} className="text-zinc-400 hover:text-zinc-600 p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    )
  }

  // Priority 2: Has resume but no alerts → push alerts
  if (hasResume === true) {
    return (
      <div className="relative rounded-lg border border-zinc-200 bg-zinc-50 p-4 flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Bell className="w-4 h-4 text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary">
              Get notified when new matches appear
            </p>
            <p className="text-xs text-tertiary mt-0.5">
              Set your filters and receive matched jobs straight to your inbox
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href="/settings"
            className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-zinc-800 transition-colors whitespace-nowrap"
          >
            Set up alerts
          </Link>
          <button onClick={() => setDismissed(true)} className="text-zinc-400 hover:text-zinc-600 p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    )
  }

  // Loading state — show nothing
  return null
}
