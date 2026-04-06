# Feature 1: Company Matching — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resume matching targets companies instead of individual jobs. Users see matched companies ranked by fit, with open positions highlighted.

**Architecture:** New user_company_matches table. New matchCompaniesBatch function in resume-ai.ts. Process route gets new match_companies mode. Dashboard shows company matches instead of job matches.

**Tech Stack:** Next.js 14, Supabase, OpenAI (GPT-4o), Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-05-platform-pivot-design.md`

**Prerequisite:** Feature 3 (company coverage) should be done first so companies have product_description data.

---

## File Structure

### New Files
```
database/migration_company_matches.sql         — user_company_matches table
app/api/resume/company-matches/route.ts        — GET: user's company matches
```

### Modified Files
```
lib/resume-ai.ts                               — Add matchCompaniesBatch function
app/api/resume/process/route.ts                — Add match_companies mode
app/dashboard/page.tsx                         — Show company matches instead of job matches
```

---

## Chunk 1: Database + AI Matching Logic

### Task 1: Migration

**Files:**
- Create: `database/migration_company_matches.sql`

- [ ] **Step 1: Write migration**

```sql
CREATE TABLE IF NOT EXISTS user_company_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    match_score INTEGER NOT NULL CHECK (match_score BETWEEN 0 AND 100),
    match_tier TEXT NOT NULL CHECK (match_tier IN ('strong', 'good', 'stretch')),
    match_reasoning TEXT NOT NULL,
    skills_matched JSONB DEFAULT '[]',
    skills_missing JSONB DEFAULT '[]',
    has_open_jobs BOOLEAN DEFAULT false,
    open_job_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, company_id)
);

ALTER TABLE user_company_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own company matches" ON user_company_matches
    FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_user_company_matches_user ON user_company_matches(user_id);
CREATE INDEX idx_user_company_matches_score ON user_company_matches(user_id, match_score DESC);
```

- [ ] **Step 2: Run in Supabase SQL Editor**
- [ ] **Step 3: Commit**

### Task 2: Company Matching AI Function

**Files:**
- Modify: `lib/resume-ai.ts`

- [ ] **Step 1: Add interfaces**

```typescript
export interface CompanyForMatching {
  id: string
  name: string
  industry: string | null
  product_description: string | null
  funding_stage: string | null
  employee_range: string | null
  aggregated_skills: string[]  // from company's job postings
  open_job_count: number
}

export interface CompanyMatchResult {
  company_id: string
  match_score: number
  match_tier: 'strong' | 'good' | 'stretch'
  match_reasoning: string
  skills_matched: string[]
  skills_missing: string[]
}
```

- [ ] **Step 2: Add matchCompaniesBatch function** — similar to matchJobsBatch but matches against companies. Prompt includes company name, industry, product_description, aggregated skills. Companies with open jobs get +15 score boost after AI scoring.

- [ ] **Step 3: Commit**

### Task 3: Company Matches API

**Files:**
- Create: `app/api/resume/company-matches/route.ts`

- [ ] **Step 1: Create GET route** — returns user's company matches with company details, sorted by match_score DESC
- [ ] **Step 2: Commit**

---

## Chunk 2: Process Route + Dashboard

### Task 4: Process Route — match_companies Mode

**Files:**
- Modify: `app/api/resume/process/route.ts`

- [ ] **Step 1: Add match_companies mode**

Logic:
1. Get user's parsed_profile
2. Get all active companies
3. For each company, aggregate hard_skills + tools from their active jobs
4. Pre-filter: companies matching user's industry OR with skill overlap → top 100
5. Send to matchCompaniesBatch in batches of 10 (companies have more context than jobs)
6. Apply +15 boost for companies with open jobs
7. Store results in user_company_matches (score >= 40 only)

- [ ] **Step 2: Trigger company matching** after job matching in parse_then_match mode
- [ ] **Step 3: Commit**

### Task 5: Dashboard — Company Match Display

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Fetch company matches** from `/api/resume/company-matches`
- [ ] **Step 2: Add "Matching Companies" section** below job matches (or replace if no job matches)
- [ ] **Step 3: Company match card**: company name, product_description, funding badge, industry tag, match score/tier, "X open positions" (green) or "Reach out directly" (gray)
- [ ] **Step 4: Click** → link to `/companies/[id]`
- [ ] **Step 5: Commit**

---

## Verification

- [ ] Upload resume → see company matches on dashboard
- [ ] Companies with open positions show green badge
- [ ] Companies without positions show "reach out directly"
- [ ] Click company → goes to detail page
- [ ] Match reasoning makes sense
