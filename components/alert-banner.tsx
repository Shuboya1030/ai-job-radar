'use client'

import { useAuth } from '@/components/auth-provider'

export default function AlertBanner() {
  const { user, signInWithGoogle } = useAuth()

  function handleClick() {
    if (user) {
      window.location.href = '/settings'
    } else {
      signInWithGoogle()
    }
  }

  return (
    <div className="card border-zinc-200 p-5 flex items-center justify-between gap-6 mb-6">
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex -space-x-0.5 flex-shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
          <span className="w-2.5 h-2.5 rounded-full bg-primary/40 animate-pulse" style={{ animationDelay: '200ms' }} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary">
            Get alerts when new matching jobs appear
          </p>
          <p className="text-xs text-secondary mt-0.5">
            Set your filters and receive matched jobs straight to your inbox
          </p>
        </div>
      </div>
      <button
        onClick={handleClick}
        className="flex-shrink-0 px-4 py-2 bg-primary text-white text-xs font-bold rounded hover:bg-zinc-800 transition-colors"
      >
        {user ? 'Set up alerts' : 'Sign in to get alerts'}
      </button>
    </div>
  )
}
