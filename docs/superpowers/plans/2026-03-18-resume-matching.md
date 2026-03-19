# Resume Upload & AI Job Matching — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users upload a resume (PDF/DOCX/MD), get AI-matched job recommendations with scored tiers, and see personalized skills gap analysis.

**Architecture:** Next.js API routes handle upload + file validation. A separate `/api/resume/process` route runs the Claude AI pipeline asynchronously (resume parsing → job matching). Frontend polls for status and renders results on a new `/dashboard` page, with match badges integrated into existing job board, job detail, and market analysis pages.

**Tech Stack:** Next.js 14, Supabase (auth + DB + Storage), Claude API (`@anthropic-ai/sdk`), pdf-parse, mammoth.js, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-18-resume-matching-design.md`

**Note:** This project has no test framework. Verification steps use manual checks (curl, browser, Supabase dashboard) instead of automated tests. Adding a test framework is out of scope.

---

## File Structure

### New Files
```
database/migration_resume_matching.sql          — DDL for 3 new tables + RLS + storage
lib/resume-parser.ts                            — Text extraction from PDF/DOCX/MD
lib/resume-ai.ts                                — Claude API calls (parse profile + match jobs)
app/api/resume/upload/route.ts                  — POST: validate, store file, create DB row
app/api/resume/process/route.ts                 — POST: async pipeline (parse + match)
app/api/resume/status/route.ts                  — GET: poll processing status
app/api/resume/profile/route.ts                 — GET/PUT: parsed profile
app/api/resume/matches/route.ts                 — GET: ranked job matches
app/api/resume/skills-gap/route.ts              — GET: aggregated skills gap
app/api/preferences/route.ts                    — PUT: user preferences
app/dashboard/page.tsx                          — Dashboard page (profile + matches + gap)
components/resume-upload.tsx                     — Upload dropzone component
components/match-badge.tsx                       — Strong/Good/Stretch badge component
components/match-card.tsx                        — Job card with match reasoning
components/skills-gap-panel.tsx                  — Skills gap visualization
components/resume-cta.tsx                        — CTA banner for pages without resume
```

### Modified Files
```
package.json                                    — Add @anthropic-ai/sdk, pdf-parse, mammoth
.env.example                                    — Add ANTHROPIC_API_KEY
components/nav.tsx                              — Add Dashboard link when user has resume
app/page.tsx                                    — Add upload CTA to hero section
app/jobs/page.tsx                               — Add "My Matches" tab + match badges
app/jobs/[id]/page.tsx                          — Add match panel for authenticated users
app/market/[role]/page.tsx                      — Add personalized skills gap panel
app/api/auth/callback/route.ts                  — Support ?next= redirect to /dashboard
```

---

## Chunk 1: Database & Dependencies

### Task 1: Database Migration

**Files:**
- Create: `database/migration_resume_matching.sql`

- [ ] **Step 1: Write the migration SQL**

Create `database/migration_resume_matching.sql`:

```sql
-- Resume Matching Feature Migration
-- Prerequisite: user_profiles table must exist (from user-subscription migration)

-- 1. User Resumes
CREATE TABLE IF NOT EXISTS user_resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx', 'md')),
    file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 5242880),
    raw_text TEXT,
    parsed_profile JSONB,
    processing_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (processing_status IN ('pending', 'parsing', 'matching', 'completed', 'failed')),
    error_message TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

ALTER TABLE user_resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own resume" ON user_resumes
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own resume" ON user_resumes
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own resume" ON user_resumes
    FOR UPDATE USING (auth.uid() = user_id);

-- 2. Job Match Results
CREATE TABLE IF NOT EXISTS user_job_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    match_score INTEGER NOT NULL CHECK (match_score BETWEEN 0 AND 100),
    match_tier TEXT NOT NULL CHECK (match_tier IN ('strong', 'good', 'stretch')),
    match_reasoning TEXT NOT NULL,
    skills_matched JSONB DEFAULT '[]',
    skills_missing JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now(),
    refreshed_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, job_id)
);

ALTER TABLE user_job_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own matches" ON user_job_matches
    FOR SELECT USING (auth.uid() = user_id);
-- Insert/update/delete only via service role (backend pipeline)

-- 3. User Preferences
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
    work_type_preference TEXT CHECK (work_type_preference IN ('remote', 'hybrid', 'onsite', 'any')),
    salary_min INTEGER,
    salary_max INTEGER,
    company_size_preference TEXT CHECK (company_size_preference IN ('startup', 'growth', 'bigtech', 'any')),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max)
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own preferences" ON user_preferences
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users upsert own preferences" ON user_preferences
    FOR ALL USING (auth.uid() = user_id);

-- 4. Indexes for performance
CREATE INDEX idx_user_job_matches_user ON user_job_matches(user_id);
CREATE INDEX idx_user_job_matches_score ON user_job_matches(user_id, match_score DESC);
CREATE INDEX idx_user_resumes_status ON user_resumes(processing_status) WHERE processing_status != 'completed';
```

- [ ] **Step 2: Run migration in Supabase**

Go to Supabase Dashboard → SQL Editor → paste and run the migration.
Verify: all 3 tables appear in Table Editor with RLS enabled.

- [ ] **Step 3: Create Storage bucket**

In Supabase Dashboard → Storage → New Bucket:
- Name: `resumes`
- Public: OFF (private)
- File size limit: 5MB
- Allowed MIME types: `application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, text/markdown, text/plain`

Add storage policy via SQL Editor:
```sql
CREATE POLICY "Users upload own resumes" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'resumes'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users read own resumes" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'resumes'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "Users delete own resumes" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'resumes'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );
```

- [ ] **Step 4: Commit**

```bash
git add database/migration_resume_matching.sql
git commit -m "feat: add resume matching database migration (tables + RLS + storage)"
```

### Task 2: Install Dependencies

**Files:**
- Modify: `package.json`
- Modify: `.env.example`

- [ ] **Step 1: Install npm packages**

```bash
cd /c/Users/shuyazong/repos/job-market-dashboard
npm install @anthropic-ai/sdk pdf-parse mammoth
npm install -D @types/pdf-parse
```

- [ ] **Step 2: Add ANTHROPIC_API_KEY to .env.example**

Add to `.env.example`:
```
# AI Matching
ANTHROPIC_API_KEY=sk-ant-your-key
```

Add the actual key to `.env.local` (not committed).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "feat: add anthropic SDK, pdf-parse, mammoth dependencies"
```

---

## Chunk 2: Resume Processing Core

### Task 3: Text Extraction Library

**Files:**
- Create: `lib/resume-parser.ts`

- [ ] **Step 1: Create the resume parser module**

Create `lib/resume-parser.ts`:

```typescript
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'

const MAX_TEXT_LENGTH = 50_000 // Truncate to prevent runaway API costs

export type FileType = 'pdf' | 'docx' | 'md'

export function detectFileType(fileName: string): FileType | null {
  const ext = fileName.toLowerCase().split('.').pop()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (ext === 'md' || ext === 'markdown') return 'md'
  return null
}

export async function extractText(buffer: Buffer, fileType: FileType): Promise<string> {
  let text: string

  switch (fileType) {
    case 'pdf': {
      const result = await pdfParse(buffer)
      text = result.text
      break
    }
    case 'docx': {
      const result = await mammoth.extractRawText({ buffer })
      text = result.value
      break
    }
    case 'md': {
      text = buffer.toString('utf-8')
      break
    }
    default:
      throw new Error(`Unsupported file type: ${fileType}`)
  }

  if (!text || text.trim().length === 0) {
    throw new Error('Could not extract any text from the file')
  }

  // Truncate to prevent excessive API costs
  return text.slice(0, MAX_TEXT_LENGTH)
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit lib/resume-parser.ts
```

- [ ] **Step 3: Commit**

```bash
git add lib/resume-parser.ts
git commit -m "feat: add resume text extraction (PDF/DOCX/MD)"
```

### Task 4: Claude AI Integration

**Files:**
- Create: `lib/resume-ai.ts`

- [ ] **Step 1: Create the AI module**

Create `lib/resume-ai.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'

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
}

export async function matchJobsBatch(
  profile: ParsedProfile,
  jobs: JobForMatching[]
): Promise<MatchResult[]> {
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

[{
  "job_id": "the-uuid",
  "match_score": 85,
  "match_tier": "strong",
  "match_reasoning": "One sentence explaining why this matches or doesn't",
  "skills_matched": ["Python", "PyTorch"],
  "skills_missing": ["Kubernetes"]
}]

Scoring guide:
- 80-100 (strong): Candidate meets 80%+ of requirements, experience level aligns
- 60-79 (good): Candidate meets 60-79%, minor gaps but viable
- 40-59 (stretch): Candidate meets some requirements, significant upskilling needed
- Below 40: Don't include

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
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit lib/resume-ai.ts
```

- [ ] **Step 3: Commit**

```bash
git add lib/resume-ai.ts
git commit -m "feat: add Claude AI resume parsing and job matching"
```

---

## Chunk 3: API Routes

### Task 5: Upload Route

**Files:**
- Create: `app/api/resume/upload/route.ts`

- [ ] **Step 1: Create the upload route**

Create `app/api/resume/upload/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { detectFileType } from '@/lib/resume-parser'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

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
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit app/api/resume/upload/route.ts
```

- [ ] **Step 3: Commit**

```bash
git add app/api/resume/upload/route.ts
git commit -m "feat: add resume upload API route with validation"
```

### Task 6: Processing Route (Async Pipeline)

**Files:**
- Create: `app/api/resume/process/route.ts`

- [ ] **Step 1: Create the processing route**

Create `app/api/resume/process/route.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add app/api/resume/process/route.ts
git commit -m "feat: add async resume processing pipeline (parse + match)"
```

### Task 7: Status, Profile, Matches, Skills Gap, and Preferences Routes

**Files:**
- Create: `app/api/resume/status/route.ts`
- Create: `app/api/resume/profile/route.ts`
- Create: `app/api/resume/matches/route.ts`
- Create: `app/api/resume/skills-gap/route.ts`
- Create: `app/api/preferences/route.ts`

- [ ] **Step 1: Create status route**

Create `app/api/resume/status/route.ts`:

```typescript
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
```

- [ ] **Step 2: Create profile route**

Create `app/api/resume/profile/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createSupabaseServerClient } from '@/lib/supabase-server'

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

  const db = createSupabaseServerClient()
  const { data } = await db
    .from('user_resumes')
    .select('parsed_profile, file_name, uploaded_at')
    .eq('user_id', user.id)
    .single()

  if (!data) return NextResponse.json({ error: 'No resume uploaded' }, { status: 404 })

  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const updates = await req.json()
  const db = createSupabaseServerClient()

  const { error } = await db
    .from('user_resumes')
    .update({ parsed_profile: updates, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Create matches route**

Create `app/api/resume/matches/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createSupabaseServerClient } from '@/lib/supabase-server'

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

  const db = createSupabaseServerClient()
  const { data, error } = await db
    .from('user_job_matches')
    .select(`
      match_score, match_tier, match_reasoning, skills_matched, skills_missing,
      jobs(id, title, location, role_category, salary_annual_min, salary_annual_max, apply_url,
        companies(name, funding_stage, funding_amount_cents, website))
    `)
    .eq('user_id', user.id)
    .order('match_score', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ matches: data || [] })
}
```

- [ ] **Step 4: Create skills gap route**

Create `app/api/resume/skills-gap/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createSupabaseServerClient } from '@/lib/supabase-server'

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

  const db = createSupabaseServerClient()

  // Get user profile
  const { data: resume } = await db
    .from('user_resumes')
    .select('parsed_profile')
    .eq('user_id', user.id)
    .single()

  if (!resume?.parsed_profile) {
    return NextResponse.json({ error: 'No parsed profile' }, { status: 404 })
  }

  // Get all matches
  const { data: matches } = await db
    .from('user_job_matches')
    .select('skills_matched, skills_missing, match_tier')
    .eq('user_id', user.id)

  if (!matches || matches.length === 0) {
    return NextResponse.json({ user_skills: resume.parsed_profile.skills, gaps: [], strengths: [] })
  }

  // Aggregate skills across all matches
  const skillMatchCount: Record<string, number> = {}
  const skillMissCount: Record<string, number> = {}
  const totalJobs = matches.length

  for (const m of matches) {
    for (const s of (m.skills_matched as string[])) {
      skillMatchCount[s] = (skillMatchCount[s] || 0) + 1
    }
    for (const s of (m.skills_missing as string[])) {
      skillMissCount[s] = (skillMissCount[s] || 0) + 1
    }
  }

  const strengths = Object.entries(skillMatchCount)
    .map(([skill, count]) => ({ skill, demand_pct: Math.round((count / totalJobs) * 100) }))
    .sort((a, b) => b.demand_pct - a.demand_pct)

  const gaps = Object.entries(skillMissCount)
    .map(([skill, count]) => ({ skill, demand_pct: Math.round((count / totalJobs) * 100) }))
    .sort((a, b) => b.demand_pct - a.demand_pct)

  return NextResponse.json({
    user_skills: resume.parsed_profile.skills,
    strengths,
    gaps,
    total_matches: totalJobs,
  })
}
```

- [ ] **Step 5: Create preferences route**

Create `app/api/preferences/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createSupabaseServerClient } from '@/lib/supabase-server'

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

  const db = createSupabaseServerClient()
  const { data } = await db
    .from('user_preferences')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json(data || {})
}

export async function PUT(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const db = createSupabaseServerClient()

  const { error } = await db
    .from('user_preferences')
    .upsert({
      user_id: user.id,
      work_type_preference: body.work_type_preference || 'any',
      salary_min: body.salary_min || null,
      salary_max: body.salary_max || null,
      company_size_preference: body.company_size_preference || 'any',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 6: Commit all routes**

```bash
git add app/api/resume/ app/api/preferences/
git commit -m "feat: add resume status, profile, matches, skills-gap, and preferences routes"
```

---

## Chunk 4: Frontend — Dashboard Page & Components

### Task 8: Shared Components

**Files:**
- Create: `components/match-badge.tsx`
- Create: `components/resume-upload.tsx`
- Create: `components/resume-cta.tsx`

- [ ] **Step 1: Create match badge component**

Create `components/match-badge.tsx`:

```typescript
'use client'

interface MatchBadgeProps {
  tier: 'strong' | 'good' | 'stretch'
  score?: number
  size?: 'sm' | 'md'
}

const tierConfig = {
  strong: { label: 'Strong Match', bg: 'bg-lime/20', text: 'text-lime', border: 'border-lime/30' },
  good: { label: 'Good Match', bg: 'bg-yellow-400/20', text: 'text-yellow-400', border: 'border-yellow-400/30' },
  stretch: { label: 'Stretch', bg: 'bg-orange-400/20', text: 'text-orange-400', border: 'border-orange-400/30' },
}

export default function MatchBadge({ tier, score, size = 'sm' }: MatchBadgeProps) {
  const config = tierConfig[tier]
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1'

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border ${config.bg} ${config.text} ${config.border} ${sizeClass} font-mono`}>
      {config.label}
      {score !== undefined && <span className="opacity-70">({score})</span>}
    </span>
  )
}
```

- [ ] **Step 2: Create resume upload component**

Create `components/resume-upload.tsx`:

```typescript
'use client'

import { useState, useCallback } from 'react'
import { Upload, FileText, Loader2 } from 'lucide-react'
import { useAuth } from './auth-provider'

interface ResumeUploadProps {
  onUploadComplete?: () => void
}

export default function ResumeUpload({ onUploadComplete }: ResumeUploadProps) {
  const { user, signInWithGoogle } = useAuth()
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(async (file: File) => {
    if (!user) {
      signInWithGoogle()
      return
    }

    setError(null)
    setUploading(true)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/resume/upload', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Upload failed')
        return
      }

      onUploadComplete?.()
    } catch (err) {
      setError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }, [user, signInWithGoogle, onUploadComplete])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
        ${dragging ? 'border-lime bg-lime/5' : 'border-faint hover:border-lime/50'}
        ${uploading ? 'pointer-events-none opacity-60' : ''}`}
    >
      <input
        type="file"
        accept=".pdf,.docx,.md,.markdown"
        onChange={handleChange}
        className="absolute inset-0 opacity-0 cursor-pointer"
        disabled={uploading}
      />
      {uploading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 text-lime animate-spin" />
          <p className="text-secondary">Uploading...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload className="w-8 h-8 text-tertiary" />
          <p className="text-primary font-medium">Drop your resume here or click to browse</p>
          <p className="text-tertiary text-sm">PDF, DOCX, or Markdown (max 5MB)</p>
        </div>
      )}
      {error && <p className="mt-2 text-red-400 text-sm">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Create resume CTA banner**

Create `components/resume-cta.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import Link from 'next/link'

export default function ResumeCTA() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="relative bg-surface-raised border border-lime/20 rounded-lg px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Sparkles className="w-5 h-5 text-lime flex-shrink-0" />
        <p className="text-sm text-secondary">
          <span className="text-primary font-medium">Get personalized job matches</span>
          {' '}— upload your resume and we'll find the best roles for you
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard"
          className="bg-lime text-black px-3 py-1.5 rounded text-sm font-medium hover:bg-lime/90 transition-colors"
        >
          Upload Resume
        </Link>
        <button onClick={() => setDismissed(true)} className="text-tertiary hover:text-secondary p-1">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit components**

```bash
git add components/match-badge.tsx components/resume-upload.tsx components/resume-cta.tsx
git commit -m "feat: add match badge, resume upload, and CTA components"
```

### Task 9: Dashboard Page

**Files:**
- Create: `app/dashboard/page.tsx`

- [ ] **Step 1: Create the dashboard page**

Create `app/dashboard/page.tsx`. This is the main page users see after uploading. It shows:
- Processing status (polling while processing)
- Profile summary (editable)
- Match list with tier badges and reasoning
- Skills gap panel
- Resume re-upload button

The page should:
- Redirect to sign-in if user is not authenticated
- Show the upload dropzone if no resume exists
- Poll `/api/resume/status` every 2 seconds while `processing_status` is not `completed`/`failed`
- Fetch `/api/resume/matches` and `/api/resume/skills-gap` once processing completes
- Use the same card-based design as `/saved` and `/settings` pages

This is a large page component. Use `frontend-design` skill during implementation for the actual visual design. The key sections are:

```
Dashboard Layout:
├── Header: "Your Dashboard" + resume status
├── If no resume: <ResumeUpload /> component
├── If processing: progress indicator with status text
├── If completed:
│   ├── Profile Card (skills, experience, seniority — editable)
│   ├── Preferences Card (work type, salary, company size — optional)
│   ├── Match List (sorted by score, with MatchBadge + reasoning)
│   └── Skills Gap Panel (strengths + gaps with % demand bars)
└── Re-upload button in footer
```

- [ ] **Step 2: Verify page renders**

```bash
npm run dev
```

Navigate to `http://localhost:3000/dashboard`. Should see sign-in prompt or upload dropzone.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: add dashboard page with resume upload, matches, and skills gap"
```

### Task 10: Update Nav with Dashboard Link

**Files:**
- Modify: `components/nav.tsx`

- [ ] **Step 1: Add Dashboard link to navigation**

In `components/nav.tsx`, add a "Dashboard" link in the authenticated user dropdown menu (next to "Saved Jobs" and "Job Alerts"). The link should go to `/dashboard`.

Also: if user has a resume (check via a lightweight client-side flag or just always show "Dashboard" for logged-in users), highlight it as a primary nav item.

- [ ] **Step 2: Commit**

```bash
git add components/nav.tsx
git commit -m "feat: add Dashboard link to navigation for authenticated users"
```

---

## Chunk 5: Frontend — Integration with Existing Pages

### Task 11: Landing Page Upload CTA

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add upload CTA to hero section**

In `app/page.tsx`, modify the hero section to include a dual-CTA:
- Primary: "Upload Resume" button (lime accent, links to `/dashboard`)
- Secondary: "Browse Jobs" button (outline style, links to `/jobs`)
- Subtitle: "Drop your resume and we'll match you with 600+ AI roles at funded startups in seconds"

Add a "How it works" 3-step section below the hero:
1. Upload your resume (PDF/DOCX/MD)
2. AI matches you to the best roles with reasoning
3. See your skills gaps and how to improve

Use `frontend-design` skill for the actual visual implementation.

- [ ] **Step 2: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add resume upload CTA to landing page hero"
```

### Task 12: Job Board — Match Tab & Badges

**Files:**
- Modify: `app/jobs/page.tsx`

- [ ] **Step 1: Add ResumeCTA banner and match badges**

In `app/jobs/page.tsx`:

1. Import `ResumeCTA` and `MatchBadge` components
2. For unauthenticated users or users without resume: show `<ResumeCTA />` at the top of the job list
3. For users with matches: add a tab toggle `[All Jobs] [My Matches]` above the job list
   - "My Matches" tab filters to only matched jobs, sorted by score
4. On each job card: if user has a match for that job, show `<MatchBadge tier={tier} />` in the top-right corner

This requires fetching `/api/resume/matches` client-side when user is authenticated. Use the existing auth context pattern from `save-button.tsx`.

- [ ] **Step 2: Commit**

```bash
git add app/jobs/page.tsx
git commit -m "feat: add My Matches tab and match badges to job board"
```

### Task 13: Job Detail — Match Panel

**Files:**
- Modify: `app/jobs/[id]/page.tsx`

- [ ] **Step 1: Add personalized match panel**

In `app/jobs/[id]/page.tsx`:

For authenticated users with a resume, fetch that specific job's match data from the user's matches. If a match exists, display a panel below the job description:

```
Your Match: [MatchBadge] (score/100)
Matched: skill1, skill2, skill3
Missing: skill4, skill5
"AI reasoning text about why this matches"
```

If no match exists for this job, show nothing (don't show a "no match" message — that's discouraging).

- [ ] **Step 2: Commit**

```bash
git add app/jobs/[id]/page.tsx
git commit -m "feat: add personalized match panel to job detail page"
```

### Task 14: Market Analysis — Skills Gap Panel

**Files:**
- Modify: `app/market/[role]/page.tsx`

- [ ] **Step 1: Add personalized skills gap panel**

In `app/market/[role]/page.tsx`:

For authenticated users with a resume, fetch `/api/resume/skills-gap` and display a "Your Profile vs. Market Demand" panel:

- Skills you have that are in demand (with % bar)
- Skills gap to close (with % bar)
- Link: "See matching jobs for this role →" (goes to `/jobs?tab=matches`)

If user has no resume, show the `<ResumeCTA />` component instead.

- [ ] **Step 2: Commit**

```bash
git add app/market/[role]/page.tsx
git commit -m "feat: add personalized skills gap panel to market analysis"
```

### Task 15: Auth Callback — Support ?next= Redirect

**Files:**
- Modify: `app/api/auth/callback/route.ts`

- [ ] **Step 1: Update callback to support next param**

In `app/api/auth/callback/route.ts`, after exchanging the code for session, check for a `next` query parameter in the URL and redirect there instead of `/`. This allows the upload flow to redirect users back to `/dashboard` after sign-in.

```typescript
const next = requestUrl.searchParams.get('next') || '/'
return NextResponse.redirect(new URL(next, requestUrl.origin))
```

- [ ] **Step 2: Commit**

```bash
git add app/api/auth/callback/route.ts
git commit -m "feat: support ?next= redirect param in OAuth callback"
```

---

## Chunk 6: Incremental Matching & Final Polish

### Task 16: Daily Incremental Match GitHub Action

**Files:**
- Create: `.github/workflows/daily-match.yml`

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/daily-match.yml`:

```yaml
name: Daily Incremental Job Match
on:
  schedule:
    - cron: '0 8 * * *'  # Daily at 8am UTC (after daily-scrape at 7am)
  workflow_dispatch:

jobs:
  match:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - name: Run incremental matching
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: node scripts/incremental-match.js
```

- [ ] **Step 2: Create the incremental match script**

Create `scripts/incremental-match.js`:

This script:
1. Queries all users with `processing_status = 'completed'` in `user_resumes`
2. Queries jobs added since the most recent `refreshed_at` across all matches
3. For each user: runs `matchJobsBatch` against only the new jobs
4. Inserts new matches into `user_job_matches`

Keep it simple — reuse the logic from `lib/resume-ai.ts` (import as ESM or rewrite as standalone Node script).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/daily-match.yml scripts/incremental-match.js
git commit -m "feat: add daily incremental job matching GitHub Action"
```

### Task 17: Environment Variables & Final Verification

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Verify all env vars are documented**

Ensure `.env.example` includes:
```
ANTHROPIC_API_KEY=sk-ant-your-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 2: Add ANTHROPIC_API_KEY to Vercel and GitHub Secrets**

- Vercel Dashboard → Settings → Environment Variables → Add `ANTHROPIC_API_KEY`
- GitHub Repo → Settings → Secrets → Add `ANTHROPIC_API_KEY`

- [ ] **Step 3: Full integration test**

1. `npm run dev`
2. Navigate to `/dashboard` → should redirect to sign-in
3. Sign in with Google → should return to `/dashboard`
4. Upload a test resume (PDF) → should see "processing" status
5. Wait 30-60 seconds → should see matched jobs with badges
6. Navigate to `/jobs` → should see "My Matches" tab
7. Click a matched job → should see match panel on detail page
8. Navigate to `/market/ai-engineer` → should see skills gap panel

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat: finalize resume matching feature configuration"
```

---

## Task Dependency Graph

```
Task 1 (DB Migration)
  ↓
Task 2 (Dependencies)
  ↓
Task 3 (Text Extraction) ──→ Task 4 (Claude AI)
                                ↓
Task 5 (Upload Route) ──→ Task 6 (Process Route)
                                ↓
Task 7 (Status/Profile/Matches/Gap/Prefs Routes)
  ↓
Task 8 (Components) ──→ Task 9 (Dashboard Page)
  ↓                          ↓
Task 10 (Nav Update)    Task 11-14 (Page Integrations)
                              ↓
Task 15 (Auth Callback) ──→ Task 16 (Daily Match)
                              ↓
                        Task 17 (Final Verification)
```

**Parallelizable:** Tasks 3+4 can run in parallel. Tasks 11-14 can run in parallel. Task 15 is independent.

**Critical path:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 9 → 17
