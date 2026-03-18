# Implementation Plan: User System + Email Subscription + Saved Jobs

> Date: 2026-03-18
> Depends on: PRD + Design spec from same date

---

## Phase 0: Third-Party Setup (manual, no code)

### T-01: Google OAuth Credentials
- Go to Google Cloud Console → Create project "AIJobRadar"
- Configure OAuth consent screen (external, production)
- Create OAuth 2.0 Client ID
- Authorized redirect URI: `https://qeufiilyqvxzpohegoor.supabase.co/auth/v1/callback`
- Save Client ID + Client Secret
- **Output**: Google OAuth credentials

### T-02: Supabase Auth Configuration
- Supabase Dashboard → Authentication → Providers → Google → Enable
- Paste Google Client ID + Secret
- Verify redirect URL is set
- **Output**: Google sign-in working in Supabase

### T-03: Resend Account + Domain
- Create account at resend.com
- Add sending domain: aistartupjob.com (add DNS records for verification)
- Generate API key
- Add `RESEND_API_KEY` to .env.local and Vercel env vars
- **Output**: Verified sending domain + API key

---

## Phase 1: Database Schema

### T-04: Run Schema Migrations
- Create tables: user_profiles, subscriptions, saved_jobs, notification_log
- Add user_id column to page_views
- Set up RLS policies
- Create indexes
- **File**: `database/migration_user_system.sql`
- **Run via**: Supabase Management API (same as previous migrations)

---

## Phase 2: Authentication (Frontend)

### T-05: Supabase Auth Client Setup
- Install `@supabase/ssr` package
- Create `lib/supabase-auth.ts` with browser client
- Create `lib/supabase-server.ts` with server client (for API routes)
- Create auth context provider component
- **Files**: `lib/supabase-auth.ts`, `lib/supabase-server.ts`, `components/auth-provider.tsx`

### T-06: Sign In / Sign Out UI
- Update `components/nav.tsx`:
  - Unauthenticated: "Sign In" button (lime accent)
  - Authenticated: avatar circle + dropdown menu
  - Dropdown items: My Alerts, Saved Jobs, Sign Out
- Create `app/api/auth/callback/route.ts` for OAuth callback
- **Files**: `components/nav.tsx`, `app/api/auth/callback/route.ts`

### T-07: User Profile Creation on First Login
- In auth provider: listen to `onAuthStateChange`
- On `SIGNED_IN`: check if user_profiles record exists
  - No: create with Google data + localStorage visitor_id
  - Yes: update visitor_id if needed
- Backfill page_views.user_id for matching visitor_id
- **File**: `components/auth-provider.tsx`

---

## Phase 3: Email Subscriptions

### T-08: Subscription API Routes
- `GET /api/subscriptions` — list user's subscriptions (auth required)
- `POST /api/subscriptions` — create new subscription with filter criteria
- `PUT /api/subscriptions/[id]` — update filters or frequency
- `DELETE /api/subscriptions/[id]` — delete subscription
- All routes verify auth via Supabase session
- **Files**: `app/api/subscriptions/route.ts`, `app/api/subscriptions/[id]/route.ts`

### T-09: Subscription Settings UI
- Create `/settings` page
- Form: multi-select dropdowns for role, industry, funding stage, work type
- Frequency toggle: daily / weekly
- List existing subscriptions with edit/delete
- "Create Alert" button
- **Files**: `app/settings/page.tsx`

### T-10: Email Template
- Install `resend` + `@react-email/components` packages
- Create HTML email template with job cards
- Template vars: user name, subscription name, matched jobs list
- Each job card: company + funding badge, title, salary, tags, "View Job" link
- Footer: manage preferences link, unsubscribe link
- **Files**: `emails/job-alert.tsx`

### T-11: Email Send Script
- Python script that runs after daily scrape
- For each active subscription:
  - Check frequency (daily → send every day, weekly → send on Monday)
  - Query new jobs matching filters since last_sent_at
  - If matches > 0: render email, send via Resend API, log to notification_log
  - Update last_sent_at
- **File**: `scrapers/send_notifications.py`

### T-12: GitHub Actions Workflow for Notifications
- `.github/workflows/daily-notifications.yml`
- Cron: daily @ UTC 7:00 (after daily scrape @ UTC 6:00)
- Run `scrapers/send_notifications.py`
- Secrets: RESEND_API_KEY + SUPABASE keys
- **File**: `.github/workflows/daily-notifications.yml`

---

## Phase 4: Saved Jobs

### T-13: Saved Jobs API Routes
- `GET /api/saved-jobs` — list user's saved jobs (with job details from v_jobs_full)
- `POST /api/saved-jobs` — save a job {job_id}
- `DELETE /api/saved-jobs/[job_id]` — unsave a job
- **Files**: `app/api/saved-jobs/route.ts`, `app/api/saved-jobs/[job_id]/route.ts`

### T-14: Save Button on Job Cards
- Add bookmark/heart icon to job cards (Job Board page + Job Detail page)
- If logged in: toggle save/unsave on click
- If not logged in: prompt to sign in
- Visual state: filled vs outline icon
- Need to fetch user's saved job IDs on page load to show correct state
- **Files**: Update `app/jobs/page.tsx`, `app/jobs/[id]/page.tsx`, create `components/save-button.tsx`

### T-15: Saved Jobs Page
- Create `/saved` page
- List saved jobs (reuse job card component)
- If job is inactive: show "No longer active" badge
- Empty state: "No saved jobs yet. Browse the Job Board to find your next role."
- **File**: `app/saved/page.tsx`

---

## Phase 5: Analytics Upgrade

### T-16: Merge Anonymous + Authenticated Analytics
- Update `components/analytics.tsx`:
  - If user is logged in: send user_id with page view
  - Continue sending visitor_id as well (for fallback)
- Update `/api/admin/stats/route.ts`:
  - Retention analysis: prefer user_id, fallback to visitor_id
  - New metric: registered users count, % of total visitors
  - New segment: "registered" vs "anonymous" in user segments
- **Files**: `components/analytics.tsx`, `app/api/admin/stats/route.ts`

---

## Phase 6: Testing

### T-17: Auth Flow Test
- Sign in with Google → verify user_profiles record created
- Sign out → verify session cleared
- Return visit → verify session restored

### T-18: Subscription Test
- Create subscription with filters → verify saved in DB
- Run notification script → verify email sent for matching jobs
- Verify weekly users don't get daily emails

### T-19: Saved Jobs Test
- Save a job → verify in DB + UI state
- Unsave → verify removed
- Job becomes inactive → verify "No longer active" in saved list

### T-20: Analytics Merge Test
- Browse anonymously → accumulate page views with visitor_id
- Sign in → verify page_views backfilled with user_id
- Check admin dashboard → verify retention uses merged data

---

## Dependency Graph

```
T-01 (Google OAuth) ──┐
T-02 (Supabase Auth) ─┤
T-03 (Resend setup) ──┼── T-04 (DB migration)
                       │
                       ├── T-05 (Auth client) ── T-06 (Sign In UI) ── T-07 (Profile creation)
                       │                                                       │
                       ├── T-08 (Sub API) ── T-09 (Sub UI) ──┐                │
                       │                                       │                │
                       ├── T-10 (Email template) ─────────────┼── T-11 (Send script) ── T-12 (GH Action)
                       │                                       │
                       ├── T-13 (Saved API) ── T-14 (Save button) ── T-15 (Saved page)
                       │
                       └── T-16 (Analytics merge)

T-17, T-18, T-19, T-20: Testing (after respective features)
```

## Parallel Execution

| Track | Tasks | Can Start After |
|-------|-------|-----------------|
| **Auth** | T-05, T-06, T-07 | T-01 + T-02 + T-04 |
| **Subscriptions** | T-08, T-09, T-10, T-11, T-12 | T-04 (DB ready) |
| **Saved Jobs** | T-13, T-14, T-15 | T-04 + T-05 (DB + auth ready) |
| **Analytics** | T-16 | T-07 (profile creation) |
| **Setup** | T-01, T-02, T-03, T-04 | Immediately |

Auth and Subscriptions API can be built in parallel. Saved Jobs depends on auth being ready.

## Cost Estimate

| Component | Cost |
|-----------|------|
| Resend (email) | Free (3000/month) |
| Supabase Auth | Free (included in plan) |
| Google Cloud OAuth | Free |
| Vercel (no change) | Free |
| Development time | ~12-15 hours |
