'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/auth-provider'

function getVisitorId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem('ajr_vid')
  if (!id) {
    id = Math.random().toString(36).substring(2) + Date.now().toString(36)
    localStorage.setItem('ajr_vid', id)
  }
  return id
}

export default function Analytics() {
  const pathname = usePathname()
  const { user } = useAuth()

  useEffect(() => {
    if (pathname.startsWith('/admin')) return

    const visitorId = getVisitorId()

    ;(supabase as any).from('page_views').insert({
      path: pathname,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent,
      visitor_id: visitorId,
      user_id: user?.id || null,
    }).then(() => {})
  }, [pathname, user])

  return null
}
