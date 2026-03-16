# AIJobRadar Agent Architecture — Design Spec

> Date: 2026-03-15
> Status: Draft

## Problem

The current data pipeline (GitHub Actions) is stable but dumb:
- Only scrapes 3 hardcoded sources (LinkedIn, YC, Greenhouse/Lever)
- Can't discover new data sources (company career pages with custom URLs)
- Can't adapt when a scraper breaks
- Funding data coverage is 40% — needs to be >50%
- No ground truth traceability for data
- No intelligent company quality assessment

## Solution

A single Claude Agent that acts as the **full pipeline manager**. It reads the current state of the database, decides what to do, and executes using a set of tools. GitHub Actions remains as a reliable fallback for stable bulk operations (LinkedIn scraping).

## Success Criteria

1. **Funding coverage > 50%** with admin dashboard tracking
2. **Field-level source traceability** — every funding amount and job posting has a `source_url` pointing to the original page. Visible only in admin dashboard.
3. **Company liveness monitoring** — passive detection: website down + no new jobs for 30 days = flagged for review

## Architecture

### Single Agent + N Tools

```
┌────────────────────────────────────────────────┐
│              Claude Agent (daily)               │
│                                                 │
│  System Prompt:                                 │
│  - Planning skill (decide today's priorities)   │
│  - Success criteria awareness                   │
│  - Data quality rules                           │
│  - Source traceability requirement              │
├────────────────────────────────────────────────┤
│  Tools:                                         │
│                                                 │
│  ┌─────────────────┐  ┌──────────────────────┐ │
│  │ supabase_query  │  │ trigger_github_action │ │
│  │ Read/write DB   │  │ Trigger GH workflow   │ │
│  └─────────────────┘  └──────────────────────┘ │
│  ┌─────────────────┐  ┌──────────────────────┐ │
│  │ web_search      │  │ web_fetch            │ │
│  │ Search internet │  │ Read any webpage     │ │
│  └─────────────────┘  └──────────────────────┘ │
│  ┌─────────────────┐  ┌──────────────────────┐ │
│  │ run_python      │  │ check_health         │ │
│  │ Execute scripts │  │ HTTP ping company    │ │
│  └─────────────────┘  └──────────────────────┘ │
└────────────────────────────────────────────────┘
         │                        │
         ▼                        ▼
┌──────────────┐        ┌─────────────────┐
│   Supabase   │        │ GitHub Actions  │
│  (shared DB) │        │ (bulk scraping) │
└──────────────┘        └─────────────────┘
```

### Agent Decision Loop

Each run, the Agent follows this priority order:

```
1. READ STATE
   - Query: total companies, funding coverage %, recent failures
   - Query: last run timestamp, any stale data alerts

2. DECIDE PRIORITIES (planning skill)
   If funding_coverage < 50%:
     → Priority 1: Find funding data for unknown companies
   If new_companies_this_week < 5:
     → Priority 2: Discover new AI startups from news
   Always:
     → Priority 3: Run daily job scrape (trigger GH Action)
     → Priority 4: Check company health (passive)

3. EXECUTE (in priority order)
   For each task:
     - Use appropriate tools
     - Record source_url for every data write
     - Log actions to agent_runs table

4. REPORT
   - Update coverage metrics
   - Write run summary to agent_runs table
```

### Tools Specification

#### 1. supabase_query
- **Purpose**: Read/write Supabase database
- **Input**: SQL query or table operation
- **Output**: Query results
- **Used for**: Check coverage stats, write new companies/jobs, update funding, log agent runs
- **Auth**: SUPABASE_SERVICE_ROLE_KEY

#### 2. trigger_github_action
- **Purpose**: Trigger existing GitHub Actions workflows
- **Input**: workflow name, optional inputs
- **Output**: Run ID + status
- **Used for**: Trigger daily-scrape (LinkedIn bulk), weekly-analysis
- **Why**: LinkedIn scraping is stable and high-volume — more cost-effective as a script than Agent web_fetch

#### 3. web_search
- **Purpose**: Search the internet
- **Input**: Search query string
- **Output**: Search results (titles, URLs, snippets)
- **Used for**:
  - Discover new AI startups: "AI startup funding 2026"
  - Find company career pages: "{company name} careers jobs"
  - Check company status: "{company name} acquired shutdown"
  - Find funding data: "{company name} funding round series"

#### 4. web_fetch
- **Purpose**: Fetch and read any webpage
- **Input**: URL
- **Output**: Page content (rendered text)
- **Used for**:
  - Read company career pages (any structure, not just Greenhouse/Lever)
  - Read Growjo company pages for funding data
  - Read news articles for funding details
  - Read company "About" pages for industry/description
- **Key advantage**: Agent can understand ANY webpage layout, not just predefined templates

#### 5. run_python
- **Purpose**: Execute existing Python scripts
- **Input**: Script path + arguments
- **Output**: Script output
- **Used for**:
  - `enrichment.py` — GPT skill/salary extraction (cheaper via OpenAI than Claude)
  - `dedup.py` — Cross-source deduplication
  - `weekly_analysis.py` — Market snapshot generation
  - `health_check.py` — Bulk company website checks
- **Why not Agent**: These are deterministic, high-volume operations better done by scripts

#### 6. check_health
- **Purpose**: HTTP GET a URL to check if site is alive
- **Input**: URL
- **Output**: status_code, response_time, error_type
- **Used for**: Quick company website liveness check during Agent run

### Database Changes

#### New table: `agent_runs`
```sql
CREATE TABLE agent_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT CHECK (status IN ('running', 'completed', 'failed')),
  summary JSONB,  -- {companies_discovered, funding_updated, jobs_found, errors}
  actions_log JSONB,  -- [{action, target, result, source_url, timestamp}]
  funding_coverage_pct NUMERIC,
  total_companies INTEGER,
  total_active_jobs INTEGER
);
```

#### Schema additions for traceability
```sql
-- Add source_url fields to companies table
ALTER TABLE companies ADD COLUMN funding_source_url TEXT;
ALTER TABLE companies ADD COLUMN funding_updated_at TIMESTAMPTZ;
ALTER TABLE companies ADD COLUMN discovered_via TEXT;  -- 'techcrunch', 'web_search', 'linkedin', etc.

-- Jobs already have apply_url (original source link)
-- Add source_url for the page where we found the listing
ALTER TABLE jobs ADD COLUMN listing_source_url TEXT;
```

#### Admin dashboard additions
- Funding coverage gauge: X/Y companies (Z%)
- Agent run history: last 30 runs with status/summary
- Source breakdown: how many companies discovered via each channel
- Traceability view: for any company, show funding_source_url

### Agent System Prompt (summary)

```
You are the AIJobRadar data pipeline agent.

Your job: maintain a high-quality database of AI startup job postings and company data.

SUCCESS CRITERIA:
1. Funding coverage must stay above 50%. Currently: {current_pct}%
2. Every piece of data must have a source_url. Never fabricate data.
3. Flag companies that appear dead (website down + no jobs for 30 days).

PRIORITY ORDER each run:
1. If funding_coverage < 50%: focus on finding funding data
2. Discover new AI startups (search news, funding announcements)
3. For new/unfunded companies: search for their careers page, extract job listings
4. Trigger GitHub Action for bulk LinkedIn/YC scraping
5. Run dedup and cleanup scripts
6. Report: update metrics, log actions

RULES:
- Always record source_url when writing data
- For funding: prefer Growjo, then news articles, then company website
- For jobs: prefer company career page, then LinkedIn, then YC
- If a company website has been down for 3+ consecutive checks, flag it
- Use run_python for high-volume operations (enrichment, dedup)
- Use web_fetch for reading individual pages
- Use web_search for discovery and verification
```

### Implementation Plan

1. **DB migrations**: Add agent_runs table, add source_url columns
2. **Agent tools**: Implement 6 tools as Python functions callable by Claude Agent SDK
3. **Agent script**: Main entry point using Claude Agent SDK, system prompt, tool bindings
4. **Admin dashboard updates**: Coverage gauge, run history, traceability view
5. **GitHub Actions workflow**: Trigger agent daily (or agent triggers GH Actions)
6. **Tests**: Tool unit tests, mock agent run test

### Cost Estimate

| Component | Daily Cost |
|-----------|-----------|
| Claude Agent reasoning (~50-80K tokens) | $2-4 |
| web_search (~20 searches) | $0 (via tool) |
| web_fetch (~50 pages) | $0.50-1 (tokens to read pages) |
| OpenAI GPT-4o-mini (job enrichment) | $0.50-1 |
| GitHub Actions compute | Free tier |
| **Total** | **$3-6/day** |

### Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| Agent makes wrong decisions | Agent logs all actions; admin can review in dashboard |
| Agent fabricates data | System prompt explicitly forbids; source_url required for all writes |
| Agent costs spike | Token budget cap in Agent SDK; fallback to GH Actions if over budget |
| Cloudflare blocks web_fetch | Agent can try alternative sources; Growjo is one of many options |
| Agent run fails midway | agent_runs table tracks status; next run picks up where left off |
