# AIJobRadar — Product Requirement Document

> Version: 0.2
> Author: Shuya Zong
> Date: 2026-03-14
> Status: Discovery (Post Q&A)

---

## 1. Product Overview

**AIJobRadar** is a data-driven platform for AI job seekers, offering two core products:

1. **Market Analysis** — Weekly skill demand intelligence from real job postings, with salary benchmarks and resume optimization guidance
2. **Job Board** — Unified AI job aggregator with full JD, filters, and emphasis on startup coverage

**Brand & Style**: Young, vibrant, simple. Not corporate or overly serious.

**Name**: AIJobRadar

---

## 2. Problem Statement & Pain Points

### Pain Point 1: Skills Blind Spot
"I want to become an AI Engineer — what skills should I learn first?"
- No single place showing skill frequency rankings from real, recent job postings
- Job seekers guess what to put on resumes instead of using data

### Pain Point 2: Salary Opacity
"Which companies pay the most? What's the gap between junior and senior?"
- Salary data exists (Levels.fyi, Glassdoor) but is not combined with real-time skill demand data
- Hard to compare salary by seniority level for specific AI roles

### Pain Point 3: Startup Job Visibility
"I know startups are hiring AI roles, but I can't find them"
- LinkedIn is biased toward big company postings
- Startup jobs are scattered across Wellfound, YC, company career pages, even CEO LinkedIn posts
- Startups are often easier to get offers from but harder to discover

### Pain Point 4: Fragmented Job Search
"I check LinkedIn, Wellfound, YC, and 10 company pages every day"
- No unified entry point for all AI-related job postings across platforms

---

## 3. Target Customer

### Primary: Career Switcher / Upskiller
- Mid-career professionals (2-8 years experience) pivoting to AI roles (SWE -> AI Engineer, PM -> AI PM)
- Actively researching, willing to invest in learning, needs clarity on what to prioritize
- "Show me what the market wants so I can focus my prep"

### Secondary: New Graduate
- CS/Data Science graduates entering the job market
- Overwhelmed by postings, unclear which skills matter most
- "Help me understand which skills to highlight on my resume"

### Note on Career Coaches
Coaches and bootcamp instructors can use the same interface to share market data with students. No separate view needed for MVP — the data is the same, they just share the link.

---

## 4. Key Features (MVP)

### Product 1: Market Analysis

#### F1: Overview Dashboard (Landing Page)
- **What**: First screen users see. Cross-role comparison overview:
  - 3 role cards (AI PM, AI Engineer, Software Engineer) with key stats
  - Side-by-side: top skills, average salary range, job volume
  - Quick visual comparison to help users orient
- **Interaction**: Click any role to drill into detailed dashboard

#### F2: Role-Specific Skills Dashboard
- **What**: For each of the 3 roles, interactive dashboard showing:
  - Top Hard Skills (ranked by % of job postings)
  - Top Soft Skills
  - Top Tools & Technologies
  - Work Type Distribution (Remote / Hybrid / In-Office)
  - Experience Requirements Distribution
  - Top Hiring Companies
  - Top Hiring Locations
- **Data Source**: LinkedIn job postings aggregated weekly (US market)
- **Update Cadence**: Weekly
- **Interaction**: Hover for details, charts with tooltips

#### F3: Salary Intelligence View
- **What**: Per-role salary dimension:
  - **Salary Range by Seniority**: Junior / Mid / Senior / Staff / Principal average salary
  - **Top Paying Companies**: Ranked by average compensation
  - **Salary Distribution**: Overall range visualization
- **Data Source**: Salary ranges extracted from LinkedIn job descriptions via GPT (available in ~75-91% of postings). If a posting has no salary, it's excluded from salary analysis.
- **Note**: No external salary APIs needed for MVP

#### F4: Resume Optimization Section
- **What**: Per-role actionable resume guidance:
  - **Must-Have Keywords** (appear in >30% of JDs): hard skills, soft skills, tools
  - **Nice-to-Have Keywords** (15-30% of JDs)
  - Summary card: "If you're writing a resume for [Role], make sure to include these skills"
- **Use Case**: User preparing/updating resume before applying

#### F5: Role Comparison View
- **What**: Side-by-side comparison of 2-3 roles:
  - Skills overlap (shared vs unique skills)
  - Salary comparison by seniority level
  - Job volume comparison
- **Use Case**: "Should I target AI Engineer or SWE?"

### Product 2: Job Board

#### F6: Full Job Board with Filters
- **What**: Unified listing of all AI-related job postings:
  - Full JD display on the platform (not just links)
  - Search by keyword, role, company
  - Filter by: Role (AI PM / AI Engineer / SWE), Work Type (Remote / Hybrid / On-site), Location, Salary Range, Industry Tag
  - Click through to apply on original source
- **Data Sources (MVP)**: LinkedIn + Wellfound + YC Work at a Startup
- **Update Cadence**: Daily
- **Startup Emphasis**: Visual badge/tag for startup jobs, option to filter "Startups only"

#### F8: Company Funding Info
- **What**: Each job listing shows a company info card with:
  - Funding stage (Seed / Series A / B / C / D+ / Public / Bootstrapped)
  - Total funding amount
  - Last funding date
  - Employee range
  - Industry
- **Data Source (MVP)**: Wellfound + YC profile data (scraped alongside jobs)
- **Backlog**: Growjo API (free) for enrichment. Crunchbase ($50K+/yr) only if revenue justifies.
- **Data Rules**:
  - Funding amount stored as integer (cents), only upgrades allowed (missing ≠ zero)
  - All fields use predefined enums, no free-form GPT output

#### F9: Company Active Status Check
- **What**: Weekly automated health check on all tracked companies
- **Logic**: HTTP HEAD request to company_url
  - 200 → active
  - 301/302 → follow redirect, re-check
  - 404/500/timeout → warning
  - 3 consecutive weekly warnings → mark `is_active = false`, hide from job board
- **Implementation**: GitHub Actions weekly cron job

#### F7: Industry Tag System
- **What**: Every job is auto-tagged by industry based on company business type
- **Predefined Tag List** (GPT must choose from this list only):
  ```
  AI/ML, Fintech, Healthcare, E-commerce, SaaS, Cybersecurity,
  Robotics, EdTech, Adtech, Cloud/Infra, Gaming, Automotive,
  Biotech, Enterprise Software, Social/Media, Other
  ```
- **Implementation**: GPT labels industry during enrichment step. Fixed list prevents inconsistency (no "Healthcare" vs "Health" drift).
- **Interaction**: Filter jobs by industry tag

---

## 5. Key User Journeys

### Journey 1: "What skills do I need?" (Resume Prep)
```
Landing Page (Overview Dashboard) → See 3 roles compared
→ Click into a role (e.g., AI Engineer)
→ View Skills Dashboard (hard skills, tools, soft skills ranked)
→ Scroll to Resume Optimization section
→ See Must-Have and Nice-to-Have keywords
→ Action: Update resume with top keywords
```

### Journey 2: "How much can I earn?" (Salary Exploration)
```
Landing Page → Click into a role → Switch to Salary tab
→ View salary range by seniority level (Junior → Staff)
→ See top-paying companies for this role
→ Action: Set salary expectations / target specific companies
```

### Journey 3: "Which role should I target?" (Role Comparison)
```
Landing Page (already shows cross-role comparison)
→ Click "Compare Roles" for detailed view
→ View side-by-side: skills overlap, salary diff, job volume
→ Action: Decide which role to focus on
```

### Journey 4: "Find jobs to apply" (Job Search)
```
Nav → Job Board tab
→ Filter by role (AI Engineer) + startup + remote
→ Browse full JDs with industry tags
→ Click "Apply" → redirected to original posting
→ Action: Apply to jobs
```

### Journey 5: "Find startup jobs specifically" (Startup Discovery)
```
Nav → Job Board tab → Toggle "Startups" filter
→ See startup-tagged jobs from Wellfound, YC, LinkedIn
→ Filter further by industry (e.g., Healthcare + AI)
→ Click "Apply" → redirected to original posting
```

---

## 6. MVP Scope

### In Scope (MVP v1)
- [ ] Next.js website deployed on Vercel
- [ ] Landing page: Overview dashboard comparing 3 roles
- [ ] 3 roles: AI PM, AI Engineer, Software Engineer
- [ ] Per-role Market Analysis: skills dashboard, salary view, resume optimization
- [ ] Role comparison view
- [ ] Full Job Board with search, filters (role, seniority, work type, location, salary, industry)
- [ ] Industry auto-tagging (predefined list, GPT-labeled)
- [ ] Startup badge/emphasis on job board
- [ ] Data sources: LinkedIn + Wellfound + YC Work at a Startup
- [ ] Supabase for data storage
- [ ] Weekly automated data refresh via GitHub Actions
- [ ] Desktop-first responsive design
- [ ] Push to GitHub, deploy on Vercel

### Out of Scope (MVP → Backlog)
- [ ] User accounts / login
- [ ] Save / favorite jobs
- [ ] Startup founder self-upload job posting (via LinkedIn link submission)
- [ ] CEO LinkedIn post scraping as data source
- [ ] Monetization / paywall (to be discussed)
- [ ] Custom role search (beyond 3 preset roles)
- [ ] Weekly trend tracking / historical data
- [ ] Resume builder / AI resume writer
- [ ] Job application tracking
- [ ] Mobile app

---

## 7. Technical Architecture (MVP)

### Stack
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Data Pipeline**: Python scraper (LinkedIn + Wellfound + YC) → GPT enrichment → Supabase
- **Hosting**: Vercel (auto-deploy from GitHub)
- **Scheduled Jobs**: GitHub Actions (weekly scrape + enrich + push to Supabase)

### Data Pipeline
```
Daily Cron (GitHub Actions) — Job Board
  ├── Scrape LinkedIn (new jobs for 3 roles)
  ├── Scrape Wellfound (AI PM, AI Engineer, SWE)
  ├── Scrape YC Work at a Startup
  ├── GPT Enrichment per job:
  │     ├── Extract: hard skills, soft skills, tools
  │     ├── Extract: salary_min, salary_max, salary_type (annual/hourly)
  │     ├── Extract: work type, experience years
  │     ├── Label: industry tag (from predefined list)
  │     └── Label: company type (Startup / Scale-up / Big Tech / Enterprise)
  ├── Scrape company funding info (Wellfound / YC profiles)
  ├── Deduplicate (same job across sources)
  └── Upsert to Supabase

Weekly Cron (GitHub Actions) — Market Analysis
  ├── Aggregate past 7 days of job data from Supabase
  ├── Compute: skill rankings, salary stats, work type distribution
  ├── Generate: per-role market summary + resume optimization keywords
  └── Update market analysis tables in Supabase
```

### Industry Tag Enforcement
GPT prompt includes:
```
"industry": "MUST be one of: AI/ML, Fintech, Healthcare, E-commerce, SaaS,
Cybersecurity, Robotics, EdTech, Adtech, Cloud/Infra, Gaming, Automotive,
Biotech, Enterprise Software, Social/Media, Other"
```

---

## 8. Success Metrics

| Metric | Target (MVP) |
|--------|-------------|
| Weekly Active Users | 100+ |
| Avg. Session Duration | > 2 min |
| Pages per Session | > 3 |
| Return Visitors (weekly) | > 20% |
| Job Board Click-through Rate | > 10% |

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| LinkedIn scraping blocked | Rate limiting, cache data, multi-source fallback |
| Wellfound/YC structure changes | Modular scrapers, easy to update per-source |
| Salary data incomplete (~75-91% coverage) | Show "N/A" gracefully, aggregate only available data |
| Industry tags inconsistent | Predefined fixed list, GPT constrained selection |
| Role title variations (ML Eng vs AI Eng) | Broad keyword search, GPT-based role normalization |
| Low initial traffic | Launch on LinkedIn, share in career communities |

---

## 10. Open Questions (Resolved)

| Question | Decision |
|----------|----------|
| Salary data source? | Extract from LinkedIn JD via GPT. No external APIs. Empty if unavailable. |
| Show individual listings or aggregated? | Both: Market Analysis = aggregated, Job Board = individual listings |
| Target customer priority? | Career Switcher + New Grad for MVP. Coaches use same interface. |
| Landing page style? | Overview dashboard with cross-role comparison |
| Job Board MVP scope? | Full JD + filters + tags. No save/favorite. No self-upload. |
| Industry tagging consistency? | Predefined fixed list, GPT constrained to list only |
| Brand style? | Young, vibrant, simple |
