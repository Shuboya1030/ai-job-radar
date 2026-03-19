'use client'

import { useState } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'

interface MatchFeedbackProps {
  matchId: string
  initialFeedback?: 'up' | 'down' | null
}

const reasons = [
  'Wrong seniority',
  'Wrong domain',
  'Missing key skills',
  'Not interested in company',
  'Other',
]

export default function MatchFeedback({ matchId, initialFeedback }: MatchFeedbackProps) {
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(initialFeedback || null)
  const [showReasons, setShowReasons] = useState(false)
  const [saving, setSaving] = useState(false)

  async function submitFeedback(value: 'up' | 'down', reason?: string) {
    setSaving(true)
    try {
      await fetch('/api/resume/matches/feedback', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: matchId, feedback: value, reason }),
      })
      setFeedback(value)
      setShowReasons(false)
    } catch {
      // silently fail — non-critical
    } finally {
      setSaving(false)
    }
  }

  function handleThumbDown() {
    setShowReasons(true)
  }

  return (
    <div className="inline-flex flex-col gap-2">
      <div className="inline-flex items-center gap-1">
        <button
          onClick={() => submitFeedback('up')}
          disabled={saving}
          className={`p-1.5 rounded transition-colors ${
            feedback === 'up'
              ? 'bg-lime/20 text-lime'
              : 'text-tertiary hover:text-lime hover:bg-lime/10'
          }`}
          title="Good match"
        >
          <ThumbsUp className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleThumbDown}
          disabled={saving}
          className={`p-1.5 rounded transition-colors ${
            feedback === 'down'
              ? 'bg-red-400/20 text-red-400'
              : 'text-tertiary hover:text-red-400 hover:bg-red-400/10'
          }`}
          title="Bad match"
        >
          <ThumbsDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {showReasons && (
        <div className="flex flex-wrap gap-1">
          {reasons.map((r) => (
            <button
              key={r}
              onClick={() => submitFeedback('down', r)}
              className="text-2xs px-2 py-1 rounded bg-surface-raised border border-faint/20 text-tertiary hover:text-primary hover:border-faint transition-colors"
            >
              {r}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
