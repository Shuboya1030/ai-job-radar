# AIJobRadar — Implementation Plan

> Date: 2026-03-14
> Estimated Tasks: 25
> Dependencies shown as [→ Depends on T-XX]

---

## Phase 0: Project Setup

### T-01: Initialize Next.js Project
- `npx create-next-app@latest` with TypeScript + Tailwind + App Router
- Add dependencies: `@supabase/supabase-js`, `lucide-react`, `recharts`, `date-fns`, `clsx`
- Configure `next.config.js`
- Init git repo, push to GitHub
- **Output**: Skeleton project running locally

### T-02: Setup Supabase Project
- Create new Supabase project
- Run schema SQL (companies, jobs, market_snapshots tables + indexes + RLS + views)
- Set up service role key + anon key
- Create `.env.local` with all keys
- **Output**: Empty database ready for data

### T-03: Connect Vercel
- Link GitHub repo to Vercel
- Set environment variables in Vercel dashboard
- Verify auto-deploy on push works
- **Output**: Live URL (empty site) deployed

---

## Phase 1: Data Pipeline — Scrapers [→ T-02]

### T-04: LinkedIn Scraper (refactor existing)
- Refactor `scrape_swe_ai_jobs.py` from JobSearch repo into modular scraper
- Support 3 roles: AI PM, AI Engineer, SWE
- Add salary extraction to GPT enrichment prompt (salary_min, salary_max, salary_type)
- Add industry tagging (predefined enum in prompt)
- Add seniority extraction
- Add company_type labeling
- Output: structured data ready for Supabase insert
- **Output**: `scrapers/linkedin_scraper.py`

### T-05: Wellfound Scraper (new)
- Scrape Wellfound job listings for 3 roles
- Extract: job details + company funding info (stage, amount, employee count)
- Parse funding amounts into standardized integer (cents)
- Handle pagination
- **Output**: `scrapers/wellfound_scraper.py`

### T-06: YC Work at a Startup Scraper (new)
- Scrape YC's "Work at a Startup" job board for 3 roles
- Extract: job details + company profile (batch, funding)
- **Output**: `scrapers/yc_scraper.py`

### T-07: GPT Enrichment Module
- Single enrichment module used by all scrapers
- Extracts from JD: hard_skills, soft_skills, tools, salary, work_type, seniority, experience_years, industry, company_type
- Industry tag constrained to predefined enum list (GPT MUST choose from list)
- Salary extraction: extract raw values + type (annual/hourly)
- Salary normalization: hourly × 2080 → salary_annual_min/max, preserve raw values
- Schema validation: reject enrichment output that doesn't match enum constraints
- **Output**: `scrapers/enrichment.py`

### T-08: Company Resolution Logic
- **Identity strategy**: domain-based, NOT name-based
  - Extract canonical_domain from company URL (strip www, normalize)
  - Look up by canonical_domain first
  - If no URL: fall back to alias table lookup
  - If new: create company + insert alias + insert source_company_id
- Funding rules:
  - Only upgrade funding_amount when new value is known (not NULL)
  - Set funding_amount_status = 'known' when confirmed
  - NULL funding stays NULL (never default to 0)
- Name variants → insert into company_aliases table
- Source-specific IDs → insert into company_source_ids table
- **Output**: `scrapers/company_manager.py`

### T-09: Cross-Source Deduplication
- Detect same job posted on LinkedIn + Wellfound + YC
- Match on: canonical_domain + title_normalized + location
- title_normalized: lowercase, strip seniority prefixes, strip trailing IDs
- Precedence: richer source wins (more non-NULL fields)
- Winner: canonical_job_id = NULL (shown in UI, counted in analytics)
- Losers: canonical_job_id = winner's ID (preserved but hidden)
- All source records preserved for auditability
- **Output**: `scrapers/dedup.py`

### T-10: Database Writer + Freshness Manager
- Upsert jobs to Supabase (INSERT ON CONFLICT (source, source_id) DO UPDATE)
- Upsert companies with funding upgrade-only rules
- Update last_seen_at for all jobs seen in current scrape cycle
- Auto-deactivate: jobs with last_seen_at > 7 days ago → is_active = false
- Use service role key for writes
- **Output**: `scrapers/db.py`

### T-11: Scraper Orchestrator + Pipeline Health
- Main script that runs all scrapers in sequence
- Pipeline: Scrape → Enrich → Company Resolution → Dedup → Write → Freshness cleanup
- Logging: jobs_scraped, jobs_enriched, jobs_deduped, jobs_deactivated per source
- Alert thresholds: if any source returns 0 jobs, log ERROR (possible blocking)
- Minimum coverage: warn if <50 jobs/source
- **Output**: `scrapers/main.py`

---

## Phase 2: Data Pipeline — Market Analysis [→ T-10]

### T-12: Weekly Aggregation Script
- Query canonical jobs from past 7 days (WHERE canonical_job_id IS NULL AND is_active = true)
- Compute per-role:
  - Skill frequency rankings (hard_skills, soft_skills, tools)
  - Salary stats: use salary_annual_* fields ONLY, exclude NULLs
    - Average by seniority level
    - Top paying companies
    - Record jobs_with_salary_pct (data coverage transparency)
  - Work type distribution
  - Experience distribution
  - Top companies, top locations
  - Must-have keywords (>30%), nice-to-have (15-30%)
- Upsert to `market_snapshots` table
- **Output**: `scrapers/weekly_analysis.py`

### T-13: Company Health Check Script
- HTTP GET (not HEAD — many sites block HEAD) to all active company websites
- Classify failure types: dns, tls, http_4xx, http_5xx, timeout
- Deactivation rules:
  - DNS failure × 3 consecutive weeks → deactivate
  - Other failures × 5 consecutive weeks → deactivate
  - Exception: if company has jobs posted in last 14 days → do NOT deactivate
- Log all results for manual review
- **Output**: `scrapers/health_check.py`

---

## Phase 3: GitHub Actions [→ T-11, T-12, T-13]

### T-14: Daily Scrape Workflow
- `.github/workflows/daily-scrape.yml`
- Cron: daily UTC 6:00
- Setup Python 3.11 + deps
- Run `scrapers/main.py`
- Upload logs as artifacts
- Secrets: DATABASE_URL, OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY

### T-15: Weekly Analysis Workflow
- `.github/workflows/weekly-analysis.yml`
- Cron: weekly Sunday UTC 8:00
- Run `scrapers/weekly_analysis.py`

### T-16: Weekly Health Check Workflow
- `.github/workflows/weekly-health-check.yml`
- Cron: weekly Wednesday UTC 10:00
- Run `scrapers/health_check.py`

---

## Phase 4: Frontend — Shared Components [→ T-01]

### T-17: Layout + Navigation + Theming
- Root layout with top navigation (Overview, Market Analysis, Job Board)
- Footer
- Color palette: young, vibrant, simple (not corporate)
- Responsive base layout
- Supabase client init (`lib/supabase.ts`)
- TypeScript types from schema (`types/database.ts`)
- **Output**: `app/layout.tsx`, `components/nav.tsx`, `components/footer.tsx`

### T-18: Chart Components
- Reusable bar chart (horizontal, for skill rankings)
- Reusable pie/doughnut chart (work type, seniority)
- Salary range visualization (box plot or range bars)
- Use Recharts (React-native, better than Chart.js for Next.js)
- **Output**: `components/charts/`

---

## Phase 5: Frontend — Market Analysis Pages [→ T-17, T-18, T-12]

### T-19: Landing Page (Overview Dashboard)
- 3 role summary cards (job count, salary range, top skill)
- Cross-role skills comparison bar chart
- Cross-role salary comparison
- Links to per-role detail pages and job board
- **API**: `GET /api/market/compare`
- **Output**: `app/page.tsx`

### T-20: Per-Role Market Dashboard
- URL: `/market/ai-engineer`, `/market/ai-pm`, `/market/swe`
- Tabs or sections: Skills | Salary | Resume Tips
- Skills tab: hard skills table, soft skills table, tools table (ranked with % bars)
- Salary tab: salary by seniority chart, top paying companies
- Resume Tips tab: must-have keywords, nice-to-have, action verbs
- **API**: `GET /api/market?role=ai-engineer`
- **Output**: `app/market/[role]/page.tsx`

### T-21: Role Comparison Page
- URL: `/compare`
- Side-by-side skills (shared vs unique)
- Side-by-side salary by seniority
- Job volume comparison
- **API**: `GET /api/market/compare`
- **Output**: `app/compare/page.tsx`

---

## Phase 6: Frontend — Job Board Pages [→ T-17, T-10]

### T-22: Job Board List Page
- URL: `/jobs`
- Filter bar: role, work type, industry, location, salary range, startup toggle, search
- Job card list with: title, company, salary, tags, funding badge, posted date
- Pagination (load more)
- **API**: `GET /api/jobs?role=...&industry=...&limit=20&offset=0`
- **Output**: `app/jobs/page.tsx`, `components/jobs/job-card.tsx`, `components/jobs/job-filters.tsx`

### T-23: Job Detail Page
- URL: `/jobs/[id]`
- Full JD display
- Company info sidebar card (funding stage, amount, employee range, industry)
- "Apply" button → external link
- Related jobs (same company or same role)
- **API**: `GET /api/jobs/[id]`
- **Output**: `app/jobs/[id]/page.tsx`, `components/jobs/company-card.tsx`

---

## Phase 7: API Routes [→ T-02, T-17]

### T-24: All API Routes
- `GET /api/jobs` — List jobs with filters, pagination, search, sort
- `GET /api/jobs/[id]` — Single job with joined company data (via v_jobs_full view)
- `GET /api/market` — Latest market_snapshot for a role
- `GET /api/market/compare` — All 3 roles' latest snapshots for comparison
- `GET /api/filters` — Distinct values for filter dropdowns (industries, locations, companies)
- All routes query Supabase with anon key (read-only)
- **Output**: `app/api/` directory

---

## Phase 8: Testing [→ T-11, T-12, T-24]

### T-25: Scraper & Enrichment Tests
- **Parser unit tests**: verify LinkedIn/Wellfound/YC HTML parsing with saved fixture files
- **Enrichment schema validation**: GPT output must match enum constraints (industry, seniority, work_type)
- **Salary normalization tests**: "$55.50/hr" → 115440 annual, "$125,000-$180,000" → correct min/max
- **Company resolution tests**: domain extraction, alias matching, funding upgrade-only rule
- **Dedup correctness tests**: same job across 2 sources → 1 canonical + 1 duplicate
- Run with: `pytest scrapers/tests/`
- **Output**: `scrapers/tests/` directory

### T-26: API Integration Tests
- Test each API endpoint with real Supabase data
- Verify filter combinations return correct results
- Verify v_jobs_full view excludes duplicates and inactive
- Test edge cases: no salary, unknown industry, empty results
- **Output**: `app/api/__tests__/` or manual test script

---

## Phase 9: Launch [→ All above]

### T-27: Seed Initial Data + Launch
- Run scrapers manually once to populate Supabase with initial data (LinkedIn + Wellfound + YC)
- Run weekly_analysis.py to generate first market snapshot
- Verify all pages render correctly with real data
- Spot-check: dedup working, salary normalized, company funding displayed
- Run Lighthouse for performance
- Push to main → Vercel auto-deploy
- Share link on LinkedIn
- **Output**: Live site at production URL

---

## Task Dependency Graph

```
T-01 (Next.js init) ──┬── T-17 (Layout/Nav) ──┬── T-19 (Landing)
                       │                        ├── T-20 (Market Dashboard)
                       │                        ├── T-21 (Compare)
                       │                        ├── T-22 (Job Board List)
                       │                        └── T-23 (Job Detail)
                       │
                       └── T-18 (Charts) ───────┘

T-02 (Supabase) ──┬── T-04 (LinkedIn scraper)──┐
                   │                             │
                   ├── T-05 (Wellfound scraper)──┤
                   │                             │
                   ├── T-06 (YC scraper)─────────┤
                   │                             │
                   ├── T-07 (GPT enrichment)─────┤
                   │                             │
                   ├── T-08 (Company resolution)─┤
                   │                             │
                   ├── T-09 (Dedup)──────────────┤
                   │                             │
                   └── T-10 (DB writer)──────────┼── T-11 (Orchestrator) ── T-14 (Daily GH Action)
                                                 │
                                                 ├── T-12 (Weekly analysis) ── T-15 (Weekly GH Action)
                                                 │
                                                 ├── T-13 (Health check) ── T-16 (Health GH Action)
                                                 │
                                                 └── T-25 (Scraper tests)

T-03 (Vercel) ── T-27 (Launch)

T-24 (API routes) ← T-02 + T-17 → T-26 (API tests)
```

---

## Parallel Execution Strategy

| Track | Tasks | Description |
|-------|-------|-------------|
| **Track A: Scrapers** | T-04 → T-11, T-25 | Python scraping + enrichment + tests |
| **Track B: Frontend** | T-17, T-18 → T-19, T-20, T-21, T-22, T-23 | All UI pages |
| **Track C: Infra** | T-02, T-03, T-14, T-15, T-16 | Supabase, Vercel, GitHub Actions |
| **Track D: API** | T-24, T-26 | API routes + tests (after T-02 + T-17) |

Tracks A, B, C can start simultaneously. Track D starts once Supabase schema and frontend layout exist. Testing (T-25, T-26) runs as part of their respective tracks, not deferred to launch.

---

## Review Findings Addressed

| # | Severity | Finding | Fix Applied |
|---|----------|---------|-------------|
| 1 | Critical | Funding NULL vs 0 corruption | `funding_amount_cents` nullable + `funding_amount_status` enum (T-02, T-08) |
| 2 | High | Dedup not implementable | Added `canonical_job_id` FK, dedup preserves all records (T-02, T-09) |
| 3 | High | Salary hourly/annual mixed | Store `salary_annual_*` (normalized) + `salary_raw_*` (audit). Hourly × 2080 (T-02, T-07) |
| 4 | High | Company identity collisions | Domain-based identity + `company_aliases` + `company_source_ids` tables (T-02, T-08) |
| 5 | Med-High | Health check false positives | GET fallback, failure type classification, multi-signal deactivation rules (T-13) |
| 6 | Medium | API contract inconsistent | Removed `/api/companies`, company data embedded in job responses via view (T-24) |
| 7 | Medium | Testing too late | Added T-25 (scraper tests) and T-26 (API tests) as dedicated tasks before launch |
| 8 | Medium | Job freshness unspecified | Added `last_seen_at`, auto-deactivate after 7 days unseen (T-02, T-10) |
| 9 | Medium | Scraping risk not operationalized | Added pipeline health alerts, minimum coverage thresholds, SLOs (T-11, DESIGN.md §5.4) |
