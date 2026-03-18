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
    <div className="bg-lime rounded-lg p-5 flex items-center justify-between gap-6 mb-6">
      <div className="flex items-center gap-3 min-w-0">
        <Bell className="w-5 h-5 text-black flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-black">
            Never miss a new AI startup job
          </p>
          <p className="text-xs text-black/60 mt-0.5">
            Set your filters — get matched jobs delivered to your inbox
          </p>
        </div>
      </div>
      <button
        onClick={handleClick}
        className="flex-shrink-0 px-4 py-2 bg-black text-lime text-xs font-bold rounded hover:bg-zinc-800 transition-colors whitespace-nowrap"
      >
        {user ? 'Set up alerts' : 'Sign in to subscribe'}
      </button>
    </div>
  )
}
