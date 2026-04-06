'use client'

import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

const DOT_COLORS: Record<string, string> = {
  funding: 'bg-emerald-500',
  launch: 'bg-blue-500',
  acquisition: 'bg-amber-500',
  milestone: 'bg-purple-500',
  other: 'bg-zinc-400',
}

interface NewsItem {
  id: string
  title: string
  source_url: string
  event_type: string
  published_at: string
}

export default function NewsSidebar() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/news?limit=5')
      .then(r => r.json())
      .then(data => setItems(data.items || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="card p-4">
      <h3 className="section-label mb-3">Latest News</h3>

      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-4 bg-zinc-100 rounded animate-pulse" />
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <p className="text-2xs text-tertiary">No news yet.</p>
      )}

      {!loading && items.length > 0 && (
        <ul className="space-y-2.5">
          {items.map(item => {
            const dotColor = DOT_COLORS[item.event_type] || DOT_COLORS.other
            const timeAgo = (() => {
              try {
                return formatDistanceToNow(new Date(item.published_at), { addSuffix: true })
              } catch {
                return ''
              }
            })()

            return (
              <li key={item.id} className="flex items-start gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${dotColor} mt-1.5 flex-shrink-0`} />
                <div className="min-w-0">
                  <a
                    href={item.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-2xs font-medium text-primary hover:text-lime-dark transition-colors line-clamp-2 leading-snug"
                  >
                    {item.title}
                  </a>
                  {timeAgo && (
                    <p className="text-2xs text-tertiary font-mono mt-0.5">{timeAgo}</p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Link
        href="/news"
        className="block mt-3 pt-2.5 border-t border-zinc-100 text-2xs font-semibold text-lime-dark hover:text-lime transition-colors"
      >
        See all news &rarr;
      </Link>
    </div>
  )
}
