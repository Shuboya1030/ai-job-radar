'use client'

import { useAuth } from '@/components/auth-provider'
import { Bell } from 'lucide-react'

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
    <div className="bg-primary rounded-lg p-4 flex items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex -space-x-0.5 flex-shrink-0">
          <span className="w-2 h-2 rounded-full bg-lime animate-pulse" />
          <span className="w-2 h-2 rounded-full bg-lime/50 animate-pulse" style={{ animationDelay: '200ms' }} />
        </div>
        <p className="text-xs text-zinc-400 truncate">
          <span className="text-white font-semibold">Get alerts</span> when new matching jobs appear — delivered to your inbox
        </p>
      </div>
      <button
        onClick={handleClick}
        className="flex-shrink-0 px-3 py-1.5 bg-lime text-black text-xs font-bold rounded hover:bg-lime-dark transition-colors"
      >
        {user ? 'Set up alerts' : 'Sign in'}
      </button>
    </div>
  )
}
