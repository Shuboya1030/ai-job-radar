'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'

const links = [
  { href: '/', label: 'Overview' },
  { href: '/market/ai-engineer', label: 'Market' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/compare', label: 'Compare' },
]

export default function Nav() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 bg-primary">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-12">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-lime" />
            <span className="font-mono font-bold text-sm text-white tracking-tight">
              AIJobRadar
            </span>
          </Link>

          <nav className="flex items-center gap-0.5">
            {links.map(({ href, label }) => {
              const isActive = href === '/'
                ? pathname === '/'
                : pathname.startsWith(href.split('/').slice(0, 2).join('/'))

              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'px-3 py-1.5 rounded text-xs font-medium transition-colors',
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-zinc-400 hover:text-white'
                  )}
                >
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
