import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createSupabaseServerClient()
  const { data, error } = await db
    .from('company_suggestions')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ suggestions: data })
}

export async function POST(req: NextRequest) {
  const password = req.headers.get('x-admin-password')
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { suggestion_id, action } = await req.json()

  if (!suggestion_id || !['approved', 'rejected'].includes(action)) {
    return NextResponse.json({ error: 'suggestion_id and action (approved|rejected) required' }, { status: 400 })
  }

  const db = createSupabaseServerClient()

  // If approving, first get the suggestion details to create the company
  if (action === 'approved') {
    const { data: suggestion, error: fetchErr } = await db
      .from('company_suggestions')
      .select('company_name, website')
      .eq('id', suggestion_id)
      .single()

    if (fetchErr || !suggestion) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 })
    }

    // Create the company
    const { error: insertErr } = await db.from('companies').insert({
      name: suggestion.company_name,
      website: suggestion.website,
      is_active: true,
      funding_stage: 'Unknown',
    })

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }
  }

  // Update suggestion status
  const { error: updateErr } = await db
    .from('company_suggestions')
    .update({ status: action })
    .eq('id', suggestion_id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
