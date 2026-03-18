'use client'

import { useState } from 'react'
import { Bookmark } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'

interface SaveButtonProps {
  jobId: string
  initialSaved?: boolean
  size?: 'sm' | 'md'
}

export default function SaveButton({ jobId, initialSaved = false, size = 'sm' }: SaveButtonProps) {
  const { user, signInWithGoogle } = useAuth()
  const [saved, setSaved] = useState(initialSaved)
  const [loading, setLoading] = useState(false)

  async function toggle(e: React.MouseEvent) {
    e.preventDefault() // Prevent navigation if inside a Link
    e.stopPropagation()

    if (!user) {
      signInWithGoogle()
      return
    }

    setLoading(true)
    try {
      if (saved) {
        await fetch(`/api/saved-jobs/${jobId}`, { method: 'DELETE' })
        setSaved(false)
      } else {
        await fetch('/api/saved-jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ job_id: jobId }),
        })
        setSaved(true)
      }
    } catch {
      // Silently fail
    }
    setLoading(false)
  }

  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex-shrink-0 p-1 rounded transition-colors ${
        saved
          ? 'text-lime-dark'
          : 'text-faint hover:text-secondary'
      } ${loading ? 'opacity-50' : ''}`}
      title={saved ? 'Unsave' : 'Save job'}
    >
      <Bookmark className={iconSize} fill={saved ? 'currentColor' : 'none'} />
    </button>
  )
}
