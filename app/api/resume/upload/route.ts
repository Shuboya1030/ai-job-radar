import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

type FileType = 'pdf' | 'docx' | 'md'

function detectFileType(fileName: string): FileType | null {
  const ext = fileName.toLowerCase().split('.').pop()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (ext === 'md' || ext === 'markdown') return 'md'
  return null
}

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

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  // Validate file type
  const fileType = detectFileType(file.name)
  if (!fileType) {
    return NextResponse.json({ error: 'Unsupported file type. Use PDF, DOCX, or MD.' }, { status: 400 })
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large. Maximum 5MB.' }, { status: 400 })
  }

  const db = createSupabaseServerClient()
  const buffer = Buffer.from(await file.arrayBuffer())

  // Upload to Supabase Storage
  const storagePath = `${user.id}/${file.name}`
  const { error: storageError } = await db.storage
    .from('resumes')
    .upload(storagePath, buffer, { upsert: true, contentType: file.type })

  if (storageError) {
    console.error('Storage upload failed:', storageError)
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
  }

  // Upsert resume record
  const { error: dbError } = await db
    .from('user_resumes')
    .upsert({
      user_id: user.id,
      file_url: storagePath,
      file_name: file.name,
      file_type: fileType,
      file_size: file.size,
      raw_text: null,
      parsed_profile: null,
      processing_status: 'pending',
      error_message: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (dbError) {
    console.error('DB upsert failed:', dbError)
    return NextResponse.json({ error: 'Failed to save resume' }, { status: 500 })
  }

  // Delete old match results
  await db.from('user_job_matches').delete().eq('user_id', user.id)

  // Trigger async processing (fire-and-forget)
  const processUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/resume/process`
  fetch(processUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: user.id }),
  }).catch(err => console.error('Failed to trigger processing:', err))

  return NextResponse.json({ status: 'processing' }, { status: 202 })
}
