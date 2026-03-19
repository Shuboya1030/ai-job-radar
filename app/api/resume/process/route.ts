import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { extractText } from '@/lib/resume-parser'
import { parseResume, matchJobsBatch, JobForMatching } from '@/lib/resume-ai'

// Allow longer execution (Vercel Pro: up to 300s)
export const maxDuration = 120

const BATCH_SIZE = 20

export async function POST(req: NextRequest) {
  const { user_id } = await req.json()
  if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

  const db = createSupabaseServerClient()

  try {
    // 1. Get resume record
    const { data: resume } = await db
      .from('user_resumes')
      .select('*')
      .eq('user_id', user_id)
      .single()

    if (!resume) return NextResponse.json({ error: 'No resume found' }, { status: 404 })

    // 2. Update status to parsing
    await db.from('user_resumes').update({ processing_status: 'parsing' }).eq('user_id', user_id)

    // 3. Download file from storage
    const { data: fileData, error: downloadError } = await db.storage
      .from('resumes')
      .download(resume.file_url)

    if (downloadError || !fileData) throw new Error('Failed to download resume file')

    const buffer = Buffer.from(await fileData.arrayBuffer())

    // 4. Extract text
    const rawText = await extractText(buffer, resume.file_type as any)
    await db.from('user_resumes').update({ raw_text: rawText }).eq('user_id', user_id)

    // 5. Parse resume with Claude
    const profile = await parseResume(rawText)
    await db.from('user_resumes').update({
      parsed_profile: profile,
      processing_status: 'matching',
    }).eq('user_id', user_id)

    // 6. Get all active jobs with their company info
    const { data: jobs } = await db
      .from('jobs')
      .select('id, title, description, company_id, location, role_category, companies(name, funding_stage)')
      .eq('is_active', true)

    if (!jobs || jobs.length === 0) {
      await db.from('user_resumes').update({ processing_status: 'completed' }).eq('user_id', user_id)
      return NextResponse.json({ status: 'completed', matches: 0 })
    }

    // 7. Map jobs to matching format
    const jobsForMatching: JobForMatching[] = jobs.map(j => ({
      id: j.id,
      title: j.title,
      description: j.description,
      company_name: (j.companies as any)?.name || 'Unknown',
      funding_stage: (j.companies as any)?.funding_stage || null,
      location: j.location,
      role_category: j.role_category,
    }))

    // 8. Match in batches
    let totalMatches = 0
    for (let i = 0; i < jobsForMatching.length; i += BATCH_SIZE) {
      const batch = jobsForMatching.slice(i, i + BATCH_SIZE)
      try {
        const results = await matchJobsBatch(profile, batch)

        // Insert matches
        for (const match of results) {
          if (match.match_score >= 40) {
            await db.from('user_job_matches').upsert({
              user_id,
              job_id: match.job_id,
              match_score: match.match_score,
              match_tier: match.match_tier,
              match_reasoning: match.match_reasoning,
              skills_matched: match.skills_matched,
              skills_missing: match.skills_missing,
              dimension_scores: match.dimension_scores || null,
              refreshed_at: new Date().toISOString(),
            }, { onConflict: 'user_id,job_id' })
            totalMatches++
          }
        }
      } catch (batchError) {
        console.error(`Batch ${i / BATCH_SIZE} failed:`, batchError)
        // Continue with remaining batches — partial results are OK
      }
    }

    // 9. Mark completed
    await db.from('user_resumes').update({ processing_status: 'completed' }).eq('user_id', user_id)

    return NextResponse.json({ status: 'completed', matches: totalMatches })
  } catch (error: any) {
    console.error('Resume processing failed:', error)
    await db.from('user_resumes').update({
      processing_status: 'failed',
      error_message: error.message || 'Unknown error',
    }).eq('user_id', user_id)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
