import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

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

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { createSupabaseServerClient } = await import('@/lib/supabase-server')
  const db = createSupabaseServerClient()

  const { data } = await db
    .from('user_resumes')
    .select('processing_status, error_message, file_name, uploaded_at')
    .eq('user_id', user.id)
    .single()

  if (!data) return NextResponse.json({ has_resume: false })

  return NextResponse.json({
    has_resume: true,
    processing_status: data.processing_status,
    error_message: data.error_message,
    file_name: data.file_name,
    uploaded_at: data.uploaded_at,
  })
}
