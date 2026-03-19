import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// GET: list all matches with resume + job + events for admin review
export async function GET(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createSupabaseServerClient()
  const url = new URL(req.url)
  const tier = url.searchParams.get('tier')
  const feedback = url.searchParams.get('feedback')
  const limit = parseInt(url.searchParams.get('limit') || '50')
  const offset = parseInt(url.searchParams.get('offset') || '0')

  let query = db
    .from('user_job_matches')
    .select(`
      id, match_score, match_tier, match_reasoning, skills_matched, skills_missing,
      dimension_scores, user_feedback, feedback_reason,
      user_resumes!inner(parsed_profile, file_name),
      jobs!inner(title, description, location, role_category,
        companies(name, funding_stage)),
      match_reviews(verdict, notes, reviewed_at),
      match_events(event_type, created_at)
    `, { count: 'exact' })
    .order('match_score', { ascending: false })
    .range(offset, offset + limit - 1)

  if (tier) query = query.eq('match_tier', tier)
  if (feedback) query = query.eq('user_feedback', feedback)

  const { data, count, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ matches: data, total: count })
}

// POST: submit admin review
export async function POST(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { match_id, verdict, notes } = await req.json()
  if (!match_id || !['good', 'bad', 'borderline'].includes(verdict)) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  }

  const db = createSupabaseServerClient()
  const { error } = await db.from('match_reviews').upsert({
    match_id,
    verdict,
    notes: notes || null,
    reviewed_at: new Date().toISOString(),
  }, { onConflict: 'match_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
