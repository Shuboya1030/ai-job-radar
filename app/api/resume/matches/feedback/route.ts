import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createSupabaseServerClient } from '@/lib/supabase-server'

async function getUser() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value }, set() {}, remove() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function PUT(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { match_id, feedback, reason } = await req.json()
  if (!match_id || !['up', 'down'].includes(feedback)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  }

  const db = createSupabaseServerClient()

  // Verify the match belongs to this user
  const { data: match } = await db
    .from('user_job_matches')
    .select('id')
    .eq('id', match_id)
    .eq('user_id', user.id)
    .single()

  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

  const { error } = await db
    .from('user_job_matches')
    .update({
      user_feedback: feedback,
      feedback_reason: reason || null,
    })
    .eq('id', match_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
