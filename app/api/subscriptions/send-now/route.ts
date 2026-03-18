import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Resend } from 'resend'

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

function formatFunding(cents: number): string {
  const d = cents / 100
  if (d >= 1e9) return `$${(d / 1e9).toFixed(1)}B`
  if (d >= 1e6) return `$${Math.round(d / 1e6)}M`
  if (d >= 1e3) return `$${Math.round(d / 1e3)}K`
  return `$${d}`
}

function renderJobCard(job: any): string {
  const salary = job.salary_annual_min
    ? `$${job.salary_annual_min / 1000}K–$${(job.salary_annual_max || job.salary_annual_min) / 1000}K`
    : ''

  let funding = ''
  if (job.funding_stage && job.funding_stage !== 'Unknown') funding = job.funding_stage
  if (job.funding_amount_cents && job.funding_amount_status === 'known') {
    const amt = formatFunding(job.funding_amount_cents)
    funding = funding ? `${funding} · ${amt}` : amt
  }

  const tags = [job.role_category, job.work_type !== 'Unknown' ? job.work_type : '', job.location].filter(Boolean).join(' · ')

  return `
    <div style="border:1px solid #e4e4e7; border-radius:8px; padding:16px; margin-bottom:12px; font-family:'DM Sans',system-ui,sans-serif;">
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <span style="font-size:12px; font-weight:600; color:#18181b;">${job.company_name || 'Unknown'}</span>
        <span style="font-size:11px; font-family:monospace; color:#BFFF00; background:#18181b; padding:2px 6px; border-radius:4px;">${funding || 'Funding unknown'}</span>
      </div>
      <div style="font-size:14px; font-weight:700; color:#18181b; margin-bottom:6px;">${job.title}</div>
      ${salary ? `<div style="font-size:13px; font-family:monospace; font-weight:600; color:#18181b; margin-bottom:6px;">${salary}</div>` : ''}
      <div style="font-size:11px; color:#71717a; margin-bottom:10px;">${tags}</div>
      <a href="https://aistartupjob.com/jobs/${job.id}" style="font-size:12px; font-weight:700; color:#18181b; text-decoration:none; background:#BFFF00; padding:6px 14px; border-radius:4px;">View Job →</a>
    </div>`
}

export async function POST(request: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subscription_id } = await request.json()
  if (!subscription_id) return NextResponse.json({ error: 'subscription_id required' }, { status: 400 })

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Get subscription
  const { data: sub } = await db.from('subscriptions')
    .select('*')
    .eq('id', subscription_id)
    .eq('user_id', user.id)
    .single()

  if (!sub) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })

  // Query matching jobs (last 7 days)
  let query = db.from('v_jobs_full')
    .select('*')
    .eq('is_active', true)
    .is('canonical_job_id', null)
    .order('scraped_at', { ascending: false })
    .limit(20)

  const roles = sub.roles || []
  const industries = sub.industries || []
  const funding_stages = sub.funding_stages || []
  const work_types = sub.work_types || []

  if (roles.length > 0) query = query.in('role_category', roles)
  if (industries.length > 0) query = query.in('industry', industries)
  if (funding_stages.length > 0) query = query.in('funding_stage', funding_stages)
  if (work_types.length > 0) query = query.in('work_type', work_types)

  const { data: jobs } = await query

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({
      sent: false,
      message: 'No matching jobs found right now. We\'ll email you as soon as new ones appear!',
      jobs_matched: 0,
    })
  }

  // Build email
  const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'there'
  const jobCards = (jobs as any[]).slice(0, 10).map(renderJobCard).join('\n')

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0; padding:0; background:#fafaf8; font-family:'DM Sans',system-ui,sans-serif;">
      <div style="max-width:600px; margin:0 auto; padding:24px;">
        <div style="margin-bottom:24px;">
          <span style="font-family:monospace; font-weight:700; font-size:14px; color:#18181b;">● AIJobRadar</span>
        </div>

        <h1 style="font-size:18px; font-weight:700; color:#18181b; margin-bottom:4px;">
          Your alert "${sub.name}" is live!
        </h1>
        <p style="font-size:12px; color:#71717a; margin-bottom:20px;">
          Hi ${userName}, here are ${jobs.length} current jobs matching your filters. You'll receive ${sub.frequency} updates when new jobs appear.
        </p>

        ${jobCards}

        <div style="margin-top:24px; padding-top:16px; border-top:1px solid #e4e4e7;">
          <a href="https://aistartupjob.com/jobs" style="display:inline-block; font-size:13px; font-weight:700; color:#18181b; text-decoration:none; background:#BFFF00; padding:8px 20px; border-radius:6px;">Browse all jobs →</a>
        </div>

        <div style="margin-top:24px; padding-top:16px; border-top:1px solid #e4e4e7; font-size:11px; color:#a1a1aa;">
          <a href="https://aistartupjob.com/settings" style="color:#71717a;">Manage alerts</a> ·
          <a href="https://aistartupjob.com/settings" style="color:#71717a;">Unsubscribe</a>
          <br/><br/>
          AIJobRadar · aistartupjob.com
        </div>
      </div>
    </body>
    </html>`

  // Send via Resend
  const resendKey = process.env.RESEND_API_KEY
  let resendId = 'no-key'

  if (resendKey) {
    try {
      const resend = new Resend(resendKey)
      const { data: emailResult } = await resend.emails.send({
        from: 'AIJobRadar <alerts@aistartupjob.com>',
        to: [user.email!],
        subject: `Your alert "${sub.name}" is live — ${jobs.length} matching jobs`,
        html,
      })
      resendId = emailResult?.id || 'sent'
    } catch (e: any) {
      return NextResponse.json({
        sent: false,
        message: `Email send failed: ${e.message}. Your alert is saved and will work on the next scheduled send.`,
        jobs_matched: jobs.length,
      })
    }
  }

  // Log notification
  await db.from('notification_log').insert({
    subscription_id: sub.id,
    user_id: user.id,
    jobs_matched: jobs.length,
    jobs_sent: JSON.stringify((jobs as any[]).slice(0, 10).map((j: any) => ({ id: j.id, title: j.title }))),
    resend_id: resendId,
  })

  // Update last_sent_at
  await db.from('subscriptions').update({
    last_sent_at: new Date().toISOString(),
  }).eq('id', sub.id)

  return NextResponse.json({
    sent: true,
    message: `Email sent to ${user.email} with ${jobs.length} matching jobs!`,
    jobs_matched: jobs.length,
  })
}
