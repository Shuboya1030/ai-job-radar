'use client'

import { useState } from 'react'
import { useAuth } from '@/components/auth-provider'
import Link from 'next/link'

export default function SuggestCompanyPage() {
  const { user, loading, signInWithGoogle } = useAuth()
  const [companyName, setCompanyName] = useState('')
  const [website, setWebsite] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const res = await fetch('/api/companies/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName,
          website,
          reason: reason || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to submit suggestion')
      }

      setSuccess(true)
      setCompanyName('')
      setWebsite('')
      setReason('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="text-center py-20 text-tertiary text-sm">Loading...</div>
  }

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link href="/companies" className="text-2xs font-mono text-tertiary hover:text-secondary transition-colors">
          &larr; Back to Companies
        </Link>
        <h1 className="text-xl font-bold text-primary mt-2">Suggest a Company</h1>
        <p className="text-xs text-tertiary mt-0.5">
          Know an AI startup we should track? Let us know and we'll add it to our database.
        </p>
      </div>

      {!user ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-secondary mb-4">Sign in to suggest a company.</p>
          <button
            onClick={signInWithGoogle}
            className="px-6 py-2 bg-primary text-white text-sm font-medium rounded hover:bg-zinc-800 transition-colors"
          >
            Sign in with Google
          </button>
        </div>
      ) : success ? (
        <div className="card p-8 text-center">
          <div className="text-2xl mb-3">&#10003;</div>
          <h2 className="text-sm font-semibold text-primary mb-2">Suggestion Submitted!</h2>
          <p className="text-xs text-secondary mb-4">
            We'll review your suggestion and add it if it meets our criteria. Thanks for helping grow the community!
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setSuccess(false)}
              className="px-4 py-2 text-xs font-medium text-primary border border-zinc-200 rounded hover:border-zinc-400 transition-colors"
            >
              Suggest Another
            </button>
            <Link
              href="/companies"
              className="px-4 py-2 text-xs font-medium text-white bg-primary rounded hover:bg-zinc-800 transition-colors"
            >
              Back to Companies
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-primary mb-1">
              Company Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="e.g. Anthropic"
              className="w-full px-3 py-2 rounded border border-zinc-200 text-sm bg-white placeholder:text-faint focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-primary mb-1">
              Website <span className="text-red-400">*</span>
            </label>
            <input
              type="url"
              required
              value={website}
              onChange={e => setWebsite(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3 py-2 rounded border border-zinc-200 text-sm bg-white placeholder:text-faint focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-primary mb-1">
              Why should we add them? <span className="text-tertiary font-normal">(optional)</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. They just raised a Series A and are hiring aggressively..."
              className="w-full px-3 py-2 rounded border border-zinc-200 text-sm bg-white placeholder:text-faint focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400/20 resize-none"
            />
          </div>

          {error && (
            <p className="text-red-500 text-xs">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-primary text-white text-sm font-medium rounded hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Suggestion'}
          </button>
        </form>
      )}
    </div>
  )
}
