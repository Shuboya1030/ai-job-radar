'use client'

import { ReactNode } from 'react'
import { Zap } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'

interface SubscribeGateProps {
  children: ReactNode
  locked: boolean
}

export default function SubscribeGate({ children, locked }: SubscribeGateProps) {
  const { subscribe } = useAuth()

  if (!locked) return <>{children}</>

  return (
    <div className="relative">
      {/* Blurred content */}
      <div
        style={{ filter: 'blur(7px)', pointerEvents: 'none', userSelect: 'none' }}
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Gradient overlay + subscribe CTA */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ background: 'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.5) 20%, rgba(255,255,255,0.92) 50%, white 75%)' }}
      >
        <div className="flex flex-col items-center text-center max-w-sm">
          <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center mb-4">
            <Zap className="w-5 h-5 text-white" />
          </div>

          <h3 className="text-lg font-bold text-primary mb-1">Unlock Full Matches</h3>
          <p className="text-2xs text-tertiary mb-4">$10 / month</p>

          <div className="space-y-2 mb-5 text-left">
            <div className="flex items-start gap-2 text-sm text-secondary">
              <span className="text-emerald-600 font-bold mt-0.5">1</span>
              <span>See all Strong & Good matches with detailed reasoning</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-secondary">
              <span className="text-emerald-600 font-bold mt-0.5">2</span>
              <span>Skills gap analysis — know what to learn next</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-secondary">
              <span className="text-emerald-600 font-bold mt-0.5">3</span>
              <span>Weekly email alerts when new matches appear</span>
            </div>
          </div>

          <button
            onClick={subscribe}
            className="px-6 py-3 bg-zinc-900 text-white text-sm font-bold rounded-lg hover:bg-zinc-800 transition-colors w-full"
          >
            Subscribe — $10/month
          </button>
          <p className="text-2xs text-faint mt-2">Cancel anytime · Powered by Stripe</p>
        </div>
      </div>
    </div>
  )
}
