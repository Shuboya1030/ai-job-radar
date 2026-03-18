# Architecture Design: User System + Email Subscription + Saved Jobs

> Version: 1.0
> Date: 2026-03-18
> Status: Draft

---

## 1. System Overview

```
┌──────────────────────────────────────────────────────────┐
│                    User (Browser)                         │
│                                                           │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Sign In │  │ Set      │  │ Save     │  │ Browse   │  │
│  │ Google  │  │ Alerts   │  │ Jobs     │  │ Jobs     │  │
│  └────┬────┘  └────┬─────┘  └────┬─────┘  └──────────┘  │
└───────┼────────────┼─────────────┼───────────────────────┘
        │            │             │
        ▼            ▼             ▼
┌──────────────────────────────────────────────────────────┐
│                   Next.js App                             │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Supabase Auth│  │ /api/alerts  │  │ /api/saved-jobs│  │
│  │ (Google OAuth│  │ CRUD filters │  │ save/unsave    │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬────────┘  │
└─────────┼─────────────────┼──────────────────┼───────────┘
          │                 │                  │
          ▼                 ▼                  ▼
┌──────────────────────────────────────────────────────────┐
│                      Supabase                             │
│                                                           │
│  auth.users ──→ user_profiles ──→ subscriptions           │
│                                ──→ saved_jobs             │
│                                ──→ page_views (user_id)   │
│                                                           │
│  jobs ──→ matched via subscription filters                │
└──────────────────────────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────────┐
│              Email Pipeline (GitHub Actions)               │
│              Daily @ UTC 7:00 (after scrape)               │
│                                                           │
│  1. Query subscriptions with active users                 │
│  2. For each subscription: find new matching jobs         │
│  3. Render HTML email with job cards                      │
│  4. Send via Resend API                                   │
│  5. Update last_sent_at                                   │
└──────────────────────────────────────────────────────────┘
```

## 2. Database Schema

### 2.1 New Tables

```sql
-- ═══════════════════════════════════════════
-- USER PROFILES (extends Supabase auth.users)
-- ═══════════════════════════════════════════
CREATE TABLE user_profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  name            TEXT,
  avatar_url      TEXT,
  visitor_id      TEXT,          -- link to anonymous analytics
  email_verified  BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_user_profiles_visitor ON user_profiles(visitor_id);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);

-- ═══════════════════════════════════════════
-- SUBSCRIPTIONS (email alert preferences)
-- ═══════════════════════════════════════════
CREATE TABLE subscriptions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  name            TEXT DEFAULT 'My Alert',    -- user can name their alert
  roles           JSONB DEFAULT '[]',         -- ["AI PM", "AI Engineer"]
  industries      JSONB DEFAULT '[]',         -- ["AI/ML", "Fintech"]
  funding_stages  JSONB DEFAULT '[]',         -- ["Seed", "Series A"]
  work_types      JSONB DEFAULT '[]',         -- ["Remote", "Hybrid"]
  frequency       TEXT DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly')),
  is_active       BOOLEAN DEFAULT true,
  last_sent_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_active ON subscriptions(is_active) WHERE is_active = true;

-- ═══════════════════════════════════════════
-- SAVED JOBS
-- ═══════════════════════════════════════════
CREATE TABLE saved_jobs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  job_id          UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, job_id)
);

CREATE INDEX idx_saved_jobs_user ON saved_jobs(user_id);

-- ═══════════════════════════════════════════
-- NOTIFICATION LOG (track what was sent)
-- ═══════════════════════════════════════════
CREATE TABLE notification_log (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL,
  jobs_matched    INTEGER,
  jobs_sent       JSONB,        -- [{job_id, title, company}]
  sent_at         TIMESTAMPTZ DEFAULT now(),
  resend_id       TEXT          -- Resend API response ID
);

CREATE INDEX idx_notification_log_sub ON notification_log(subscription_id);
CREATE INDEX idx_notification_log_sent ON notification_log(sent_at DESC);
```

### 2.2 Schema Modifications

```sql
-- Add user_id to page_views for analytics merge
ALTER TABLE page_views ADD COLUMN user_id UUID REFERENCES user_profiles(id);
CREATE INDEX idx_page_views_user ON page_views(user_id);

-- RLS policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own data
CREATE POLICY "Users read own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users manage own subscriptions" ON subscriptions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own saved jobs" ON saved_jobs
  FOR ALL USING (auth.uid() = user_id);

-- Service role can read all (for email pipeline)
CREATE POLICY "Service read all subscriptions" ON subscriptions
  FOR SELECT USING (true);
CREATE POLICY "Service read all notification_log" ON notification_log
  FOR ALL USING (true);
```

## 3. Authentication Flow

```
User clicks "Sign in with Google"
  → Supabase Auth: redirect to Google OAuth consent
  → Google: user grants access
  → Supabase Auth: creates auth.users record, returns session JWT
  → Next.js: onAuthStateChange callback fires
  → Client: check if user_profiles record exists
    → No: create user_profiles with Google name/email/avatar + visitor_id from localStorage
    → Yes: update visitor_id if different (device switch)
  → Client: backfill page_views.user_id WHERE visitor_id = current visitor_id
  → Nav: show avatar + dropdown menu
```

### Supabase Client Setup

```typescript
// lib/supabase-auth.ts
import { createBrowserClient } from '@supabase/ssr'

export const supabaseAuth = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)
```

## 4. API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/auth/callback` | GET | — | Google OAuth callback handler |
| `/api/subscriptions` | GET | User | List user's subscriptions |
| `/api/subscriptions` | POST | User | Create new subscription |
| `/api/subscriptions/[id]` | PUT | User | Update subscription filters/frequency |
| `/api/subscriptions/[id]` | DELETE | User | Delete subscription |
| `/api/saved-jobs` | GET | User | List user's saved jobs |
| `/api/saved-jobs` | POST | User | Save a job {job_id} |
| `/api/saved-jobs/[job_id]` | DELETE | User | Unsave a job |

## 5. Email Pipeline

### 5.1 Matching Logic

```python
# For each active subscription:
# 1. Get filter criteria
roles = subscription.roles           # e.g. ["AI Engineer"]
industries = subscription.industries # e.g. ["AI/ML", "Fintech"]
funding = subscription.funding_stages # e.g. ["Seed", "Series A"]
work_types = subscription.work_types  # e.g. ["Remote"]

# 2. Query new jobs since last_sent_at
query = supabase.from('v_jobs_full')
  .select('*')
  .gt('scraped_at', subscription.last_sent_at)
  .eq('is_active', True)
  .is_('canonical_job_id', None)

# 3. Apply filters (only if set — empty array = all)
if roles:     query = query.in_('role_category', roles)
if industries: query = query.in_('industry', industries)
if funding:   query = query.in_('funding_stage', funding)
if work_types: query = query.in_('work_type', work_types)
```

### 5.2 Send Schedule

```
GitHub Actions: send-notifications.yml
Cron: daily @ UTC 7:00 (1 hour after daily scrape)

1. Query all active subscriptions
2. For daily subscribers: send if new matches since last_sent_at
3. For weekly subscribers: send only on Monday
4. For each: render HTML email, send via Resend, log to notification_log
5. Update subscription.last_sent_at
```

### 5.3 Email Template

HTML card layout per job:
```
┌─────────────────────────────────────────────┐
│  Anthropic                    Series C · $7B │
│  ─────────────────────────────────────────── │
│  AI Research Engineer                        │
│  $180K–$250K · Remote · AI/ML                │
│                            [View Job →]      │
└─────────────────────────────────────────────┘
```

Header: "X new jobs matching your alert '{subscription.name}'"
Footer: "Manage preferences" link + "Unsubscribe" link

## 6. Frontend Pages

### 6.1 New Pages
- `/settings` — Manage subscriptions + account (accessible from nav dropdown)
- `/saved` — Saved jobs list

### 6.2 Modified Components
- `nav.tsx` — Add Sign In button / avatar dropdown
- Job cards (jobs/page.tsx, jobs/[id]/page.tsx) — Add save/bookmark button
- `analytics.tsx` — Send user_id with page views when logged in
- `admin/page.tsx` — Update retention to use user_id when available

## 7. Environment Variables (new)

```bash
# Resend email service
RESEND_API_KEY=re_xxxx

# Supabase Auth (already have URL + anon key)
# Google OAuth configured in Supabase dashboard, not in env
```

## 8. Third-Party Setup Required

1. **Supabase Dashboard**: Enable Google OAuth provider
   - Go to Authentication → Providers → Google
   - Add Google Client ID + Secret (from Google Cloud Console)
   - Set redirect URL: `https://aistartupjob.com/api/auth/callback`

2. **Google Cloud Console**: Create OAuth credentials
   - Create project → OAuth consent screen → Credentials → OAuth 2.0 Client
   - Authorized redirect URI: `https://qeufiilyqvxzpohegoor.supabase.co/auth/v1/callback`

3. **Resend**: Create account + API key
   - Verify sending domain: aistartupjob.com
   - Get API key for RESEND_API_KEY
