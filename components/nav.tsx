'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { useState, useRef, useEffect } from 'react'
import clsx from 'clsx'

const links = [
  { href: '/', label: 'Overview' },
  { href: '/market/ai-engineer', label: 'Market' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/compare', label: 'Compare' },
]

export default function Nav() {
  const pathname = usePathname()
  const { user, loading, signInWithGoogle, signOut } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

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

          <div className="flex items-center gap-4">
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

            {/* Auth */}
            {loading ? (
              <div className="w-7 h-7 rounded-full bg-zinc-700 animate-pulse" />
            ) : user ? (
              <div className="relative" ref={dropRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2"
                >
                  {user.user_metadata?.avatar_url ? (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt=""
                      className="w-7 h-7 rounded-full border border-zinc-600"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-lime flex items-center justify-center text-xs font-bold text-black">
                      {(user.email || '?')[0].toUpperCase()}
                    </div>
                  )}
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-10 w-48 bg-white rounded-lg shadow-lg border border-zinc-200 py-1 z-50">
                    <div className="px-3 py-2 border-b border-zinc-100">
                      <p className="text-xs font-semibold text-primary truncate">{user.user_metadata?.full_name || user.email}</p>
                      <p className="text-2xs text-tertiary truncate">{user.email}</p>
                    </div>
                    <Link href="/settings" className="block px-3 py-2 text-xs text-secondary hover:bg-zinc-50" onClick={() => setDropdownOpen(false)}>
                      My Alerts
                    </Link>
                    <Link href="/saved" className="block px-3 py-2 text-xs text-secondary hover:bg-zinc-50" onClick={() => setDropdownOpen(false)}>
                      Saved Jobs
                    </Link>
                    <button onClick={() => { signOut(); setDropdownOpen(false) }} className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-zinc-50">
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="px-3 py-1.5 bg-lime text-black text-xs font-bold rounded hover:bg-lime-dark transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
