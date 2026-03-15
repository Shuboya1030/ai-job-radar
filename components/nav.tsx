'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Radar, BarChart3, Briefcase, Building2 } from 'lucide-react'
import clsx from 'clsx'

const links = [
  { href: '/', label: 'Overview', icon: Radar },
  { href: '/market/ai-engineer', label: 'Market Analysis', icon: BarChart3 },
  { href: '/jobs', label: 'Job Board', icon: Briefcase },
  { href: '/companies', label: 'Companies', icon: Building2 },
]

export default function Nav() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-accent flex items-center justify-center">
              <Radar className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-ink">
              AIJob<span className="text-brand-600">Radar</span>
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            {links.map(({ href, label, icon: Icon }) => {
              const isActive = href === '/'
                ? pathname === '/'
                : pathname.startsWith(href.split('/').slice(0, 2).join('/'))

              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-ink-secondary hover:bg-slate-100 hover:text-ink'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </header>
  )
}
