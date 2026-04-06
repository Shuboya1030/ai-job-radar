'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { useAuth } from '@/components/auth-provider'

const EVENT_TYPES = ['funding', 'launch', 'acquisition', 'milestone', 'other'] as const
type EventType = (typeof EVENT_TYPES)[number]

const EVENT_COLORS: Record<EventType, string> = {
  funding: 'bg-emerald-100 text-emerald-800',
  launch: 'bg-blue-100 text-blue-800',
  acquisition: 'bg-amber-100 text-amber-800',
  milestone: 'bg-purple-100 text-purple-800',
  other: 'bg-zinc-100 text-zinc-700',
}

const INDUSTRY_OPTIONS = [
  'AI/ML', 'Fintech', 'Healthcare', 'E-commerce', 'SaaS', 'Cybersecurity',
  'Robotics', 'EdTech', 'Adtech', 'Cloud/Infra', 'Gaming', 'Automotive',
  'Biotech', 'Enterprise Software', 'Social/Media',
]

interface NewsItem {
  id: string
  title: string
  summary: string
  source_url: string
  source_name: string
  event_type: EventType
  industries: string[]
  published_at: string
}

export default function NewsPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<NewsItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [eventType, setEventType] = useState('')
  const [industry, setIndustry] = useState('')
  const [offset, setOffset] = useState(0)
  const limit = 20

  const fetchNews = useCallback(async (reset = false) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (eventType) params.set('event_type', eventType)
    if (industry) params.set('industry', industry)
    params.set('limit', String(limit))
    params.set('offset', reset ? '0' : String(offset))

    try {
      const res = await fetch(`/api/news?${params}`)
      const data = await res.json()
      if (reset) {
        setItems(data.items || [])
        setOffset(0)
      } else {
        setItems(prev => [...prev, ...(data.items || [])])
      }
      setTotal(data.total || 0)
    } catch {
      // silently fail
    }
    setLoading(false)
  }, [eventType, industry, offset])

  useEffect(() => { fetchNews(true) }, [eventType, industry])

  const loadMore = () => {
    const newOffset = offset + limit
    setOffset(newOffset)
    const params = new URLSearchParams()
    if (eventType) params.set('event_type', eventType)
    if (industry) params.set('industry', industry)
    params.set('limit', String(limit))
    params.set('offset', String(newOffset))
    fetch(`/api/news?${params}`)
      .then(r => r.json())
      .then(data => setItems(prev => [...prev, ...(data.items || [])]))
  }

  const handleSubscribe = async () => {
    if (!user) return
    setSubscribing(true)
    try {
      const res = await fetch('/api/news/subscribe', { method: 'POST' })
      if (res.ok) setSubscribed(true)
    } catch {
      // silently fail
    }
    setSubscribing(false)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-primary">AI Startup News</h1>
          <p className="text-xs font-mono text-tertiary mt-0.5">
            {total} articles &middot; latest funding, launches &amp; milestones
          </p>
        </div>
        {user && (
          <button
            onClick={handleSubscribe}
            disabled={subscribing || subscribed}
            className={`px-4 py-1.5 text-xs font-semibold rounded transition-colors ${
              subscribed
                ? 'bg-emerald-100 text-emerald-700 cursor-default'
                : 'bg-lime text-black hover:bg-lime-dark'
            }`}
          >
            {subscribed ? 'Subscribed' : subscribing ? 'Subscribing...' : 'Subscribe'}
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-2 mb-6">
        <select
          value={eventType}
          onChange={e => setEventType(e.target.value)}
          className="px-3 py-1.5 rounded border border-zinc-200 text-xs text-secondary bg-white focus:outline-none focus:border-zinc-400"
        >
          <option value="">All events</option>
          {EVENT_TYPES.map(t => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
        <select
          value={industry}
          onChange={e => setIndustry(e.target.value)}
          className="px-3 py-1.5 rounded border border-zinc-200 text-xs text-secondary bg-white focus:outline-none focus:border-zinc-400"
        >
          <option value="">All industries</option>
          {INDUSTRY_OPTIONS.map(ind => (
            <option key={ind} value={ind}>{ind}</option>
          ))}
        </select>
      </div>

      {/* News List */}
      <div className="space-y-3">
        {items.map(item => (
          <NewsCard key={item.id} item={item} />
        ))}
      </div>

      {loading && <p className="text-center text-tertiary text-sm py-12">Loading...</p>}

      {!loading && items.length < total && (
        <button
          onClick={loadMore}
          className="w-full mt-6 py-2.5 text-xs font-mono font-semibold text-primary bg-surface-raised rounded border border-zinc-200 hover:border-zinc-400 transition-colors"
        >
          LOAD MORE &middot; {items.length}/{total}
        </button>
      )}

      {!loading && items.length === 0 && (
        <p className="text-center text-tertiary text-sm py-16">No news articles match your filters.</p>
      )}
    </div>
  )
}

function NewsCard({ item }: { item: NewsItem }) {
  const eventColor = EVENT_COLORS[item.event_type] || EVENT_COLORS.other
  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(item.published_at), { addSuffix: true })
    } catch {
      return ''
    }
  })()

  return (
    <div className="card card-hover p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <a
          href={item.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold text-primary hover:text-lime-dark transition-colors leading-snug"
        >
          {item.title}
        </a>
        <span className={`badge ${eventColor} flex-shrink-0 text-2xs font-semibold`}>
          {item.event_type}
        </span>
      </div>

      {item.summary && (
        <p className="text-2xs text-secondary line-clamp-2 mb-2.5 leading-relaxed">
          {item.summary}
        </p>
      )}

      <div className="flex items-center flex-wrap gap-1.5">
        {item.industries?.map(tag => (
          <span key={tag} className="badge bg-zinc-100 text-zinc-600 text-2xs font-medium">
            {tag}
          </span>
        ))}
        <span className="badge bg-primary/5 text-primary text-2xs font-mono">
          {item.source_name}
        </span>
        {timeAgo && (
          <span className="text-2xs text-tertiary ml-auto font-mono">{timeAgo}</span>
        )}
      </div>
    </div>
  )
}
