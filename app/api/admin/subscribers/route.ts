import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createSupabaseServerClient()

  // All users with subscription info
  const { data: users } = await db
    .from('user_profiles')
    .select('id, email, name, subscription_status, stripe_customer_id, subscription_expires_at, created_at')
    .order('created_at', { ascending: false })

  // All resumes with status + timing
  const { data: resumes } = await db
    .from('user_resumes')
    .select('user_id, processing_status, error_message, match_retry_count, file_name, uploaded_at, parse_duration_seconds, match_duration_seconds')

  // Match counts per user
  const { data: matchCounts } = await db
    .from('user_job_matches')
    .select('user_id')

  const matchMap: Record<string, number> = {}
  matchCounts?.forEach((m: any) => {
    matchMap[m.user_id] = (matchMap[m.user_id] || 0) + 1
  })

  const resumeMap: Record<string, any> = {}
  resumes?.forEach((r: any) => { resumeMap[r.user_id] = r })

  // Build subscriber details
  const subscribers = (users || []).map(u => ({
    ...u,
    resume: resumeMap[u.id] || null,
    match_count: matchMap[u.id] || 0,
  }))

  // Compute health metrics
  const totalUsers = users?.length || 0
  const activeSubscribers = users?.filter(u => u.subscription_status === 'active').length || 0
  const cancelledSubscribers = users?.filter(u => u.subscription_status === 'cancelled').length || 0
  const freeUsers = users?.filter(u => u.subscription_status === 'free' || !u.subscription_status).length || 0
  const usersWithResume = resumes?.length || 0

  // Paid users health
  const paidUsers = subscribers.filter(u => u.subscription_status === 'active')
  const paidWithMatches = paidUsers.filter(u => u.match_count > 0).length
  const paidStuck = paidUsers.filter(u => u.match_count === 0)
  const paidFailed = paidUsers.filter(u => u.resume?.processing_status === 'failed')
  const matchSuccessRate = paidUsers.length > 0 ? Math.round((paidWithMatches / paidUsers.length) * 100) : 100

  // Conversion funnel
  const signupToResumeRate = totalUsers > 0 ? Math.round((usersWithResume / totalUsers) * 100) : 0
  const resumeToPayRate = usersWithResume > 0 ? Math.round((activeSubscribers / usersWithResume) * 100) : 0

  // Timing metrics
  const parseTimes = resumes?.filter(r => r.parse_duration_seconds).map(r => r.parse_duration_seconds) || []
  const matchTimes = resumes?.filter(r => r.match_duration_seconds).map(r => r.match_duration_seconds) || []
  const avgParseTime = parseTimes.length > 0 ? Math.round(parseTimes.reduce((a: number, b: number) => a + b, 0) / parseTimes.length) : null
  const avgMatchTime = matchTimes.length > 0 ? Math.round(matchTimes.reduce((a: number, b: number) => a + b, 0) / matchTimes.length) : null
  const maxMatchTime = matchTimes.length > 0 ? Math.max(...matchTimes) : null

  return NextResponse.json({
    metrics: {
      total_users: totalUsers,
      active_subscribers: activeSubscribers,
      cancelled_subscribers: cancelledSubscribers,
      free_users: freeUsers,
      users_with_resume: usersWithResume,
      match_success_rate: matchSuccessRate,
      signup_to_resume_rate: signupToResumeRate,
      resume_to_pay_rate: resumeToPayRate,
      stuck_paid_users: paidStuck.length,
      failed_paid_users: paidFailed.length,
      avg_parse_seconds: avgParseTime,
      avg_match_seconds: avgMatchTime,
      max_match_seconds: maxMatchTime,
    },
    subscribers,
  })
}
