# AIJobRadar — Architecture Design Document

> Version: 1.1 (Post-Review)
> Date: 2026-03-14
> Status: Revised — addressed 9 review findings

---

## 1. System Overview

AIJobRadar is a data-driven platform with two core products:
1. **Market Analysis** — Weekly aggregated skill demand, salary benchmarks, resume optimization
2. **Job Board** — Daily-updated AI job aggregator with full JD, filters, startup emphasis, company funding info

```
┌─────────────────────────────────────────────────────────────────┐
│                        Users (Browser)                          │
│                     AIJobRadar on Vercel                        │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                    ┌───────▼────────┐
                    │   Next.js 14   │
                    │   App Router   │
                    │  (TypeScript)  │
                    └───────┬────────┘
                            │
              ┌─────────────┼─────────────────┐
              │             │                 │
      ┌───────▼──────┐ ┌───▼──────┐  ┌───────▼────────┐
      │  Pages/UI    │ │ API      │  │  Static Assets │
      │  (React +    │ │ Routes   │  │  (public/)     │
      │  Tailwind)   │ │ (/api/*) │  │                │
      └───────┬──────┘ └───┬──────┘  └────────────────┘
              │             │
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │   Supabase  │
              │ (PostgreSQL) │
              └──────┬──────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
   ┌────▼───┐  ┌────▼───┐  ┌────▼────┐
   │ jobs   │  │company │  │ market  │
   │ table  │  │ table  │  │ analysis│
   │        │  │        │  │ tables  │
   └────────┘  └────────┘  └─────────┘
                     ▲
                     │
        ┌────────────┼────────────┐
        │     Data Pipeline       │
        │   (GitHub Actions)      │
        ├─────────────────────────┤
        │  Daily: Job Scraping    │
        │  Weekly: Market Analysis│
        │  Weekly: Health Check   │
        └────────────┬────────────┘
                     │
           ┌─────────┼──────────┐
           │         │          │
      ┌────▼──┐ ┌───▼───┐ ┌───▼──┐
      │Linked │ │Wellf- │ │ YC   │
      │  In   │ │ound   │ │ WaaS │
      └───────┘ └───────┘ └──────┘
```

---

## 2. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Next.js 14 + TypeScript + Tailwind CSS | Same pattern as pm-interview-tracker, Vercel-optimized |
| **Database** | Supabase (PostgreSQL) | Free tier, RLS, auto-generated API, proven pattern |
| **Scraper** | Python 3.11 + Requests + BeautifulSoup | Existing LinkedIn scraper already built |
| **AI Enrichment** | OpenAI GPT-4o-mini | Skill extraction, salary parsing, industry tagging |
| **Hosting** | Vercel | Auto-deploy from GitHub, serverless API routes |
| **Automation** | GitHub Actions | Daily/weekly cron jobs for data pipeline |
| **Icons** | Lucide React | Consistent with existing projects |

---

## 3. Database Schema

### 3.1 Tables

```sql
-- ═══════════════════════════════════════════
-- COMPANIES
-- Identity: domain-based (not name-based) to avoid fuzzy match collisions
-- ═══════════════════════════════════════════
CREATE TABLE companies (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  canonical_domain TEXT UNIQUE,               -- e.g. "anthropic.com", primary identity key
  name          TEXT NOT NULL,
  website       TEXT,
  logo_url      TEXT,
  company_type  TEXT CHECK (company_type IN (
                  'Startup', 'Scale-up', 'Big Tech', 'Enterprise'
                )),
  industry      TEXT CHECK (industry IN (
                  'AI/ML', 'Fintech', 'Healthcare', 'E-commerce', 'SaaS',
                  'Cybersecurity', 'Robotics', 'EdTech', 'Adtech',
                  'Cloud/Infra', 'Gaming', 'Automotive', 'Biotech',
                  'Enterprise Software', 'Social/Media', 'Other'
                )),
  funding_stage TEXT CHECK (funding_stage IN (
                  'Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C',
                  'Series D+', 'Public', 'Bootstrapped', 'Unknown'
                )),
  -- [FIX: Critical] NULL = unknown, 0 = truly zero (e.g., bootstrapped)
  -- Upgrade-only rule applies only when new value is known (NOT NULL)
  funding_amount_cents  BIGINT,               -- NULL = unknown, never default to 0
  funding_amount_status TEXT DEFAULT 'unknown' CHECK (funding_amount_status IN ('known', 'unknown')),
  last_funding_date     DATE,
  employee_range TEXT CHECK (employee_range IN (
                  '1-10', '11-50', '51-200', '201-500', '501-1000',
                  '1001-5000', '5000+'
                )),
  headquarter   TEXT,
  description   TEXT,
  is_active     BOOLEAN DEFAULT true,
  health_warnings INTEGER DEFAULT 0,          -- consecutive failed checks
  last_health_check TIMESTAMPTZ,
  health_failure_type TEXT,                    -- 'dns', 'tls', 'http_4xx', 'http_5xx', 'timeout'
  source        TEXT CHECK (source IN ('LinkedIn', 'Wellfound', 'YC', 'Manual')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Company name aliases (handles rebrands, spelling variants, source-specific names)
CREATE TABLE company_aliases (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  alias         TEXT NOT NULL,
  source        TEXT,                         -- which source uses this name
  UNIQUE(alias, source)
);

-- Source-specific company IDs (stable cross-source identity)
CREATE TABLE company_source_ids (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source        TEXT NOT NULL CHECK (source IN ('LinkedIn', 'Wellfound', 'YC')),
  source_company_id TEXT NOT NULL,            -- platform-specific ID
  UNIQUE(source, source_company_id)
);

-- ═══════════════════════════════════════════
-- JOBS
-- [FIX: High] Salary stored as annualized USD only
-- [FIX: High] Dedup via canonical_job_id
-- [FIX: Medium] Freshness via last_seen_at
-- ═══════════════════════════════════════════
CREATE TABLE jobs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id       TEXT NOT NULL,              -- original platform ID
  source          TEXT NOT NULL CHECK (source IN ('LinkedIn', 'Wellfound', 'YC')),
  company_id      UUID REFERENCES companies(id),
  title           TEXT NOT NULL,
  title_normalized TEXT,                      -- lowercased, stripped for dedup matching
  role_category   TEXT CHECK (role_category IN ('AI PM', 'AI Engineer', 'Software Engineer')),
  seniority       TEXT CHECK (seniority IN (
                    'Intern', 'Junior', 'Mid', 'Senior', 'Staff',
                    'Principal', 'Lead', 'Manager', 'Unknown'
                  )),
  employment_type TEXT CHECK (employment_type IN (
                    'Full-time', 'Part-time', 'Contract', 'Internship'
                  )),
  work_type       TEXT CHECK (work_type IN ('Remote', 'Hybrid', 'On-site', 'Unknown')),
  location        TEXT,

  -- [FIX: High] All salary stored as annualized USD
  -- Hourly rates converted: hourly × 2080 = annual
  -- Original values preserved in salary_raw_* for auditability
  salary_annual_min  INTEGER,                 -- annualized USD, NULL if unknown
  salary_annual_max  INTEGER,                 -- annualized USD, NULL if unknown
  salary_raw_min     NUMERIC,                 -- original extracted value
  salary_raw_max     NUMERIC,                 -- original extracted value
  salary_raw_type    TEXT CHECK (salary_raw_type IN ('Annual', 'Hourly', 'Unknown')),

  description     TEXT,
  hard_skills     JSONB DEFAULT '[]',
  soft_skills     JSONB DEFAULT '[]',
  tools           JSONB DEFAULT '[]',
  experience_years TEXT,
  industry        TEXT,                       -- same enum as companies
  apply_url       TEXT,
  posted_at       DATE,
  scraped_at      TIMESTAMPTZ DEFAULT now(),
  last_seen_at    TIMESTAMPTZ DEFAULT now(),  -- [FIX: Medium] updated each scrape cycle
  is_active       BOOLEAN DEFAULT true,

  -- [FIX: High] Cross-source dedup
  -- NULL = this is a canonical record (or not yet deduped)
  -- Non-NULL = this is a duplicate, points to the canonical job
  canonical_job_id UUID REFERENCES jobs(id),

  UNIQUE(source, source_id)                   -- per-source uniqueness
);

-- ═══════════════════════════════════════════
-- MARKET ANALYSIS (weekly aggregated)
-- Only counts canonical jobs (canonical_job_id IS NULL)
-- Only uses salary_annual_* fields for averages
-- ═══════════════════════════════════════════
CREATE TABLE market_snapshots (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role_category   TEXT NOT NULL,
  snapshot_date   DATE NOT NULL,
  total_jobs      INTEGER,                    -- canonical only
  hard_skills     JSONB,   -- [{"name": "ML", "count": 66, "pct": 66.0}, ...]
  soft_skills     JSONB,
  tools           JSONB,
  work_type_dist  JSONB,   -- {"Remote": 17, "Hybrid": 23, ...}
  seniority_dist  JSONB,
  salary_stats    JSONB,   -- {"overall_avg_min": 120000, "overall_avg_max": 180000,
                           --  "by_seniority": {"Junior": {"avg_min": ..., "count": ...}, ...},
                           --  "top_paying_companies": [...]}
  top_companies   JSONB,
  top_locations   JSONB,
  experience_dist JSONB,
  must_have_keywords JSONB, -- {"hard": [...], "soft": [...], "tools": [...]}
  nice_to_have_keywords JSONB,
  jobs_with_salary_pct NUMERIC, -- % of jobs that had salary data (transparency metric)

  UNIQUE(role_category, snapshot_date)
);

-- ═══════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════
CREATE INDEX idx_jobs_role ON jobs(role_category);
CREATE INDEX idx_jobs_source ON jobs(source);
CREATE INDEX idx_jobs_company ON jobs(company_id);
CREATE INDEX idx_jobs_work_type ON jobs(work_type);
CREATE INDEX idx_jobs_industry ON jobs(industry);
CREATE INDEX idx_jobs_posted ON jobs(posted_at DESC);
CREATE INDEX idx_jobs_active ON jobs(is_active) WHERE is_active = true;
CREATE INDEX idx_jobs_canonical ON jobs(canonical_job_id) WHERE canonical_job_id IS NULL;
CREATE INDEX idx_jobs_salary ON jobs(salary_annual_min, salary_annual_max)
  WHERE salary_annual_min IS NOT NULL;
CREATE INDEX idx_jobs_skills ON jobs USING GIN(hard_skills);
CREATE INDEX idx_jobs_tools ON jobs USING GIN(tools);
CREATE INDEX idx_jobs_last_seen ON jobs(last_seen_at);
CREATE INDEX idx_jobs_title_norm ON jobs(title_normalized);
CREATE INDEX idx_companies_active ON companies(is_active) WHERE is_active = true;
CREATE INDEX idx_companies_domain ON companies(canonical_domain);
CREATE INDEX idx_company_aliases ON company_aliases(alias);
CREATE INDEX idx_market_role_date ON market_snapshots(role_category, snapshot_date DESC);

-- ═══════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_source_ids ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read jobs" ON jobs FOR SELECT USING (true);
CREATE POLICY "Public read companies" ON companies FOR SELECT USING (true);
CREATE POLICY "Public read aliases" ON company_aliases FOR SELECT USING (true);
CREATE POLICY "Public read source ids" ON company_source_ids FOR SELECT USING (true);
CREATE POLICY "Public read snapshots" ON market_snapshots FOR SELECT USING (true);

-- Service role handles all writes (scrapers)
```

### 3.2 Design Decisions (Post-Review Fixes)

| Issue | Fix | Rationale |
|-------|-----|-----------|
| **Funding NULL vs 0** | `funding_amount_cents` nullable + `funding_amount_status` enum | Unknown ≠ zero. Prevents biased averages and rankings. |
| **Company identity collision** | `canonical_domain` as primary key + `company_aliases` + `company_source_ids` tables | Fuzzy name matching is unreliable. Domain-based identity is stable. Aliases handle rebrands. |
| **Cross-source dedup** | `canonical_job_id` FK on jobs table | All source records preserved. Duplicates point to canonical. Job Board and Market Analysis only show/count canonical records. |
| **Salary hourly vs annual** | Store `salary_annual_*` (normalized) + `salary_raw_*` (original) | All analytics use annualized values. Hourly converted at 2080 hrs/yr. Raw values kept for audit. |
| **Job staleness** | `last_seen_at` field, auto-deactivate after 7 days unseen | Prevents stale listings from degrading trust. |
| **Health check false positives** | `health_failure_type` field, GET fallback, multi-signal | Distinguishes DNS/TLS/HTTP failures. HEAD-only is too brittle. |

### 3.3 Views

```sql
-- Full job view with company info (canonical only, active only)
CREATE VIEW v_jobs_full AS
SELECT
  j.*,
  c.name AS company_name,
  c.logo_url AS company_logo,
  c.company_type,
  c.funding_stage,
  c.funding_amount_cents,
  c.funding_amount_status,
  c.last_funding_date,
  c.employee_range,
  c.headquarter,
  c.description AS company_description,
  c.industry AS company_industry
FROM jobs j
LEFT JOIN companies c ON j.company_id = c.id
WHERE j.is_active = true
  AND j.canonical_job_id IS NULL              -- canonical records only
  AND (c.is_active = true OR c.id IS NULL);

-- Salary analytics view (only jobs with known annualized salary)
CREATE VIEW v_jobs_with_salary AS
SELECT * FROM v_jobs_full
WHERE salary_annual_min IS NOT NULL;
```

---

## 4. Frontend Architecture

### 4.1 Page Structure

```
app/
├── layout.tsx                  # Root layout (nav, footer, fonts)
├── page.tsx                    # Landing: Overview Dashboard
│
├── market/
│   ├── page.tsx                # Market Analysis hub (redirect to first role)
│   └── [role]/
│       └── page.tsx            # Per-role dashboard (skills, salary, resume tips)
│
├── compare/
│   └── page.tsx                # Role comparison view
│
├── jobs/
│   ├── page.tsx                # Job Board with filters
│   └── [id]/
│       └── page.tsx            # Single job detail + company card
│
├── api/
│   ├── jobs/
│   │   ├── route.ts            # GET: list canonical jobs (filters, pagination, search)
│   │   └── [id]/route.ts       # GET: single job detail + company info (v_jobs_full)
│   ├── market/
│   │   ├── route.ts            # GET: latest market snapshot per role
│   │   └── compare/route.ts    # GET: cross-role comparison data
│   └── filters/
│       └── route.ts            # GET: available filter options (industries, locations, etc.)
│
├── lib/
│   └── supabase.ts             # Supabase client init
│
├── components/
│   ├── nav.tsx                 # Top navigation
│   ├── footer.tsx
│   ├── charts/
│   │   ├── bar-chart.tsx       # Reusable bar chart (Chart.js or Recharts)
│   │   ├── pie-chart.tsx
│   │   └── salary-range.tsx    # Salary box/range visualization
│   ├── market/
│   │   ├── skills-table.tsx    # Ranked skills table
│   │   ├── overview-card.tsx   # Role summary card for landing page
│   │   └── resume-tips.tsx     # Must-have / nice-to-have section
│   ├── jobs/
│   │   ├── job-card.tsx        # Job listing card
│   │   ├── job-filters.tsx     # Filter sidebar/bar
│   │   ├── company-card.tsx    # Company info + funding badge
│   │   └── industry-tag.tsx    # Industry tag component
│   └── ui/
│       ├── badge.tsx
│       ├── search.tsx
│       └── skeleton.tsx        # Loading states
│
└── types/
    └── database.ts             # TypeScript types from Supabase schema
```

### 4.2 Navigation

```
┌──────────────────────────────────────────────────────────┐
│  🎯 AIJobRadar     Overview   Market Analysis   Job Board │
└──────────────────────────────────────────────────────────┘
```

- **Overview** (/) — Landing page, 3-role comparison
- **Market Analysis** (/market/[role]) — Skills, salary, resume tips
- **Job Board** (/jobs) — Full job listings with filters

### 4.3 Key Pages Wireframe

**Landing Page (/):**
```
┌──────────────────────────────────────────────────────────┐
│  AIJobRadar — Your AI Career Intelligence                │
│  "Data-driven insights for your next AI role"            │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │ AI PM    │  │AI Engineer│  │   SWE    │               │
│  │          │  │          │  │          │               │
│  │ 300 jobs │  │ 450 jobs │  │ 500 jobs │               │
│  │ $130-180K│  │ $140-200K│  │ $120-190K│               │
│  │ Top: ML  │  │ Top: ML  │  │ Top: Algo│               │
│  │ [View →] │  │ [View →] │  │ [View →] │               │
│  └──────────┘  └──────────┘  └──────────┘               │
│                                                          │
│  ┌────────────────────────────────────────────┐          │
│  │  Cross-Role Skills Comparison (bar chart)  │          │
│  └────────────────────────────────────────────┘          │
│                                                          │
│  ┌────────────────────────────────────────────┐          │
│  │  Salary Comparison by Role (range chart)   │          │
│  └────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────┘
```

**Job Board (/jobs):**
```
┌──────────────────────────────────────────────────────────┐
│  Filters:                                                │
│  [Role ▼] [Work Type ▼] [Industry ▼] [Location ▼]       │
│  [Salary Range ▼] [☑ Startups Only]  [Search...       ]  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────┐          │
│  │ ★ AI Engineer — Anthropic                  │          │
│  │ 🏷 AI/ML · Startup · Remote · $180-250K    │          │
│  │ Series C · $7.3B raised · 1001-5000 emp    │          │
│  │ [View Details]              [Apply →]       │          │
│  └────────────────────────────────────────────┘          │
│                                                          │
│  ┌────────────────────────────────────────────┐          │
│  │ Software Engineer — Stripe                 │          │
│  │ 🏷 Fintech · Scale-up · Hybrid · $150-200K │          │
│  │ Series I · $8.7B raised · 5000+ emp        │          │
│  │ [View Details]              [Apply →]       │          │
│  └────────────────────────────────────────────┘          │
│                                                          │
│  [Load More...]                                          │
└──────────────────────────────────────────────────────────┘
```

---

## 5. Data Pipeline Architecture

### 5.1 Daily Pipeline (Job Board)

```
GitHub Actions (Daily @ UTC 6:00 = PST 10pm)
│
├── 1. Scrape Jobs
│   ├── linkedin_scraper.py   — 3 roles × ~100 new jobs
│   ├── wellfound_scraper.py  — AI PM, AI Engineer, SWE
│   └── yc_scraper.py         — YC Work at a Startup
│
├── 2. GPT Enrichment (enrich.py)
│   For each new job:
│   ├── Extract: hard_skills, soft_skills, tools
│   ├── Extract: salary (raw_min, raw_max, raw_type)
│   ├── Normalize salary: if hourly → × 2080 → salary_annual_*
│   ├── Extract: work_type, seniority, experience_years
│   ├── Label: industry (from predefined enum)
│   └── Label: company_type (from predefined enum)
│
├── 3. Company Resolution (companies.py)
│   ├── Extract domain from company URL → canonical_domain
│   ├── Look up by canonical_domain first, then by alias
│   ├── Create if not exists, update if exists
│   ├── Store source-specific IDs in company_source_ids
│   ├── Funding: only upgrade when new status = 'known'
│   └── Name variants → insert into company_aliases
│
├── 4. Cross-Source Dedup (dedup.py)
│   ├── Match: canonical_domain + title_normalized + location
│   ├── Precedence: richer source wins (more fields filled)
│   ├── Winner = canonical (canonical_job_id = NULL)
│   ├── Losers = canonical_job_id points to winner
│   └── All source records preserved, only canonical shown in UI
│
├── 5. Job Freshness
│   ├── Jobs seen this scrape: update last_seen_at = now()
│   └── Jobs unseen for 7+ days: set is_active = false
│
├── 6. Upsert to Supabase
│   └── INSERT ON CONFLICT (source, source_id) DO UPDATE
│
└── 7. Pipeline Health Alert
    ├── If any source returns 0 jobs → alert (source may be blocked)
    ├── Log: jobs_scraped, jobs_enriched, jobs_deduped per source
    └── Minimum coverage threshold: ≥50 jobs/source or warn
```

### 5.2 Weekly Pipeline (Market Analysis)

```
GitHub Actions (Weekly Sunday @ UTC 8:00)
│
├── 1. Query Supabase: canonical jobs from past 7 days
│   └── WHERE canonical_job_id IS NULL AND is_active = true
│
├── 2. Aggregate per role_category:
│   ├── Skill frequency rankings (hard, soft, tools)
│   ├── Salary stats (using salary_annual_* ONLY, exclude NULLs)
│   │   ├── Average by seniority level
│   │   ├── Top paying companies
│   │   └── Record jobs_with_salary_pct (transparency metric)
│   ├── Work type distribution
│   ├── Experience distribution
│   ├── Top companies, top locations
│   └── Must-have (>30%) & nice-to-have (15-30%) keywords
│
├── 3. Upsert to market_snapshots table
│
└── 4. Generate comparison data cross-role
```

### 5.3 Weekly Health Check

```
GitHub Actions (Weekly Wednesday @ UTC 10:00)
│
├── 1. SELECT all companies WHERE is_active = true
│
├── 2. For each company.website:
│   ├── Try HTTP GET (not HEAD — many sites block HEAD)
│   ├── Classify failure type:
│   │   ├── DNS resolution failed → 'dns'
│   │   ├── TLS/SSL error → 'tls'
│   │   ├── HTTP 4xx → 'http_4xx'
│   │   ├── HTTP 5xx → 'http_5xx'
│   │   └── Timeout (>10s) → 'timeout'
│   ├── 200/301/302 → reset health_warnings = 0
│   └── Any failure → health_warnings += 1, record failure_type
│
├── 3. Deactivation rules (multi-signal):
│   ├── health_warnings >= 3 AND failure_type = 'dns' → deactivate
│   ├── health_warnings >= 5 for other failure types → deactivate
│   └── If company has jobs posted in last 14 days → do NOT deactivate
│       (active hiring = company is alive regardless of website issues)
│
└── 4. Log all results for manual review
```

### 5.4 Scraping Reliability SLOs

| Metric | Threshold | Action |
|--------|-----------|--------|
| Jobs scraped per source per day | ≥ 50 | If below, alert + investigate |
| GPT enrichment success rate | ≥ 90% | If below, check API key / prompt |
| Dedup match rate | Log only | Monitor for sudden spikes (source change) |
| Pipeline completion | < 30 min | If exceeds, check rate limiting |
| Source blocked (0 jobs) | 0 tolerance | Switch to cached data, alert immediately |

---

## 6. API Design

### 6.1 Endpoints (Canonical — single source of truth)

| Endpoint | Method | Description | Params |
|----------|--------|-------------|--------|
| `/api/jobs` | GET | List canonical jobs with filters | `role`, `work_type`, `industry`, `location`, `salary_min`, `salary_max`, `startup_only`, `search`, `limit`, `offset`, `sort` |
| `/api/jobs/[id]` | GET | Single job detail with company info (via v_jobs_full) | — |
| `/api/market` | GET | Latest market snapshot for a role | `role` |
| `/api/market/compare` | GET | All 3 roles' latest snapshots | — |
| `/api/filters` | GET | Distinct values for filter dropdowns | — |

**Note**: Company data is always returned embedded in job responses (via the v_jobs_full view). No separate `/api/companies` endpoint needed — company info card on job detail page uses the same job API response.

### 6.2 Response Examples

**GET /api/jobs?role=AI+Engineer&startup_only=true&limit=20**
```json
{
  "jobs": [
    {
      "id": "uuid",
      "title": "AI Engineer",
      "company_name": "Anthropic",
      "company_logo": "https://...",
      "company_type": "Startup",
      "funding_stage": "Series C",
      "funding_amount_cents": 730000000000,
      "funding_amount_status": "known",
      "company_industry": "AI/ML",
      "location": "San Francisco, CA",
      "work_type": "Hybrid",
      "salary_annual_min": 180000,
      "salary_annual_max": 250000,
      "seniority": "Mid",
      "posted_at": "2026-03-13",
      "apply_url": "https://...",
      "hard_skills": ["Machine Learning", "Deep Learning"],
      "tools": ["Python", "PyTorch"],
      "industry": "AI/ML"
    }
  ],
  "total": 145,
  "limit": 20,
  "offset": 0
}
```

---

## 7. Environment Variables

```bash
# Supabase (Frontend — public)
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Supabase (Backend — secret, for scrapers + API routes)
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres

# OpenAI (for GPT enrichment)
OPENAI_API_KEY=sk-proj-...
```

---

## 8. Deployment

### Vercel
- Auto-deploy on push to `main` branch
- Environment variables set in Vercel dashboard
- Serverless API routes for `/api/*`

### GitHub Actions
- 3 workflows:
  1. `daily-scrape.yml` — Daily job scraping + enrichment
  2. `weekly-analysis.yml` — Weekly market analysis aggregation
  3. `weekly-health-check.yml` — Weekly company health ping

### Supabase
- PostgreSQL database with RLS
- Service role key for write access (scrapers only)
- Anon key for read access (frontend)
