# AIJobRadar

Data-driven platform for AI job seekers: market analysis + unified job board.

**Live**: https://ai-job-radar.vercel.app

## Key URLs

| URL | Purpose |
|-----|---------|
| https://ai-job-radar.vercel.app | Production site |
| https://ai-job-radar.vercel.app/admin | Admin dashboard (password: see .env.local `ADMIN_PASSWORD`) |
| https://github.com/Shuboya1030/ai-job-radar | GitHub repo |
| https://supabase.com/dashboard/project/qeufiilyqvxzpohegoor | Supabase dashboard |

## Tech Stack

- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Database**: Supabase (PostgreSQL) — project ref: `qeufiilyqvxzpohegoor`
- **Hosting**: Vercel — project: `prj_5J2oCc6dj9wBKkGyxOOEAxaD8bEn`
- **Scrapers**: Python 3.11 + Playwright + BeautifulSoup
- **AI Enrichment**: OpenAI GPT-4o-mini
- **Automation**: GitHub Actions (4 workflows)

## Automated Workflows

| Workflow | Schedule | What it does |
|----------|----------|-------------|
| Daily Scrape | Every day UTC 6:00 | LinkedIn + YC + Career Pages + Company Discovery + Dedup |
| Weekly Analysis | Sunday UTC 8:00 | Market snapshots (skill rankings, salary stats) |
| Weekly Health Check | Wednesday UTC 10:00 | Company website alive check |
| Weekly Funding | Monday UTC 12:00 | Growjo funding data enrichment (Playwright stealth) |

All can be manually triggered from GitHub Actions tab.

## Data Sources

| Source | Method | Data |
|--------|--------|------|
| LinkedIn | Guest API scraping | Jobs (3 roles × 100/day) |
| YC Work at a Startup | Playwright stealth | Startup jobs |
| Greenhouse/Lever | HTTP scraping career pages | Startup jobs |
| TechCrunch RSS | RSS feeds (Venture/Fundraising/AI) | New AI companies |
| Growjo | Playwright stealth | Company funding data |

## Environment Variables

See `.env.example` for all required variables. Actual values in `.env.local` (gitignored).

**GitHub Actions secrets** (set via `gh secret set`):
- `OPENAI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

**Vercel env vars**: set in Vercel dashboard (same as above + `ADMIN_PASSWORD`).

## Database

Schema in `database/schema.sql`. Key tables:
- `companies` — 215+ companies with funding data
- `jobs` — 365+ active jobs from 4 sources
- `market_snapshots` — weekly aggregated skill/salary analysis
- `page_views` — analytics tracking
- `company_aliases` / `company_source_ids` — cross-source identity

## Project Structure

```
app/                    # Next.js pages + API routes
  page.tsx              # Landing page (overview dashboard)
  market/[role]/        # Per-role market analysis
  jobs/                 # Job board
  jobs/[id]/            # Job detail
  companies/            # Company browse (hidden from nav)
  compare/              # Role comparison
  admin/                # Admin dashboard (password protected)
  api/                  # API routes

components/             # React components
  charts/               # Recharts bar/pie/salary charts
  nav.tsx, footer.tsx   # Layout
  analytics.tsx         # Page view tracking

scrapers/               # Python data pipeline
  main.py               # Orchestrator (runs all sources)
  linkedin_scraper.py   # LinkedIn guest API
  yc_scraper.py         # YC Work at a Startup (Playwright)
  career_page_scraper.py # Greenhouse/Lever/Ashby
  enrichment.py         # GPT skill/salary extraction
  company_manager.py    # Domain-based company resolution
  company_discovery.py  # TechCrunch RSS → new AI companies
  growjo_enricher.py    # Funding data from Growjo (Playwright stealth)
  dedup.py              # Cross-source deduplication
  db.py                 # Supabase writer
  health_check.py       # Company website health check
  weekly_analysis.py    # Market snapshot aggregation
  config.py             # Enums, roles, settings
  tests/                # Unit tests (40 tests)

database/
  schema.sql            # Full Supabase schema

.github/workflows/      # 4 automated workflows
```

## Running Locally

```bash
# Frontend
npm install
npm run dev

# Scrapers (from scrapers/ directory)
pip install -r requirements.txt
python main.py                    # Full pipeline
python main.py --skip-linkedin    # Skip LinkedIn, run YC + careers only
python growjo_enricher.py         # Funding enrichment
python weekly_analysis.py         # Market analysis
python health_check.py            # Company health check

# Tests
cd scrapers && python -m pytest tests/ -v
```

## Docs

- `PRD.md` — Product requirements
- `DESIGN.md` — Architecture design
- `IMPLEMENTATION_PLAN.md` — Task breakdown
- `BACKLOG.md` — Future features backlog
