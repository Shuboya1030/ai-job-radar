import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function getUser() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set() {},
        remove() {},
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { company_name, website, reason } = await request.json()

  if (!company_name || !company_name.trim()) {
    return NextResponse.json({ error: 'company_name is required' }, { status: 400 })
  }
  if (!website || !website.trim()) {
    return NextResponse.json({ error: 'website is required' }, { status: 400 })
  }

  const db = createSupabaseServerClient()
  const { data, error } = await db.from('company_suggestions').insert({
    user_id: user.id,
    company_name: company_name.trim(),
    website: website.trim(),
    reason: reason?.trim() || null,
    status: 'pending',
  }).select().single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
