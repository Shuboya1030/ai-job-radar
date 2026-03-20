import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { sendAlert } from '@/lib/alert'

const MAX_RETRIES = 3

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

/**
 * Called by Dashboard frontend when a paid user has no matches.
 * Checks retry count, triggers matching if under limit, sends alert if over.
 */
export async function POST() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createSupabaseServerClient()

  // Check subscription
  const { data: profile } = await db.from('user_profiles')
    .select('subscription_status, email, name')
    .eq('id', user.id).single()

  if (profile?.subscription_status !== 'active') {
    return NextResponse.json({ error: 'Not subscribed' }, { status: 403 })
  }

  // Check resume
  const { data: resume } = await db.from('user_resumes')
    .select('processing_status, match_retry_count, parsed_profile')
    .eq('user_id', user.id).single()

  if (!resume?.parsed_profile) {
    return NextResponse.json({ error: 'No parsed profile' }, { status: 400 })
  }

  // Check existing matches
  const { count: matchCount } = await db.from('user_job_matches')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (matchCount && matchCount > 0) {
    return NextResponse.json({ status: 'already_matched', matches: matchCount })
  }

  const retryCount = resume.match_retry_count || 0

  // Over retry limit — send alert, don't retry
  if (retryCount >= MAX_RETRIES) {
    await sendAlert(
      `Paid user stuck: ${profile.email}`,
      `User ${profile.email} (${profile.name || 'no name'}) has paid but matching failed after ${retryCount} retries.\n\n` +
      `User ID: ${user.id}\n` +
      `Resume status: ${resume.processing_status}\n` +
      `Match count: ${matchCount}\n\n` +
      `Action needed: manually trigger matching or investigate the error.`
    )
    return NextResponse.json({ status: 'alert_sent', retries: retryCount })
  }

  // Increment retry count
  await db.from('user_resumes').update({
    match_retry_count: retryCount + 1,
    processing_status: 'matching_stage1',
    error_message: null,
  }).eq('user_id', user.id)

  // Trigger stage 1 matching
  const processUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/resume/process`
  try {
    const res = await fetch(processUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, mode: 'stage1' }),
    })
    const data = await res.json()
    return NextResponse.json({ status: 'retrying', retry: retryCount + 1, ...data })
  } catch (err: any) {
    return NextResponse.json({ status: 'retry_failed', error: err.message }, { status: 500 })
  }
}
