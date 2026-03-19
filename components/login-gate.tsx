'use client'

import { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'

interface LoginGateProps {
  children: ReactNode
  locked: boolean
  message?: string
}

export default function LoginGate({ children, locked, message }: LoginGateProps) {
  const { signInWithGoogle } = useAuth()

  if (!locked) return <>{children}</>

  return (
    <div className="relative">
      {/* Blurred content — visible but inaccessible */}
      <div
        style={{ filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none' }}
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Gradient mask + CTA overlay */}
      <div className="absolute inset-0 flex items-end justify-center" style={{ background: 'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.6) 30%, rgba(255,255,255,0.95) 60%, white 80%)' }}>
        <div className="mb-[20%] flex flex-col items-center">
          <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center mb-4">
            <Lock className="w-4 h-4 text-zinc-400" />
          </div>
          <p className="text-sm text-secondary mb-4 text-center max-w-xs">
            {message || 'Sign in to unlock full access'}
          </p>
          <button
            onClick={signInWithGoogle}
            className="px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-zinc-800 transition-colors"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  )
}
