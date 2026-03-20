'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-auth'
import type { User, Session } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  subscriptionStatus: 'free' | 'active' | 'cancelled'
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  subscribe: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null, session: null, loading: true,
  subscriptionStatus: 'free',
  signInWithGoogle: async () => {},
  signOut: async () => {},
  subscribe: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [subscriptionStatus, setSubscriptionStatus] = useState<'free' | 'active' | 'cancelled'>('free')

  const supabase = createSupabaseBrowserClient()

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) { ensureProfile(s.user); fetchSubscription(s.user.id) }
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setSession(s)
        setUser(s?.user ?? null)
        if (s?.user) { await ensureProfile(s.user); fetchSubscription(s.user.id) }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function ensureProfile(u: User) {
    // Check if profile exists
    const { data } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', u.id)
      .single()

    const visitorId = typeof window !== 'undefined' ? localStorage.getItem('ajr_vid') : null

    if (!data) {
      // Create profile
      await supabase.from('user_profiles').insert({
        id: u.id,
        email: u.email || '',
        name: u.user_metadata?.full_name || u.user_metadata?.name || '',
        avatar_url: u.user_metadata?.avatar_url || '',
        visitor_id: visitorId,
      })
    } else if (visitorId) {
      // Update visitor_id
      await supabase.from('user_profiles').update({
        visitor_id: visitorId,
      }).eq('id', u.id)
    }

    // Backfill page_views with user_id
    if (visitorId) {
      await (supabase as any).from('page_views').update({
        user_id: u.id,
      }).eq('visitor_id', visitorId).is('user_id', null)
    }
  }

  // Fetch subscription status
  async function fetchSubscription(userId: string) {
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('subscription_status')
        .eq('id', userId)
        .single()
      if (data?.subscription_status) {
        setSubscriptionStatus(data.subscription_status as any)
      }
    } catch {}
  }

  // Trigger Stripe Checkout
  async function subscribe() {
    const res = await fetch('/api/billing/checkout', { method: 'POST' })
    const data = await res.json()
    if (data.url) window.location.href = data.url
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })
  }

  async function signOut() {
    try { await supabase.auth.signOut({ scope: 'global' }) } catch {}
    setUser(null)
    setSession(null)
    // Clear ALL cookies (Supabase splits auth tokens across multiple cookie chunks)
    document.cookie.split(';').forEach(c => {
      const name = c.trim().split('=')[0]
      if (!name) return
      // Clear with multiple path/domain combinations to ensure removal
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}`
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.${window.location.hostname}`
    })
    // Clear localStorage
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-')) localStorage.removeItem(key)
    })
    window.location.href = '/'
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, subscriptionStatus, signInWithGoogle, signOut, subscribe }}>
      {children}
    </AuthContext.Provider>
  )
}
