import Anthropic from '@anthropic-ai/sdk'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const MODEL = 'claude-sonnet-4-20250514'

// --- Resume Parsing ---

export interface ParsedProfile {
  skills: string[]
  job_titles: string[]
  experience_years: number | null
  seniority: 'junior' | 'mid' | 'senior' | 'lead' | 'executive'
  education: string[]
  location: string | null
  industries: string[]
  summary: string
}

export async function parseResume(rawText: string): Promise<ParsedProfile> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `Parse this resume and extract structured data. Return ONLY valid JSON, no markdown.

Resume text:
---
${rawText}
---

Return JSON with this exact schema:
{
  "skills": ["Python", "PyTorch", ...],
  "job_titles": ["Senior ML Engineer", ...],
  "experience_years": 5,
  "seniority": "senior",
  "education": ["MS Computer Science, Stanford"],
  "location": "San Francisco, CA",
  "industries": ["AI/ML", "Healthcare"],
  "summary": "One sentence summary of the candidate's profile"
}

Rules:
- skills: technical skills only (languages, frameworks, tools, methods)
- seniority: one of "junior", "mid", "senior", "lead", "executive"
- experience_years: total years of professional experience (null if unclear)
- Return ONLY the JSON object, nothing else`
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(text) as ParsedProfile
}

// --- Job Matching ---

export interface JobForMatching {
  id: string
  title: string
  description: string | null
  company_name: string
  funding_stage: string | null
  location: string | null
  role_category: string | null
}

export interface MatchResult {
  job_id: string
  match_score: number
  match_tier: 'strong' | 'good' | 'stretch'
  match_reasoning: string
  skills_matched: string[]
  skills_missing: string[]
  dimension_scores?: { domain: number; skills: number; experience: number; role_type: number }
}

// Fetch admin-reviewed examples for few-shot calibration
async function getCalibrationExamples(): Promise<string> {
  try {
    const db = createSupabaseServerClient()
    const { data: reviews } = await db
      .from('match_reviews')
      .select(`
        verdict, notes,
        user_job_matches(match_score, match_tier, match_reasoning,
          user_resumes(parsed_profile),
          jobs(title, companies(name)))
      `)
      .in('verdict', ['good', 'bad'])
      .order('reviewed_at', { ascending: false })
      .limit(20)

    if (!reviews?.length) return ''

    const examples = reviews.map((r: any) => {
      const m = r.user_job_matches
      const profile = m?.user_resumes?.parsed_profile
      const job = m?.jobs
      const label = r.verdict === 'good' ? 'GOOD MATCH (score should be 80+)' : 'BAD MATCH (score should be below 40)'
      return `${label}:
Resume: ${profile?.job_titles?.[0] || 'Unknown'}, ${profile?.seniority}, skills: ${profile?.skills?.slice(0, 5).join(', ')}
Job: ${job?.title} at ${job?.companies?.name}
AI score: ${m?.match_score} (${m?.match_tier})
Reviewer note: "${r.notes || 'No notes'}"`
    }).join('\n\n')

    return `\n\nHere are human-reviewed examples to calibrate your scoring:\n${examples}\n`
  } catch {
    return ''
  }
}

export async function matchJobsBatch(
  profile: ParsedProfile,
  jobs: JobForMatching[]
): Promise<MatchResult[]> {
  const jobList = jobs.map((j, i) =>
    `[${i}] ID:${j.id} | ${j.title} at ${j.company_name} (${j.funding_stage || 'Unknown'}) | ${j.location || 'Unknown'} | ${(j.description || '').slice(0, 300)}`
  ).join('\n')

  const calibration = await getCalibrationExamples()

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `You are a job matching engine. Score how well this candidate matches each job using a weighted rubric.

CANDIDATE PROFILE:
- Skills: ${profile.skills.join(', ')}
- Titles: ${profile.job_titles.join(', ')}
- Experience: ${profile.experience_years || 'unknown'} years
- Seniority: ${profile.seniority}
- Industries: ${profile.industries.join(', ')}

JOBS TO MATCH:
${jobList}

SCORING RUBRIC — Score each candidate-job pair across 4 weighted dimensions:
- Domain relevance (0-30 pts): How well does the candidate's industry/domain background match?
- Skills overlap (0-30 pts): What % of required hard skills does the candidate have?
- Experience level fit (0-25 pts): Does seniority + years of experience align?
- Role type fit (0-15 pts): Engineering vs research vs PM alignment?

Total = sum of 4 dimensions (0-100).
- 80-100 = strong match
- 60-79 = good match
- 40-59 = stretch
- Below 40 = exclude
${calibration}
For EACH job scoring >= 40, return a JSON array. Return ONLY valid JSON array, no markdown.

[{
  "job_id": "the-uuid",
  "match_score": 85,
  "match_tier": "strong",
  "match_reasoning": "One sentence explaining match quality referencing which dimensions scored high/low",
  "skills_matched": ["Python", "PyTorch"],
  "skills_missing": ["Kubernetes"],
  "dimension_scores": {"domain": 25, "skills": 22, "experience": 20, "role_type": 12}
}]

Return ONLY the JSON array.`
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
  try {
    return JSON.parse(text) as MatchResult[]
  } catch {
    console.error('Failed to parse match results:', text.slice(0, 200))
    return []
  }
}
