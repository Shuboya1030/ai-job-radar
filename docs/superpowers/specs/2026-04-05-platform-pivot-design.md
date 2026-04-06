# AIJobRadar Platform Pivot — Design Spec

**Date**: 2026-04-05
**Status**: Draft
**Author**: Claude + Shuya

## Context

AIJobRadar is pivoting from a job-centric board to a company-centric discovery platform. The core insight: users don't just want job postings — they want to find interesting AI startups to join, even if no official position is listed. Many startups hire through direct outreach before posting publicly.

Current state: 629 active companies, 1570 active jobs, 39 registered users, 93% single-day visitors.

## Three Features

### Feature 1: Resume Matches Companies (Not Just Jobs)

**Problem**: Current matching only recommends specific job postings. Users miss companies that are a great fit but don't have public openings.

**Solution**: After uploading a resume, AI matches against all active companies — not just those with job postings.

#### Matching Logic

**Dimensions:**
- **Industry match**: User's industry background vs company's industry (from `companies.industry`)
- **Skill match**: User's skills vs company's tech stack (inferred from `product_description` + aggregated `hard_skills`/`tools` from the company's job postings)

**Score boost**: Companies with active job openings get +15 points (but no hard separation).

**What we DON'T match on**: Seniority/experience level (user requested to skip this).

#### Data Requirements

Each company needs enough data to match against:
- `product_description` — what the company does (used for industry/skill inference)
- `industry` — already exists
- Aggregated skills from that company's job postings (computed, not stored)

For companies with zero job postings and no product_description, matching quality will be low. The enrichment script (Feature 3) helps fill these gaps.

#### Database Changes

New table `user_company_matches`:
```sql
CREATE TABLE user_company_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    match_score INTEGER NOT NULL CHECK (match_score BETWEEN 0 AND 100),
    match_tier TEXT NOT NULL CHECK (match_tier IN ('strong', 'good', 'stretch')),
    match_reasoning TEXT NOT NULL,
    skills_matched JSONB DEFAULT '[]',
    skills_missing JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, company_id)
);

ALTER TABLE user_company_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own company matches" ON user_company_matches
    FOR SELECT USING (auth.uid() = user_id);
```

#### API Changes

- `POST /api/resume/process` — new mode `match_companies`: takes parsed profile, matches against all active companies
- `GET /api/resume/company-matches` — returns user's company matches sorted by score

#### UI Changes

- Dashboard: after matching, show "Matching Companies" section instead of (or alongside) job matches
- Each company card shows: name, product_description, funding, industry, match score/tier
- Green badge "X open positions" if company has jobs
- "Reach out directly" label if no jobs
- Click → goes to `/companies/[id]` detail page

#### Matching Process

1. Get user's `parsed_profile` (skills, industries, job_titles)
2. Get all active companies with their `product_description`, `industry`, and aggregated job skills
3. For companies with job postings: aggregate `hard_skills` + `tools` from all their active jobs
4. For companies without jobs: use only `product_description` + `industry`
5. Send batches to OpenAI: "Score how well this candidate matches each company"
6. Store results in `user_company_matches`
7. Companies with active openings get +15 score boost

---

### Feature 2: News Board

**Problem**: 93% of visitors come once and never return. No reason to come back unless actively job hunting.

**Solution**: A curated AI startup news feed that gives users a reason to visit regularly + weekly email digest.

#### Data Source

- **Primary**: TechCrunch RSS (already integrated in `company_discovery.py`)
- **Secondary**: Crunchbase News RSS, Product Hunt AI launches
- GPT auto-generates: summary (2-3 sentences), industry tags, event type

#### Event Types

| Type | Example |
|------|---------|
| `funding` | "Anthropic raises $2B Series D" |
| `launch` | "New AI startup Resolve.ai launches" |
| `acquisition` | "Google acquires Wiz for $23B" |
| `milestone` | "OpenAI hits 300M weekly users" |

#### Database

```sql
CREATE TABLE news_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    summary TEXT,
    source_url TEXT NOT NULL,
    source_name TEXT NOT NULL,  -- 'TechCrunch', 'Crunchbase', 'ProductHunt'
    industry_tags JSONB DEFAULT '[]',  -- ['AI/ML', 'Healthcare']
    event_type TEXT CHECK (event_type IN ('funding', 'launch', 'acquisition', 'milestone', 'other')),
    company_name TEXT,  -- linked company if applicable
    company_id UUID REFERENCES companies(id),
    image_url TEXT,
    published_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(source_url)
);

CREATE INDEX idx_news_published ON news_items(published_at DESC);

CREATE TABLE news_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    industry_tags JSONB DEFAULT '[]',  -- empty = all industries
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);
```

#### Pages & Components

**`/news` page**:
- News list sorted by `published_at` DESC
- Each item: title, summary, source badge, event type badge, industry tags, relative time
- Filters: event type, industry
- Subscribe button for logged-in users (pick industries to follow)

**Sidebar component** (shown on `/companies`, `/jobs`, `/`):
- Latest 5 news headlines
- "See all news →" link
- Compact design, doesn't dominate the page

#### Email Digest

- Weekly (Monday), via Resend
- Only for users with `news_subscriptions` entry
- Content: top 5-10 news items from the past week matching their industry tags
- Subject: "This week in AI startups — [top headline]"
- Reuse existing GitHub Action + Resend infrastructure

#### Scraping

- New script `scrapers/news_scraper.py`
- Runs daily as part of `main.py` pipeline
- Fetches RSS feeds → dedup by source_url → GPT summarize/tag → insert to `news_items`
- Links news to existing companies when possible (match by company name)

---

### Feature 3: Expand Company Coverage

**Problem**: Many notable AI startups (resolve.ai, ingress, etc.) are missing from the database.

**Solution**: Two channels — automated discovery from more sources + user submissions.

#### Auto Discovery (Primary)

Expand `company_discovery.py` to add:
- **Product Hunt AI launches** — daily RSS for AI/ML category
- **YC Company Directory** — quarterly scrape of new YC batches
- **Crunchbase funding feed** — daily RSS for AI funding rounds

Each new company gets:
- Name, website, industry (from source)
- `product_description` (GPT-generated from source context)
- `discovered_via` field to track source

#### User Submissions

New form at `/companies/suggest`:
- Fields: Company name (required), Website (required), Why you recommend it (optional)
- Logged-in users only
- Stored in new table, reviewed by admin before adding to main companies table

```sql
CREATE TABLE company_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id),
    company_name TEXT NOT NULL,
    website TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT now()
);
```

Admin can review in `/admin` → new "Suggestions" tab.

#### Company Enrichment

Existing `scrapers/company_enricher.py` + `funding_enricher.py` handle:
- `product_description` generation via GPT
- Founder LinkedIn/email discovery
- Funding data from Growjo + GPT

---

## Implementation Order

These three features are **independent** and can be built in parallel, but the recommended order is:

1. **Feature 3: Company Coverage** — foundation; more companies = better matching + news
2. **Feature 2: News Board** — retention play; independent of matching
3. **Feature 1: Company Matching** — depends on companies having good data (product_description)

Each feature gets its own implementation plan and can be shipped independently.

## Navigation Changes

```
Before: Overview | Companies | Jobs | Skills
After:  Overview | Companies | Jobs | News | Skills
```

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Active companies | 629 | 800+ |
| Companies with product_description | ~0% | >50% |
| Return visitors (2+ days) | 7% | 15% |
| News page views/week | 0 | 100+ |
| Company suggestions/month | 0 | 10+ |
