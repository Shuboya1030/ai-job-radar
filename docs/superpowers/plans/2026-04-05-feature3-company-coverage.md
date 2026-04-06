# Feature 3: Company Coverage — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand company database from 629 to 800+ with user suggestion form and automated discovery from Product Hunt + Crunchbase RSS.

**Architecture:** New company_suggestions table + suggest form page + admin review tab. Expand company_discovery.py with Product Hunt and Crunchbase RSS feeds. GPT generates product_description for new companies.

**Tech Stack:** Next.js 14, Supabase, Python (scrapers), OpenAI GPT-4o-mini

**Spec:** `docs/superpowers/specs/2026-04-05-platform-pivot-design.md`

---

## File Structure

### New Files
```
database/migration_company_suggestions.sql     — company_suggestions table
app/api/companies/suggest/route.ts             — POST: submit suggestion
app/api/admin/suggestions/route.ts             — GET/POST: admin review
app/companies/suggest/page.tsx                 — User suggestion form
```

### Modified Files
```
scrapers/company_discovery.py                  — Add Product Hunt + Crunchbase RSS
app/admin/page.tsx                             — Add Suggestions tab
```

---

## Chunk 1: Database + User Suggestion API

### Task 1: Migration

**Files:**
- Create: `database/migration_company_suggestions.sql`

- [ ] **Step 1: Write migration**

```sql
CREATE TABLE IF NOT EXISTS company_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id),
    company_name TEXT NOT NULL,
    website TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE company_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own suggestions" ON company_suggestions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own suggestions" ON company_suggestions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 2: Run in Supabase SQL Editor**
- [ ] **Step 3: Commit**

### Task 2: Suggestion API Route

**Files:**
- Create: `app/api/companies/suggest/route.ts`

- [ ] **Step 1: Create POST route** — accepts { company_name, website, reason }, requires auth, inserts into company_suggestions
- [ ] **Step 2: Verify** — `curl -X POST /api/companies/suggest` returns 401 without auth
- [ ] **Step 3: Commit**

### Task 3: Admin Suggestions API

**Files:**
- Create: `app/api/admin/suggestions/route.ts`

- [ ] **Step 1: Create GET (list pending) + POST (approve/reject)** — password-gated like other admin routes
- [ ] **Step 2: On approve**: create company in companies table with name + website + is_active=true
- [ ] **Step 3: Commit**

---

## Chunk 2: Frontend

### Task 4: Suggestion Form Page

**Files:**
- Create: `app/companies/suggest/page.tsx`

- [ ] **Step 1: Create page** — form with company_name, website, reason fields. Requires login. Shows success message after submit.
- [ ] **Step 2: Verify** — navigate to `/companies/suggest`, submit form
- [ ] **Step 3: Commit**

### Task 5: Admin Suggestions Tab

**Files:**
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Add 'Suggestions' tab** to existing admin dashboard
- [ ] **Step 2: Show pending suggestions** with Approve/Reject buttons
- [ ] **Step 3: Commit**

### Task 6: Add "Suggest a Company" Link

**Files:**
- Modify: `app/companies/page.tsx`

- [ ] **Step 1: Add link** at top of companies page: "Know a great AI startup? Suggest it →"
- [ ] **Step 2: Commit**

---

## Chunk 3: Discovery Expansion

### Task 7: Add Product Hunt + Crunchbase RSS to Discovery

**Files:**
- Modify: `scrapers/company_discovery.py`

- [ ] **Step 1: Add Product Hunt AI RSS** — `https://www.producthunt.com/feed?category=artificial-intelligence` (or API)
- [ ] **Step 2: Add Crunchbase News RSS** — `https://news.crunchbase.com/feed/`
- [ ] **Step 3: GPT filters** for AI-only companies (reuse existing AI keyword filtering)
- [ ] **Step 4: Verify** — run locally: `python company_discovery.py`
- [ ] **Step 5: Commit**
