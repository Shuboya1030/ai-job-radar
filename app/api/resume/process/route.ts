import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { extractText } from '@/lib/resume-parser'
import { parseResume, matchJobsBatch, JobForMatching } from '@/lib/resume-ai'

export const maxDuration = 120

const BATCH_SIZE = 20
const STAGE1_TOP_N = 50

export async function POST(req: NextRequest) {
  const { user_id, mode } = await req.json()
  if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

  const startTime = Date.now()
  const db = createSupabaseServerClient()

  try {
    const { data: resume } = await db
      .from('user_resumes')
      .select('*')
      .eq('user_id', user_id)
      .single()

    if (!resume) return NextResponse.json({ error: 'No resume found' }, { status: 404 })

    // === PARSE THEN MATCH MODE ===
    // Parse profile, then auto-trigger stage1 matching (used when paywall disabled)
    if (mode === 'parse_then_match') {
      await db.from('user_resumes').update({ processing_status: 'parsing' }).eq('user_id', user_id)

      const { data: fileData, error: downloadError } = await db.storage
        .from('resumes')
        .download(resume.file_url)
      if (downloadError || !fileData) throw new Error('Failed to download resume file')

      const buffer = Buffer.from(await fileData.arrayBuffer())
      const rawText = await extractText(buffer, resume.file_type as any)
      await db.from('user_resumes').update({ raw_text: rawText }).eq('user_id', user_id)

      const profile = await parseResume(rawText)
      await db.from('user_resumes').update({
        parsed_profile: profile,
        processing_status: 'matching_stage1',
      }).eq('user_id', user_id)

      // Now trigger stage1 matching with the freshly parsed profile
      const processUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/resume/process`
      fetch(processUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id, mode: 'stage1' }),
      }).catch(err => console.error('Failed to trigger stage1:', err))

      return NextResponse.json({ status: 'matching_stage1' })
    }

    // === PARSE ONLY MODE ===
    // Used by upload route — only extract text + parse profile, no matching
    if (mode === 'parse_only') {
      await db.from('user_resumes').update({ processing_status: 'parsing' }).eq('user_id', user_id)

      const { data: fileData, error: downloadError } = await db.storage
        .from('resumes')
        .download(resume.file_url)
      if (downloadError || !fileData) throw new Error('Failed to download resume file')

      const buffer = Buffer.from(await fileData.arrayBuffer())
      const rawText = await extractText(buffer, resume.file_type as any)
      await db.from('user_resumes').update({ raw_text: rawText }).eq('user_id', user_id)

      const profile = await parseResume(rawText)
      const parseDuration = Math.round((Date.now() - startTime) / 1000)
      await db.from('user_resumes').update({
        parsed_profile: profile,
        processing_status: 'parsed',
        parse_duration_seconds: parseDuration,
      }).eq('user_id', user_id)

      return NextResponse.json({ status: 'parsed', profile, duration_seconds: parseDuration })
    }

    // === STAGE 1: Fast pre-filtered matching (~10s) ===
    if (mode === 'stage1') {
      const profile = resume.parsed_profile
      if (!profile) return NextResponse.json({ error: 'No parsed profile' }, { status: 400 })

      await db.from('user_resumes').update({ processing_status: 'matching_stage1' }).eq('user_id', user_id)

      // Delete old matches
      await db.from('user_job_matches').delete().eq('user_id', user_id)

      // Get all active jobs with skills
      const { data: jobs } = await db
        .from('jobs')
        .select('id, title, description, location, role_category, hard_skills, tools, companies(name, funding_stage)')
        .eq('is_active', true)

      if (!jobs?.length) {
        await db.from('user_resumes').update({ processing_status: 'completed' }).eq('user_id', user_id)
        return NextResponse.json({ status: 'completed', matches: 0 })
      }

      // Pre-filter: score jobs by skill overlap + role match
      const userSkills = (profile.skills || []).map((s: string) => s.toLowerCase())
      const userTitles = (profile.job_titles || []).join(' ').toLowerCase()

      // Determine user's likely role category
      let userRole = 'AI Engineer'
      if (userTitles.includes('product') || userTitles.includes('pm') || userTitles.includes('manager')) userRole = 'AI PM'
      else if (userTitles.includes('software') || userTitles.includes('swe') || userTitles.includes('full stack')) userRole = 'Software Engineer'

      const scoredJobs = jobs.map(j => {
        let score = 0

        // Role category bonus
        if (j.role_category === userRole) score += 10

        // Skill overlap
        const parseArr = (v: any): string[] => {
          if (!v) return []
          const arr = Array.isArray(v) ? v : (typeof v === 'string' ? (() => { try { return JSON.parse(v) } catch { return [] } })() : [])
          return arr.map((s: any) => (typeof s === 'string' ? s : s?.name || '').toLowerCase())
        }

        const jobSkills = [...parseArr(j.hard_skills), ...parseArr(j.tools)]
        for (const us of userSkills) {
          if (jobSkills.some(js => js.includes(us) || us.includes(js))) score++
        }

        return { job: j, score }
      })

      // Sort by overlap score, take top N
      scoredJobs.sort((a, b) => b.score - a.score)
      const topJobs = scoredJobs.slice(0, STAGE1_TOP_N)

      // Map to matching format
      const jobsForMatching: JobForMatching[] = topJobs.map(({ job: j }) => ({
        id: j.id,
        title: j.title,
        description: j.description,
        company_name: (j.companies as any)?.name || 'Unknown',
        funding_stage: (j.companies as any)?.funding_stage || null,
        location: j.location,
        role_category: j.role_category,
      }))

      // AI match the top 50
      let totalMatches = 0
      for (let i = 0; i < jobsForMatching.length; i += BATCH_SIZE) {
        const batch = jobsForMatching.slice(i, i + BATCH_SIZE)
        try {
          const results = await matchJobsBatch(profile, batch)
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
          console.error(`Stage 1 batch failed:`, batchError)
        }
      }

      // Stage 1 done — mark as completed so user can see results immediately
      const matchDuration = Math.round((Date.now() - startTime) / 1000)
      await db.from('user_resumes').update({
        processing_status: 'completed',
        match_duration_seconds: matchDuration,
      }).eq('user_id', user_id)

      // Trigger stage 2 in background for more matches (best effort, won't break if it fails)
      const matchedJobIds = topJobs.map(t => t.job.id)
      const processUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/resume/process`
      fetch(processUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id, mode: 'stage2', exclude_job_ids: matchedJobIds }),
      }).catch(err => console.error('Stage 2 trigger failed (non-fatal):', err))

      return NextResponse.json({ status: 'completed', matches: totalMatches })
    }

    // === STAGE 2: Background remaining jobs (best effort — never sets 'failed') ===
    if (mode === 'stage2') {
      try {
        const profile = resume.parsed_profile
        if (!profile) return NextResponse.json({ status: 'completed', matches: 0 })

        const body = await req.clone().json().catch(() => ({}))
        const excludeIds: string[] = body.exclude_job_ids || []

        const { data: jobs } = await db
          .from('jobs')
          .select('id, title, description, location, role_category, companies(name, funding_stage)')
          .eq('is_active', true)

        if (!jobs?.length) return NextResponse.json({ status: 'completed', matches: 0 })

        const remainingJobs = jobs.filter(j => !excludeIds.includes(j.id))

        const jobsForMatching: JobForMatching[] = remainingJobs.map(j => ({
          id: j.id,
          title: j.title,
          description: j.description,
          company_name: (j.companies as any)?.name || 'Unknown',
          funding_stage: (j.companies as any)?.funding_stage || null,
          location: j.location,
          role_category: j.role_category,
        }))

        let totalMatches = 0
        for (let i = 0; i < jobsForMatching.length; i += BATCH_SIZE) {
          const batch = jobsForMatching.slice(i, i + BATCH_SIZE)
          try {
            const results = await matchJobsBatch(profile, batch)
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
            console.error(`Stage 2 batch ${i / BATCH_SIZE} failed:`, batchError)
          }
        }

        return NextResponse.json({ status: 'completed', matches: totalMatches })
      } catch (error: any) {
        // Stage 2 is best-effort — log error but DON'T set status to 'failed'
        // Stage 1 results are already usable
        console.error('Stage 2 failed (non-fatal):', error.message)
        return NextResponse.json({ status: 'completed', matches: 0 })
      }
    }

    // === LEGACY FULL MODE (backward compat) ===
    await db.from('user_resumes').update({ processing_status: 'parsing' }).eq('user_id', user_id)

    const { data: fileData, error: downloadError } = await db.storage
      .from('resumes')
      .download(resume.file_url)
    if (downloadError || !fileData) throw new Error('Failed to download resume file')

    const buffer = Buffer.from(await fileData.arrayBuffer())
    const rawText = await extractText(buffer, resume.file_type as any)
    await db.from('user_resumes').update({ raw_text: rawText }).eq('user_id', user_id)

    const profile = await parseResume(rawText)
    await db.from('user_resumes').update({
      parsed_profile: profile,
      processing_status: 'matching',
    }).eq('user_id', user_id)

    const { data: jobs } = await db
      .from('jobs')
      .select('id, title, description, company_id, location, role_category, companies(name, funding_stage)')
      .eq('is_active', true)

    if (!jobs?.length) {
      await db.from('user_resumes').update({ processing_status: 'completed' }).eq('user_id', user_id)
      return NextResponse.json({ status: 'completed', matches: 0 })
    }

    const jobsForMatching: JobForMatching[] = jobs.map(j => ({
      id: j.id,
      title: j.title,
      description: j.description,
      company_name: (j.companies as any)?.name || 'Unknown',
      funding_stage: (j.companies as any)?.funding_stage || null,
      location: j.location,
      role_category: j.role_category,
    }))

    let totalMatches = 0
    for (let i = 0; i < jobsForMatching.length; i += BATCH_SIZE) {
      const batch = jobsForMatching.slice(i, i + BATCH_SIZE)
      try {
        const results = await matchJobsBatch(profile, batch)
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
      }
    }

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
