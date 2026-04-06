# Feature 2: News Board — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI startup news feed with sidebar + dedicated page + weekly email digest to improve retention (93% → 15% return visitors).

**Architecture:** New news_items table populated by RSS scraper (TechCrunch, Crunchbase, Product Hunt). News page + sidebar component. Weekly email via Resend for subscribers.

**Tech Stack:** Next.js 14, Supabase, Python (RSS scraper + GPT), Resend (email), Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-04-05-platform-pivot-design.md`

---

## File Structure

### New Files
```
database/migration_news.sql                    — news_items + news_subscriptions tables
app/api/news/route.ts                          — GET: list news with filters
app/api/news/subscribe/route.ts                — POST/DELETE: manage subscription
app/news/page.tsx                              — News feed page
components/news-sidebar.tsx                    — Compact sidebar widget
scrapers/news_scraper.py                       — RSS fetch + GPT summarize
.github/workflows/weekly-news-digest.yml       — Weekly email action
scripts/send-news-digest.js                    — Email sending script
```

### Modified Files
```
components/nav.tsx                             — Add News link
app/layout.tsx                                 — (optional) Add sidebar to layout
app/companies/page.tsx                         — Add sidebar
scrapers/main.py                               — Add news_scraper to pipeline
```

---

## Chunk 1: Database + News API

### Task 1: Migration

**Files:**
- Create: `database/migration_news.sql`

- [ ] **Step 1: Write migration**

```sql
CREATE TABLE IF NOT EXISTS news_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    summary TEXT,
    source_url TEXT NOT NULL,
    source_name TEXT NOT NULL,
    industry_tags JSONB DEFAULT '[]',
    event_type TEXT CHECK (event_type IN ('funding', 'launch', 'acquisition', 'milestone', 'other')),
    company_name TEXT,
    company_id UUID REFERENCES companies(id),
    image_url TEXT,
    published_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(source_url)
);

CREATE INDEX idx_news_published ON news_items(published_at DESC);
CREATE INDEX idx_news_event_type ON news_items(event_type);

CREATE TABLE IF NOT EXISTS news_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    industry_tags JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now(),
    last_sent_at TIMESTAMPTZ,
    UNIQUE(user_id)
);

ALTER TABLE news_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own news sub" ON news_subscriptions
    FOR ALL USING (auth.uid() = user_id);
```

- [ ] **Step 2: Run in Supabase SQL Editor**
- [ ] **Step 3: Commit**

### Task 2: News List API

**Files:**
- Create: `app/api/news/route.ts`

- [ ] **Step 1: Create GET route** — list news_items with filters (event_type, industry), sorted by published_at DESC, paginated
- [ ] **Step 2: Commit**

### Task 3: News Subscribe API

**Files:**
- Create: `app/api/news/subscribe/route.ts`

- [ ] **Step 1: Create POST (subscribe) + DELETE (unsubscribe)** — requires auth, upserts news_subscriptions
- [ ] **Step 2: Commit**

---

## Chunk 2: News Scraper

### Task 4: RSS Scraper + GPT Summarizer

**Files:**
- Create: `scrapers/news_scraper.py`

- [ ] **Step 1: Fetch TechCrunch RSS** — parse entries, extract title + link + published date
- [ ] **Step 2: Fetch Crunchbase News RSS** — same pattern
- [ ] **Step 3: GPT summarize + tag** — for each entry, call GPT-4o-mini: generate summary (2-3 sentences), industry_tags, event_type
- [ ] **Step 4: Link to companies** — match company_name against existing companies table
- [ ] **Step 5: Insert** — upsert into news_items (dedup by source_url)
- [ ] **Step 6: Verify** — run locally: `python news_scraper.py`
- [ ] **Step 7: Commit**

### Task 5: Add to Pipeline

**Files:**
- Modify: `scrapers/main.py`

- [ ] **Step 1: Import and call news_scraper** after company discovery step
- [ ] **Step 2: Commit**

---

## Chunk 3: Frontend

### Task 6: News Page

**Files:**
- Create: `app/news/page.tsx`

- [ ] **Step 1: Create page** — news list with event type badges (funding=green, launch=blue, acquisition=amber), industry tag pills, source attribution, relative time. Filter by event type + industry. Subscribe button for logged-in users.
- [ ] **Step 2: Use frontend-design skill** for visual design
- [ ] **Step 3: Verify** — navigate to `/news`
- [ ] **Step 4: Commit**

### Task 7: Sidebar Component

**Files:**
- Create: `components/news-sidebar.tsx`

- [ ] **Step 1: Create compact widget** — latest 5 headlines with relative time, "See all →" link
- [ ] **Step 2: Add to companies page** as right sidebar
- [ ] **Step 3: Commit**

### Task 8: Navigation

**Files:**
- Modify: `components/nav.tsx`

- [ ] **Step 1: Add "News" link** between Jobs and Skills
- [ ] **Step 2: Commit**

---

## Chunk 4: Weekly Email

### Task 9: Email Digest Script

**Files:**
- Create: `scripts/send-news-digest.js`

- [ ] **Step 1: Query subscribers** with news_subscriptions
- [ ] **Step 2: For each subscriber** — get top 10 news from past week matching their industry_tags
- [ ] **Step 3: Send via Resend** — HTML email with news items
- [ ] **Step 4: Update last_sent_at**
- [ ] **Step 5: Commit**

### Task 10: GitHub Action

**Files:**
- Create: `.github/workflows/weekly-news-digest.yml`

- [ ] **Step 1: Create workflow** — runs Monday 8am UTC, calls `node scripts/send-news-digest.js`
- [ ] **Step 2: Commit**
