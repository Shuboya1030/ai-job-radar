'use client'

interface MatchBadgeProps {
  tier: 'strong' | 'good' | 'stretch'
  score?: number
  size?: 'sm' | 'md'
}

const tierConfig = {
  strong: { label: 'Strong', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  good: { label: 'Good', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  stretch: { label: 'Stretch', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
}

export default function MatchBadge({ tier, score, size = 'sm' }: MatchBadgeProps) {
  const config = tierConfig[tier]
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${config.bg} ${config.text} ${config.border} ${sizeClass} font-semibold`}>
      {config.label}
      {score !== undefined && <span className="font-mono opacity-70">{score}</span>}
    </span>
  )
}
