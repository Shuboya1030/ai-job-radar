'use client'

import { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import Link from 'next/link'

export default function ResumeCTA() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="relative bg-surface-raised border border-lime/20 rounded-lg px-4 py-3 flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <Sparkles className="w-5 h-5 text-lime flex-shrink-0" />
        <p className="text-sm text-secondary">
          <span className="text-primary font-medium">Get personalized job matches</span>
          {' '}&mdash; upload your resume and we&apos;ll find the best roles for you
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard"
          className="bg-lime text-black px-3 py-1.5 rounded text-sm font-medium hover:bg-lime/90 transition-colors"
        >
          Upload Resume
        </Link>
        <button onClick={() => setDismissed(true)} className="text-tertiary hover:text-secondary p-1">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
