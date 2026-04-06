import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { extractText } from '@/lib/resume-parser'
import { parseResume, matchJobsBatch, JobForMatching, matchCompaniesBatch, CompanyForMatching } from '@/lib/resume-ai'

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
    // Parse profile, then run stage1 matching in the SAME request (no fire-and-forget)
    if (mode === 'parse_then_match') {
      // Step 1: Parse
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
        processing_status: 'matching_stage1',
        parse_duration_seconds: parseDuration,
      }).eq('user_id', user_id)

      // Step 2: Stage 1 matching inline (NOT fire-and-forget)
      await db.from('user_job_matches').delete().eq('user_id', user_id)

      const { data: jobs } = await db
        .from('jobs')
        .select('id, title, description, location, role_category, hard_skills, tools, companies(name, funding_stage)')
        .eq('is_active', true)

      if (!jobs?.length) {
        await db.from('user_resumes').update({ processing_status: 'completed', match_duration_seconds: 0 }).eq('user_id', user_id)
        return NextResponse.json({ status: 'completed', matches: 0 })
      }

      // Pre-filter top 50 by skill overlap
      const userSkills = (profile.skills || []).map((s: string) => s.toLowerCase())
      const userTitles = (profile.job_titles || []).join(' ').toLowerCase()
      let userRole = 'AI Engineer'
      if (userTitles.includes('product') || userTitles.includes('pm') || userTitles.includes('manager')) userRole = 'AI PM'
      else if (userTitles.includes('software') || userTitles.includes('swe') || userTitles.includes('full stack')) userRole = 'Software Engineer'

      const parseArr = (v: any): string[] => {
        if (!v) return []
        const arr = Array.isArray(v) ? v : (typeof v === 'string' ? (() => { try { return JSON.parse(v) } catch { return [] } })() : [])
        return arr.map((s: any) => (typeof s === 'string' ? s : s?.name || '').toLowerCase())
      }

      const scoredJobs = jobs.map(j => {
        let score = 0
        if (j.role_category === userRole) score += 10
        const jobSkills = [...parseArr(j.hard_skills), ...parseArr(j.tools)]
        for (const us of userSkills) {
          if (jobSkills.some(js => js.includes(us) || us.includes(js))) score++
        }
        return { job: j, score }
      })

      scoredJobs.sort((a, b) => b.score - a.score)
      const topJobs = scoredJobs.slice(0, STAGE1_TOP_N)

      const jobsForMatching: JobForMatching[] = topJobs.map(({ job: j }) => ({
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
          console.error('parse_then_match batch failed:', batchError)
        }
      }

      // Company matching — rule-based scoring (no OpenAI calls, instant)
      let totalCompanyMatches = 0
      try {
        await db.from('user_company_matches').delete().eq('user_id', user_id)

        const { data: allCompanies } = await db
          .from('companies')
          .select('id, name, industry, product_description, funding_stage, employee_range')
          .eq('is_active', true)

        if (allCompanies?.length) {
          const { data: allJobsForCo } = await db
            .from('jobs')
            .select('company_id, hard_skills, tools')
            .eq('is_active', true)

          const coSkills: Record<string, string[]> = {}
          const coJobCount: Record<string, number> = {}
          const pSkills = (v: any): string[] => {
            if (!v) return []
            const arr = Array.isArray(v) ? v : (typeof v === 'string' ? (() => { try { return JSON.parse(v) } catch { return [] } })() : [])
            return arr.map((s: any) => typeof s === 'string' ? s : s?.name || '').filter(Boolean)
          }
          for (const j of (allJobsForCo || []) as any[]) {
            coJobCount[j.company_id] = (coJobCount[j.company_id] || 0) + 1
            if (!coSkills[j.company_id]) coSkills[j.company_id] = []
            for (const s of pSkills(j.hard_skills)) { if (!coSkills[j.company_id].includes(s)) coSkills[j.company_id].push(s) }
            for (const s of pSkills(j.tools)) { if (!coSkills[j.company_id].includes(s)) coSkills[j.company_id].push(s) }
          }

          const userInd = (profile.industries || []).map((s: string) => s.toLowerCase())
          const userTitleStr = (profile.job_titles || []).join(' ').toLowerCase()

          for (const c of allCompanies) {
            const skills = coSkills[c.id] || []
            const skillsLower = skills.map(s => s.toLowerCase())
            const jc = coJobCount[c.id] || 0

            // Score: industry (0-30) + skills (0-50) + has jobs (0-15) + has desc (0-5)
            let score = 0
            let matched: string[] = []
            let missing: string[] = []

            // Industry match: +30
            if (c.industry && userInd.some((ui: string) => c.industry!.toLowerCase().includes(ui) || ui.includes(c.industry!.toLowerCase()))) {
              score += 30
            }

            // Skill overlap: up to 50
            for (const us of userSkills) {
              const found = skillsLower.find(cs => cs.includes(us) || us.includes(cs))
              if (found) { score += 5; matched.push(skills[skillsLower.indexOf(found)] || us) }
            }
            score = Math.min(score, 80) // Cap skills contribution

            // Has open jobs: +15
            if (jc > 0) score += 15

            // Has product description: +5
            if (c.product_description && c.product_description.length > 20) score += 5

            // Cap at 100
            score = Math.min(100, score)

            if (score >= 40) {
              const tier = score >= 80 ? 'strong' : score >= 60 ? 'good' : 'stretch'
              const reasoning = `${c.industry || 'Tech'} company${jc > 0 ? ' with ' + jc + ' open positions' : ''}. ${matched.length > 0 ? 'Matching skills: ' + matched.slice(0, 5).join(', ') + '.' : ''}`

              await db.from('user_company_matches').upsert({
                user_id, company_id: c.id, match_score: score, match_tier: tier,
                match_reasoning: reasoning, skills_matched: matched.slice(0, 10),
                skills_missing: missing.slice(0, 10), has_open_jobs: jc > 0,
                open_job_count: jc,
              }, { onConflict: 'user_id,company_id' })
              totalCompanyMatches++
            }
          }
        }
      } catch (e) { console.error('Company matching failed (non-fatal):', e) }

      const matchDuration = Math.round((Date.now() - startTime) / 1000)
      await db.from('user_resumes').update({
        processing_status: 'completed',
        match_duration_seconds: matchDuration,
      }).eq('user_id', user_id)

      return NextResponse.json({ status: 'completed', matches: totalMatches, company_matches: totalCompanyMatches, duration_seconds: matchDuration })
    }

    // === MATCH COMPANIES MODE ===
    // Matches user profile against all active companies (not just jobs)
    if (mode === 'match_companies') {
      const profile = resume.parsed_profile
      if (!profile) return NextResponse.json({ error: 'No parsed profile' }, { status: 400 })

      // Delete old company matches
      await db.from('user_company_matches').delete().eq('user_id', user_id)

      // Get all active companies
      const { data: companies } = await db
        .from('companies')
        .select('id, name, industry, product_description, funding_stage, employee_range, website')
        .eq('is_active', true)

      if (!companies?.length) {
        return NextResponse.json({ status: 'completed', company_matches: 0 })
      }

      // Get job counts + aggregated skills per company
      const { data: allJobs } = await db
        .from('jobs')
        .select('company_id, hard_skills, tools')
        .eq('is_active', true)

      const companyJobCounts: Record<string, number> = {}
      const companySkills: Record<string, Set<string>> = {}

      for (const j of (allJobs || []) as any[]) {
        const cid = j.company_id
        companyJobCounts[cid] = (companyJobCounts[cid] || 0) + 1
        if (!companySkills[cid]) companySkills[cid] = new Set()

        const parseSkillArr = (v: any): string[] => {
          if (!v) return []
          const arr = Array.isArray(v) ? v : (typeof v === 'string' ? (() => { try { return JSON.parse(v) } catch { return [] } })() : [])
          return arr.map((s: any) => typeof s === 'string' ? s : s?.name || '').filter(Boolean)
        }

        for (const s of parseSkillArr(j.hard_skills)) companySkills[cid].add(s)
        for (const s of parseSkillArr(j.tools)) companySkills[cid].add(s)
      }

      // Pre-filter: companies with skill overlap or matching industry
      const userSkills = (profile.skills || []).map((s: string) => s.toLowerCase())
      const userIndustries = (profile.industries || []).map((s: string) => s.toLowerCase())

      const scoredCompanies = companies.map(c => {
        let preScore = 0
        const skills = companySkills[c.id] ? [...companySkills[c.id]] : []
        const skillsLower = skills.map(s => s.toLowerCase())

        // Industry overlap
        if (c.industry && userIndustries.some((ui: string) => c.industry!.toLowerCase().includes(ui) || ui.includes(c.industry!.toLowerCase()))) {
          preScore += 10
        }

        // Skill overlap
        for (const us of userSkills) {
          if (skillsLower.some(cs => cs.includes(us) || us.includes(cs))) preScore++
        }

        // Has product description (more matchable)
        if (c.product_description && c.product_description.length > 20) preScore += 3

        return { company: c, preScore, skills, jobCount: companyJobCounts[c.id] || 0 }
      })

      scoredCompanies.sort((a, b) => b.preScore - a.preScore)
      const topCompanies = scoredCompanies.slice(0, 20) // Top 20 (keeps within Vercel timeout)

      const companiesForMatching: CompanyForMatching[] = topCompanies.map(({ company: c, skills, jobCount }) => ({
        id: c.id,
        name: c.name,
        industry: c.industry,
        product_description: c.product_description,
        funding_stage: c.funding_stage,
        employee_range: c.employee_range,
        aggregated_skills: skills,
        open_job_count: jobCount,
      }))

      // Match in batches of 10 (companies have more context than jobs)
      const COMPANY_BATCH = 10
      let totalCompanyMatches = 0

      for (let i = 0; i < companiesForMatching.length; i += COMPANY_BATCH) {
        const batch = companiesForMatching.slice(i, i + COMPANY_BATCH)
        try {
          const results = await matchCompaniesBatch(profile, batch)
          for (const match of results) {
            let score = match.match_score
            const companyInfo = topCompanies.find(tc => tc.company.id === match.company_id)
            const hasJobs = (companyInfo?.jobCount || 0) > 0

            // Boost for companies with open jobs
            if (hasJobs) score = Math.min(100, score + 15)

            const tier = score >= 80 ? 'strong' : score >= 60 ? 'good' : 'stretch'

            if (score >= 40) {
              await db.from('user_company_matches').upsert({
                user_id,
                company_id: match.company_id,
                match_score: score,
                match_tier: tier,
                match_reasoning: match.match_reasoning,
                skills_matched: match.skills_matched,
                skills_missing: match.skills_missing,
                has_open_jobs: hasJobs,
                open_job_count: companyInfo?.jobCount || 0,
              }, { onConflict: 'user_id,company_id' })
              totalCompanyMatches++
            }
          }
        } catch (batchError) {
          console.error('Company match batch failed:', batchError)
        }
      }

      return NextResponse.json({ status: 'completed', company_matches: totalCompanyMatches })
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
