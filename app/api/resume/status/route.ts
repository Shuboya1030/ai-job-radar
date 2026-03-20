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

  // Get resume status
  const { data: resume } = await db
    .from('user_resumes')
    .select('processing_status, error_message, file_name, uploaded_at')
    .eq('user_id', user.id)
    .single()

  // Get subscription status
  const { data: profile } = await db
    .from('user_profiles')
    .select('subscription_status')
    .eq('id', user.id)
    .single()

  if (!resume) {
    return NextResponse.json({
      has_resume: false,
      subscription_status: profile?.subscription_status || 'free',
    })
  }

  return NextResponse.json({
    has_resume: true,
    processing_status: resume.processing_status,
    error_message: resume.error_message,
    file_name: resume.file_name,
    uploaded_at: resume.uploaded_at,
    subscription_status: profile?.subscription_status || 'free',
  })
}
