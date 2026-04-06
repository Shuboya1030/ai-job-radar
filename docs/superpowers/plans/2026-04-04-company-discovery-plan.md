# Company Discovery — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pivot AIJobRadar from job-centric to company-centric — new /companies page as core discovery experience, with jobs as highlights within company cards.

**Architecture:** New companies API with hot_score sorting, company list/detail pages, navigation reorder. Database adds founder info + product description + hot_score to companies table. Data enrichment via GPT fills missing company data.

**Tech Stack:** Next.js 14, Supabase, Tailwind CSS, OpenAI (enrichment)

---

## File Structure

### New Files
```
database/migration_company_discovery.sql    — New columns + hot_score function
app/api/companies/route.ts                  — GET: list with filters, hot_score sort
app/api/companies/[id]/route.ts             — GET: detail + jobs + founder
app/companies/page.tsx                      — Company discovery page
app/companies/[id]/page.tsx                 — Company detail page
scrapers/company_enricher.py                — GPT enrichment for descriptions + founders
.github/workflows/company-enrichment.yml    — Weekly enrichment action
```

### Modified Files
```
components/nav.tsx                          — Add Companies tab, reorder
app/page.tsx                                — Update hero to mention companies
```

---

## Chunk 1: Database + API

### Task 1: Database Migration

- [ ] Create `database/migration_company_discovery.sql`
- [ ] Run in Supabase SQL Editor

### Task 2: Companies List API

- [ ] Create `app/api/companies/route.ts` — GET with filters (industry, funding_stage, has_jobs, size), sorted by hot_score, paginated

### Task 3: Company Detail API

- [ ] Create `app/api/companies/[id]/route.ts` — GET with jobs + founder info

### Task 4: Hot Score Calculation

- [ ] Create SQL function or add to migration — calculates hot_score for all companies

## Chunk 2: Frontend

### Task 5: Companies List Page

- [ ] Create `app/companies/page.tsx` — card grid with filters

### Task 6: Company Detail Page

- [ ] Create `app/companies/[id]/page.tsx` — full info + jobs + contact CTA

### Task 7: Navigation Update

- [ ] Modify `components/nav.tsx` — add Companies, reorder

## Chunk 3: Data Enrichment

### Task 8: Company Enricher Script

- [ ] Create `scrapers/company_enricher.py`

### Task 9: GitHub Action

- [ ] Create `.github/workflows/company-enrichment.yml`
