'use client'

interface MatchBadgeProps {
  tier: 'strong' | 'good' | 'stretch'
  score?: number
  size?: 'sm' | 'md'
}

const tierConfig = {
  strong: { label: 'Strong Match', bg: 'bg-lime/20', text: 'text-lime', border: 'border-lime/30' },
  good: { label: 'Good Match', bg: 'bg-yellow-400/20', text: 'text-yellow-400', border: 'border-yellow-400/30' },
  stretch: { label: 'Stretch', bg: 'bg-orange-400/20', text: 'text-orange-400', border: 'border-orange-400/30' },
}

export default function MatchBadge({ tier, score, size = 'sm' }: MatchBadgeProps) {
  const config = tierConfig[tier]
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border ${config.bg} ${config.text} ${config.border} ${sizeClass} font-mono`}>
      {config.label}
      {score !== undefined && <span className="opacity-70">({score})</span>}
    </span>
  )
}
