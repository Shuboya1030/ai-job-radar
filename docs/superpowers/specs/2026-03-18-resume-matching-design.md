# Resume Upload & AI Job Matching — Design Spec

**Date**: 2026-03-18
**Status**: Draft
**Author**: Claude + Shuya

## Problem

AIJobRadar is a job board — users browse and filter. There is no personalization. Job seekers must manually scan 600+ listings to find relevant roles. The platform also lacks a candidate pool, which is the core asset needed for future employer monetization (Wellfound/Otta model).

## Solution

Let users upload their resume (PDF/DOCX/MD). AI parses it, matches them against all active jobs with scored reasoning, and shows personalized skills gap analysis against market demand. This turns AIJobRadar from a job board into a career intelligence platform.

## Prerequisites

- **User system migration must be applied first.** The `user_profiles` table (from `2026-03-18-user-subscription-design.md`) must exist before creating the tables below. All three new tables reference `user_profiles(id)` as a foreign key.

## Success Criteria

- Users can upload a resume and see a processing status immediately; matched jobs appear within 30-60 seconds
- Match results are persisted to the user's account and refresh as new jobs are added
- Skills gap analysis helps users understand what to learn for their target roles
- Resume data becomes the foundation for future employer-side monetization

## User Flow

### First-time Upload

1. User sees "Upload Resume" CTA on landing page or job board
2. Clicks → prompted to sign in with Google (if not already)
3. After sign-in → drag & drop or file picker (PDF/DOCX/MD, max 5MB)
4. Redirect to `/dashboard` with progress indicator: "Analyzing your resume..." → "Matching against jobs..." → "Done!"
   - Processing runs asynchronously (see Pipeline section); frontend polls for completion
5. Dashboard loads with three sections once processing completes:
   - **Profile Summary** — AI-extracted skills, experience, seniority (editable if wrong)
   - **Top Job Matches** — ranked list with Strong/Good/Stretch badges + match reasoning
   - **Skills Gap Analysis** — missing skills compared to matched roles + suggestions

### Post-Upload Preferences (Optional)

After viewing initial results, a dismissible card asks 3 questions:
- Work type preference: Remote / Hybrid / On-site / Any
- Target salary range (slider)
- Company size: Startup / Growth / Big Tech / Any

These refine future match scoring but are not required.

### Returning User

- `/dashboard` shows persisted matches, refreshed as new jobs arrive
- Can re-upload resume anytime to update profile
- Matches older than 30 days marked as stale with prompt to refresh

## Match Scoring

### Tiers

| Tier | Score Range | Badge Color | Meaning |
|------|------------|-------------|---------|
| **Strong Match** | 80-100 | Green | Highly qualified, should apply |
| **Good Match** | 60-79 | Yellow | Solid fit, minor gaps |
| **Stretch** | 40-59 | Orange | Possible with some upskilling |
| Below 40 | — | Not shown | Too far from match |

### Matching Rubric (Weighted Dimensions)

The AI scores each resume-job pair across 4 weighted dimensions:

| Dimension | Weight | What it measures | Example |
|-----------|--------|-----------------|---------|
| **Domain relevance** | 30% | Industry/domain background match. Healthcare AI researcher → healthcare AI role = high. Fintech engineer → healthcare AI = low. | 0-30 points |
| **Skills overlap** | 30% | % of required hard skills (languages, frameworks, tools, methods) the candidate has. | 0-30 points |
| **Experience level fit** | 25% | Seniority + years alignment. Junior applying to Staff role = large penalty. Senior applying to Senior = full score. | 0-25 points |
| **Role type fit** | 15% | Engineering vs. research vs. PM vs. data science alignment. | 0-15 points |

**Total: 0-100 points**

These weights encode the principle that domain expertise (hard to acquire, takes years) and skills (technical foundation) matter most, followed by seniority alignment and role category.

The Claude prompt must include these weights explicitly so scoring is consistent. The prompt also includes few-shot examples from admin-reviewed matches (see Quality Metrics below) to calibrate the AI's judgment over time.

### AI Matching Process

For each job, Claude evaluates across the 4 weighted dimensions above and produces:

- `match_score` (0-100, sum of weighted dimension scores)
- `match_tier` (strong/good/stretch, derived from score range)
- `match_reasoning` (1-2 sentence human-readable explanation referencing which dimensions scored high/low)
- `skills_matched` (array of matched skills)
- `skills_missing` (array of missing skills)
- `dimension_scores` (breakdown: `{domain: 25, skills: 22, experience: 20, role_type: 12}`)

### Skills Gap Analysis

Aggregated across all matched jobs:
- Skills the user has that are in high demand (with % of roles requiring them)
- Skills the user is missing that would unlock more matches (with % of roles requiring them)
- Suggested learning priorities (ranked by impact on match count)

## Match Quality & Metrics

### User Behavior Tracking

Track two key actions for every matched job displayed to a user:

| Event | When it fires | Stored as |
|-------|--------------|-----------|
| **Job click** | User clicks into the job detail page from a match card | `match_events.event_type = 'click'` |
| **Apply click** | User clicks the "Apply" button on a matched job | `match_events.event_type = 'apply'` |

These events are tied to the specific `user_job_match` row so we can compute:
- **Click-through rate by tier**: % of Strong/Good/Stretch matches that get clicked
- **Apply rate by tier**: % of Strong/Good/Stretch matches where user clicks Apply

Healthy signals: Strong matches should have higher CTR and apply rate than Stretch. If not, the scoring is miscalibrated.

### User Feedback (Thumbs Up/Down)

Each match card displays a small thumbs-up / thumbs-down button. When clicked:
- Stores `user_job_matches.user_feedback = 'up' | 'down'`
- Optional: after thumbs-down, show a quick dropdown: "Why?" → "Wrong seniority" / "Wrong domain" / "Missing key skills" / "Not interested in company" / "Other"

This provides direct quality signal per match.

### System Health Metrics

Monitored via admin dashboard queries:

| Metric | Healthy Range | Alert if |
|--------|--------------|----------|
| Average matches per user | 15-50 | < 5 (bar too high) or > 150 (bar too low) |
| Tier distribution | ~15% Strong, ~30% Good, ~55% Stretch | > 50% Strong (too generous) or < 5% Strong (too strict) |
| Thumbs-up rate on Strong matches | > 70% | < 50% (scoring is wrong) |
| CTR on Strong vs Stretch | Strong CTR > Stretch CTR | Stretch CTR > Strong CTR (ranking broken) |

### Admin Review Panel

A section in the existing `/admin` dashboard where the platform owner can manually review match quality:

**For each match, the admin sees:**
1. Resume summary (skills, experience, seniority, domain)
2. Matched job (title, company, description, requirements)
3. AI match score + tier + reasoning + dimension breakdown
4. User behavior: did they click the job posting? Did they click Apply?
5. User feedback: thumbs up/down + reason (if given)
6. **Admin verdict**: Good Match / Bad Match / Borderline + free-text notes

**Admin review table (`match_reviews`):**
```sql
CREATE TABLE match_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES user_job_matches(id) ON DELETE CASCADE,
    verdict TEXT NOT NULL CHECK (verdict IN ('good', 'bad', 'borderline')),
    notes TEXT,
    reviewed_at TIMESTAMPTZ DEFAULT now()
);
```

**Admin can browse all matches** (full browse mode), filtered by:
- Tier (show me all Strong matches)
- User feedback (show me thumbs-downed matches)
- Unreviewed only
- Specific user or job

### Feedback Loop: Improving Matching Over Time

Admin-reviewed matches feed back into the Claude matching prompt as few-shot examples:

1. Periodically export reviewed matches (e.g., 20 "good" + 20 "bad" examples)
2. Include them in the Claude prompt as calibration examples:
   ```
   Here are examples of matches a human reviewer rated:

   GOOD MATCH (score should be 80+):
   Resume: [summary] → Job: [title at company] → Reviewer note: "Strong domain fit, right seniority"

   BAD MATCH (score should be below 40):
   Resume: [summary] → Job: [title at company] → Reviewer note: "Wrong domain entirely, fintech person matched to biotech"
   ```
3. This iteratively calibrates the AI's judgment to match the platform owner's quality bar

### New Database Additions for Metrics

```sql
-- User feedback on matches
ALTER TABLE user_job_matches
    ADD COLUMN user_feedback TEXT CHECK (user_feedback IN ('up', 'down')),
    ADD COLUMN feedback_reason TEXT;

-- Match interaction events (clicks and applies)
CREATE TABLE match_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES user_job_matches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('click', 'apply')),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own events" ON match_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own events" ON match_events
    FOR SELECT USING (auth.uid() = user_id);
-- Admin reads all via service role

-- Admin match reviews
CREATE TABLE match_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES user_job_matches(id) ON DELETE CASCADE,
    verdict TEXT NOT NULL CHECK (verdict IN ('good', 'bad', 'borderline')),
    notes TEXT,
    reviewed_at TIMESTAMPTZ DEFAULT now()
);
-- No RLS — admin only (accessed via service role from /admin routes)

CREATE INDEX idx_match_events_match ON match_events(match_id);
CREATE INDEX idx_match_events_user ON match_events(user_id);
CREATE INDEX idx_match_reviews_match ON match_reviews(match_id);
```

## Technical Architecture

### New Database Tables

```sql
-- Stores uploaded resumes and parsed profiles
CREATE TABLE user_resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,           -- Supabase Storage path
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx', 'md')),
    file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 5242880), -- max 5MB
    raw_text TEXT,                    -- extracted plain text (truncated to 50K chars max)
    parsed_profile JSONB,            -- {skills, titles, experience_years, education, location, seniority, summary}
    processing_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (processing_status IN ('pending', 'parsing', 'matching', 'completed', 'failed')),
    error_message TEXT,              -- populated on failure
    uploaded_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)                  -- one active resume per user
);

-- Stores per-job match results
CREATE TABLE user_job_matches (
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

-- Lightweight user preferences (optional, post-match)
CREATE TABLE user_preferences (
    user_id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
    work_type_preference TEXT CHECK (work_type_preference IN ('remote', 'hybrid', 'onsite', 'any')),
    salary_min INTEGER,
    salary_max INTEGER,
    company_size_preference TEXT CHECK (company_size_preference IN ('startup', 'growth', 'bigtech', 'any')),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max)
);
```

### Re-upload Behavior

When a user re-uploads a resume, the upload API uses upsert:
```sql
INSERT INTO user_resumes (...) VALUES (...)
ON CONFLICT (user_id) DO UPDATE SET
    file_url = EXCLUDED.file_url,
    file_name = EXCLUDED.file_name,
    file_type = EXCLUDED.file_type,
    file_size = EXCLUDED.file_size,
    raw_text = NULL,
    parsed_profile = NULL,
    processing_status = 'pending',
    error_message = NULL,
    updated_at = now();
```

After upsert, all existing `user_job_matches` rows for that user are deleted:
```sql
DELETE FROM user_job_matches WHERE user_id = :user_id;
```

Then the async pipeline re-runs from scratch.

### Row-Level Security Policies

```sql
ALTER TABLE user_resumes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own resume" ON user_resumes
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own resume" ON user_resumes
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own resume" ON user_resumes
    FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE user_job_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own matches" ON user_job_matches
    FOR SELECT USING (auth.uid() = user_id);
-- Insert/update only via service role (backend pipeline), not user-facing

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own preferences" ON user_preferences
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users upsert own preferences" ON user_preferences
    FOR ALL USING (auth.uid() = user_id);
```

### Supabase Storage Bucket

```
Bucket: 'resumes' (private, not public)
Path pattern: {user_id}/{filename}
Policy: authenticated users can only upload/read files in their own user_id/ prefix
```

### Processing Pipeline (Async)

The pipeline is split into two phases to avoid serverless timeouts (Vercel 10s default / 60s Pro).

**Phase 1 — Upload Route (synchronous, fast, <3 seconds):**
```
1. Validate file:
   - Check MIME type AND file magic bytes (not just extension)
   - Reject if not PDF/DOCX/MD
   - Reject if > 5MB
2. Upload file → Supabase Storage (bucket: 'resumes', path: user_id/filename)
3. Upsert user_resumes row with processing_status = 'pending'
4. Delete existing user_job_matches for this user
5. Trigger async processing (see Phase 2)
6. Return 202 Accepted with { status: 'processing' }
```

**Phase 2 — Background Processing (async, 30-60 seconds):**

Triggered via Supabase Edge Function (invoked from upload route via `supabase.functions.invoke()`).

```
1. Set processing_status = 'parsing'
2. Extract text:
   - PDF: pdf-parse
   - DOCX: mammoth.js
   - MD: read as-is
   - Truncate raw_text to 50,000 chars max (prevents runaway API costs)
3. Claude API call #1 — Parse resume:
   - Input: raw text (truncated)
   - Output: structured JSON {skills, titles, experience_years, education, location, seniority, summary}
   - Store in user_resumes.parsed_profile
4. Set processing_status = 'matching'
5. Claude API call #2 — Match against active jobs (batched):
   - Batch jobs in groups of 20
   - Input per batch: parsed_profile + 20 job {title, description, requirements, company, funding_stage}
   - Output per job: {score, tier, reasoning, skills_matched, skills_missing}
   - Store matches with score >= 40 in user_job_matches
   - On Claude API error mid-batch: log error, continue with remaining batches (partial results are OK)
6. Set processing_status = 'completed'
   - On any fatal error: set processing_status = 'failed', store error_message
```

**Frontend Polling:**
- After upload returns 202, frontend polls `GET /api/resume/status` every 2 seconds
- Response includes `processing_status` and progress hint (e.g., "matching batch 5/32")
- Once `completed`, frontend fetches matches and renders dashboard

### API Routes

```
POST /api/resume/upload      — Upload file, validate, store, trigger async pipeline. Returns 202.
GET  /api/resume/status      — Poll processing status (pending/parsing/matching/completed/failed)
GET  /api/resume/profile     — Get current parsed profile
PUT  /api/resume/profile     — Edit parsed profile fields (user corrections)
GET  /api/resume/matches     — Get all matches for current user (sorted by score)
GET  /api/resume/skills-gap  — Get aggregated skills gap analysis
PUT  /api/preferences        — Upsert work type, salary, company size preferences
```

### Auth Callback Redirect

The existing OAuth callback at `/api/auth/callback` redirects to the `next` query param or `/`. When the upload CTA triggers sign-in, pass `?next=/dashboard` so users land on their dashboard after authentication. The upload modal can be shown on `/dashboard` if no resume exists yet.

### Cost Estimate

Job count is ~600 and growing. Batched in groups of 20 = ~30 batches.

| Operation | Claude API Cost | Frequency |
|-----------|----------------|-----------|
| Resume parsing | ~$0.01-0.03 | Per upload |
| Job matching (~600 jobs, 30 batches) | ~$0.40-1.00 | Per upload |
| **Total per user upload** | **~$0.45-1.05** | One-time |

**Incremental daily matching (new jobs only):**

| Users | New jobs/day | Daily cost | Monthly cost |
|-------|-------------|------------|-------------|
| 100 | 20 | ~$1-2 | ~$30-60 |
| 500 | 20 | ~$5-10 | ~$150-300 |
| 1,000 | 20 | ~$10-20 | ~$300-600 |

These costs are manageable up to ~1,000 users. Beyond that, consider switching to embedding-based pre-filtering (cosine similarity) to reduce the number of Claude API calls per user.

### Refresh Strategy

- **Full re-match**: when user uploads new resume (delete old matches, re-run pipeline)
- **Incremental match**: daily GitHub Action matches only new jobs (added since last run) against all active resumes
- **Stale threshold**: matches older than 30 days shown with "refresh" prompt
- **Cost guardrail**: if user count exceeds 1,000, switch incremental matching to embedding pre-filter + Claude scoring for top-50 candidates only

## Frontend Design

> **Note**: Use `frontend-design` skill during implementation for actual visual design. Below are structural wireframes for alignment only.

### 1. Landing Page (`/`)

New hero CTA alongside existing browse flow:

```
┌───────────────────────────────────────────────────┐
│  Find your next AI role — matched to your skills  │
│                                                    │
│  [Upload Resume]    or    [Browse Jobs ->]         │
│                                                    │
│  "Drop your resume and we'll match you with       │
│   600+ AI roles at funded startups in seconds"    │
└───────────────────────────────────────────────────┘
```

Below hero — "How it works" 3-step strip:
1. Upload your resume (PDF/DOCX/MD)
2. AI matches you to the best roles with reasoning
3. See your skills gaps and how to improve

### 2. Job Board (`/jobs`)

- **Top banner** (sticky, dismissible) for users without resume: "Get personalized matches — [Upload Resume]"
- **For users with matches**: new tab toggle at top of job list:
  - `[All Jobs]` `[My Matches]`
  - "My Matches" tab shows only matched jobs sorted by score
- **On each job card** (when user has resume): match badge in the corner
  - Green = Strong, Yellow = Good, Orange = Stretch

### 3. Job Detail Page (`/jobs/[id]`)

For users with a resume, new section below job description:

```
┌─────────────────────────────────────────┐
│  Your Match: Strong (87/100)            │
│                                         │
│  Matched: Python, PyTorch, NLP, 5+ yrs │
│  Missing: Kubernetes, MLOps            │
│                                         │
│  "Your NLP research experience closely  │
│   matches this role's focus on LLM      │
│   fine-tuning"                          │
└─────────────────────────────────────────┘
```

### 4. Market Analysis (`/market/[role]`)

For users with a resume, personalized panel:

```
┌──────────────────────────────────────────┐
│  Your Profile vs. Market Demand          │
│                                          │
│  Skills you have that are in demand:     │
│  Python (94%), PyTorch (78%), NLP (65%)  │
│                                          │
│  Skills gap to close:                    │
│  Kubernetes (needed by 62% of roles)     │
│  MLOps (needed by 48% of roles)          │
│                                          │
│  Suggested learning path:                │
│  1. Kubernetes for ML Engineers          │
│  2. MLOps with Kubeflow                  │
│                                          │
│  [See matching jobs for this role ->]    │
└──────────────────────────────────────────┘
```

### 5. New Page: Dashboard (`/dashboard`)

After uploading, this becomes the user's home:

- **Profile summary** — parsed from resume, editable fields
- **Preference card** — work type, salary, company size (optional)
- **Top matches** — ranked job list with badges + reasoning
- **Skills gap overview** — aggregated across all matched roles
- **Resume status** — "Uploaded 3 days ago" with [Re-upload] button

## Future Monetization Path

This feature directly enables the Wellfound/Otta employer model:

1. **Phase 1 (now)**: Free for all users. Build the candidate pool.
2. **Phase 2 (500+ resumes)**: Anonymized candidate insights for employers ("42 AI engineers with PyTorch experience are looking for roles")
3. **Phase 3 (1000+ resumes)**: Employer dashboard — pay to see matched candidates, send InMail-style messages, promote job listings to matched users.

The resume database is the moat. More resumes = more valuable to employers = more revenue.

## Out of Scope (for this version)

- Payment/subscription system (separate spec exists)
- Employer-facing features (Phase 2-3)
- LinkedIn import
- Cover letter generation
- Interview prep tools
- Resume editing/optimization suggestions
