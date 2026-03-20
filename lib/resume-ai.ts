import OpenAI from 'openai'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const MODEL = 'gpt-4o'

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
  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You parse resumes into structured JSON. Return ONLY valid JSON.' },
      { role: 'user', content: `Parse this resume and extract structured data.

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
- skills: ONLY extract skills that are EXPLICITLY mentioned in the resume text. Do NOT infer, guess, or add skills that are not literally written. If the resume says "Power BI" do not add "Tableau" unless "Tableau" is also written.
- skills: technical skills only (languages, frameworks, tools, methods)
- seniority: one of "junior", "mid", "senior", "lead", "executive"
- experience_years: total years of professional experience (null if unclear)
- Be precise: every skill in your output must have a corresponding word or phrase in the resume text` }
    ],
  })

  const text = response.choices[0]?.message?.content || '{}'
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

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 4000,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You are a job matching engine. Return ONLY valid JSON. Always wrap results in {"matches": [...]}.' },
      { role: 'user', content: `Score how well this candidate matches each job using a weighted rubric.

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
Return JSON: {"matches": [{"job_id":"uuid","match_score":85,"match_tier":"strong","match_reasoning":"reason","skills_matched":["Python"],"skills_missing":["K8s"],"dimension_scores":{"domain":25,"skills":22,"experience":20,"role_type":12}}]}

Only include jobs scoring >= 40.` }
    ],
  })

  const text = response.choices[0]?.message?.content || '{"matches":[]}'
  try {
    const parsed = JSON.parse(text)
    // Handle both {"matches": [...]} and direct array
    const results = Array.isArray(parsed) ? parsed : (parsed.matches || [])
    return results as MatchResult[]
  } catch {
    console.error('Failed to parse match results:', text.slice(0, 200))
    return []
  }
}
