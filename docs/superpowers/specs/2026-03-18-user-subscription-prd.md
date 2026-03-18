# PRD: User System + Email Subscription + Saved Jobs

> Version: 1.0
> Date: 2026-03-18
> Status: Draft

---

## 1. Problem Statement

AIJobRadar currently has no user accounts. All visitors are anonymous. This means:
- Users can't save jobs they're interested in
- Users can't get notified when new matching jobs appear
- We can't distinguish returning users from new visitors in analytics
- No foundation for future monetization (paywall requires user identity)

## 2. Goals

1. **User accounts via Google OAuth** — frictionless sign-in
2. **Email subscription with filters** — users choose role + industry + funding stage + work type, receive matching job alerts
3. **Saved jobs** — logged-in users can bookmark jobs
4. **Analytics upgrade** — link anonymous visitor_id to user accounts for accurate retention tracking
5. **Foundation for monetization** — user table ready for future subscription tiers

## 3. Target User

Same as existing: Career Switchers and New Grads looking for AI startup jobs in the US.

## 4. Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth provider | Supabase Auth (Google OAuth) | Already using Supabase, zero extra infra |
| Subscription granularity | Level C: role + industry + funding stage + work type | Users want precision, not spam |
| Email frequency | User-selectable: daily / weekly (default weekly) | Respect user preference, weekly = less churn |
| Email content | Card-style: job title, company, funding, salary, tags | Match website visual language |
| Email service | Resend (free 3000/month) | Next.js native, simple API, sufficient for early stage |
| Logged-in features | Sign in + email alerts + save jobs | B (not C — no application tracking in MVP) |
| Analytics merge | Merge anonymous visitor_id with user account on login | Continuous retention tracking |
| Monetization | Not in this release, but schema is ready | User table supports future tier/plan fields |

## 5. Features

### F1: Google Sign-In
- "Sign in with Google" button in nav bar
- Supabase Auth handles OAuth flow
- On first login: create user_profiles record, link visitor_id
- On return login: restore session from Supabase
- Signed-in state: avatar + dropdown menu (My Subscriptions / Saved Jobs / Sign Out)

### F2: Email Subscription
- **Setup flow**: After login → "Set up job alerts" prompt (or via nav dropdown)
- **Filter selection**:
  - Role: multi-select (AI PM / AI Engineer / SWE)
  - Industry: multi-select (from predefined 16 industries)
  - Funding Stage: multi-select (Seed / Series A / B / C / D+ / Public)
  - Work Type: multi-select (Remote / Hybrid / On-site)
- **Frequency**: daily or weekly (default weekly)
- **Email content**: HTML card layout per matching job:
  - Company name + funding badge
  - Job title
  - Salary range
  - Industry + work type + location
  - "View Job →" link to aistartupjob.com/jobs/{id}
- **Footer**: "Manage preferences" link + "Unsubscribe" link
- **Trigger**: GitHub Action cron job (daily at UTC 7:00, after daily scrape at UTC 6:00)
  - Query new jobs since last send that match each user's filters
  - Skip users with frequency=weekly unless it's their scheduled day (Monday)
  - Send via Resend API

### F3: Saved Jobs
- Heart/bookmark icon on every job card (Job Board + Job Detail page)
- Click to save (logged in) → stored in saved_jobs table
- Click again to unsave
- "Saved Jobs" page (accessible from nav dropdown): list of saved jobs
- If job becomes inactive (deactivated/stale), show as "No longer active" in saved list

### F4: Analytics Merge
- On login: check if user has existing visitor_id in localStorage
- If yes: write visitor_id to user_profiles table
- Update page_views table: backfill user_id for matching visitor_id records
- Admin dashboard retention analysis now uses user_id when available, visitor_id as fallback

## 6. Out of Scope (this release)
- Application tracking
- Payment / subscription tiers
- Social login providers other than Google
- Push notifications (browser/mobile)
- Email for market analysis updates (only job alerts)

## 7. Success Metrics

| Metric | Target |
|--------|--------|
| Sign-up conversion (visitor → registered) | > 5% |
| Email open rate | > 30% |
| Email click-through rate | > 10% |
| Saved jobs per user (avg) | > 3 |
| Unsubscribe rate | < 5% per month |
