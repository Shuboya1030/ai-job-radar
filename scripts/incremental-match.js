/**
 * Incremental Match Script
 * Matches only NEW jobs (added since last match run) against all existing user resumes.
 * Runs as a GitHub Action daily after the scraper.
 */

const { createClient } = require('@supabase/supabase-js')
const Anthropic = require('@anthropic-ai/sdk').default

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = 'claude-sonnet-4-20250514'
const BATCH_SIZE = 20

async function matchJobsBatch(profile, jobs) {
  const jobList = jobs.map((j, i) =>
    `[${i}] ID:${j.id} | ${j.title} at ${j.company_name} (${j.funding_stage || 'Unknown'}) | ${j.location || 'Unknown'} | ${(j.description || '').slice(0, 300)}`
  ).join('\n')

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `You are a job matching engine. Score how well this candidate matches each job.

CANDIDATE PROFILE:
- Skills: ${profile.skills.join(', ')}
- Titles: ${profile.job_titles.join(', ')}
- Experience: ${profile.experience_years || 'unknown'} years
- Seniority: ${profile.seniority}
- Industries: ${profile.industries.join(', ')}

JOBS TO MATCH:
${jobList}

For EACH job, return a JSON array. Only include jobs scoring >= 40. Return ONLY valid JSON array, no markdown.

[{"job_id":"uuid","match_score":85,"match_tier":"strong","match_reasoning":"reason","skills_matched":["Python"],"skills_missing":["K8s"]}]

Scoring: 80-100=strong, 60-79=good, 40-59=stretch, <40=exclude.
Return ONLY the JSON array.`
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
  try {
    return JSON.parse(text)
  } catch {
    console.error('Failed to parse:', text.slice(0, 200))
    return []
  }
}

async function main() {
  console.log('Starting incremental match...')

  // 1. Get all users with completed resumes
  const { data: resumes, error: resumeErr } = await supabase
    .from('user_resumes')
    .select('user_id, parsed_profile')
    .eq('processing_status', 'completed')
    .not('parsed_profile', 'is', null)

  if (resumeErr || !resumes?.length) {
    console.log('No resumes to match:', resumeErr?.message || '0 users')
    return
  }
  console.log(`Found ${resumes.length} users with resumes`)

  // 2. Find the most recent match refresh time
  const { data: latestMatch } = await supabase
    .from('user_job_matches')
    .select('refreshed_at')
    .order('refreshed_at', { ascending: false })
    .limit(1)

  const since = latestMatch?.[0]?.refreshed_at || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  console.log(`Looking for jobs added since: ${since}`)

  // 3. Get new active jobs since last match
  const { data: newJobs } = await supabase
    .from('jobs')
    .select('id, title, description, location, role_category, companies(name, funding_stage)')
    .eq('is_active', true)
    .gt('created_at', since)

  if (!newJobs?.length) {
    console.log('No new jobs found. Done.')
    return
  }
  console.log(`Found ${newJobs.length} new jobs to match`)

  const jobsForMatching = newJobs.map(j => ({
    id: j.id,
    title: j.title,
    description: j.description,
    company_name: j.companies?.name || 'Unknown',
    funding_stage: j.companies?.funding_stage || null,
    location: j.location,
    role_category: j.role_category,
  }))

  // 4. For each user, match against new jobs
  let totalNewMatches = 0
  for (const resume of resumes) {
    const profile = resume.parsed_profile
    if (!profile?.skills?.length) continue

    console.log(`Matching user ${resume.user_id.slice(0, 8)}... against ${jobsForMatching.length} jobs`)

    for (let i = 0; i < jobsForMatching.length; i += BATCH_SIZE) {
      const batch = jobsForMatching.slice(i, i + BATCH_SIZE)
      try {
        const results = await matchJobsBatch(profile, batch)
        for (const match of results) {
          if (match.match_score >= 40) {
            await supabase.from('user_job_matches').upsert({
              user_id: resume.user_id,
              job_id: match.job_id,
              match_score: match.match_score,
              match_tier: match.match_tier,
              match_reasoning: match.match_reasoning,
              skills_matched: match.skills_matched,
              skills_missing: match.skills_missing,
              refreshed_at: new Date().toISOString(),
            }, { onConflict: 'user_id,job_id' })
            totalNewMatches++
          }
        }
      } catch (err) {
        console.error(`Batch failed for user ${resume.user_id.slice(0, 8)}:`, err.message)
      }
    }
  }

  console.log(`Done! ${totalNewMatches} new matches created across ${resumes.length} users.`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
