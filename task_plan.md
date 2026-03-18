# User System Implementation — Task Plan

## Goal
Implement Google Auth + Email Subscriptions + Saved Jobs per specs at docs/superpowers/specs/2026-03-18-*.md

## Success Criteria
1. All 4 key user journeys work end-to-end
2. Full unit test coverage

## Key User Journeys
- J1: Sign In → Google OAuth → profile created → avatar in nav
- J2: Set Alerts → choose filters → save subscription → confirmed
- J3: Save Job → click bookmark → appears in /saved
- J4: Receive Email → matching jobs found → card-style email sent

## Status

### Phase 0: Setup
- [x] DB tables created (user_profiles, subscriptions, saved_jobs, notification_log)
- [x] @supabase/ssr + resend packages installed
- [x] lib/supabase-auth.ts created
- [x] components/auth-provider.tsx created (needs integration)
- [ ] Google OAuth credentials (BLOCKER: needs manual setup in Google Console)
- [ ] Supabase Auth Google provider enabled (BLOCKER: needs OAuth creds first)
- [ ] Resend API key (can work around with mock for now)

### Phase 1: Auth Integration
- [ ] 1.1 Auth callback route (app/api/auth/callback/route.ts)
- [ ] 1.2 Wrap layout.tsx with AuthProvider
- [ ] 1.3 Update nav.tsx with Sign In button + user dropdown
- [ ] 1.4 Server-side auth helper (lib/supabase-server.ts)

### Phase 2: Subscription System
- [ ] 2.1 Subscription API routes (GET/POST/PUT/DELETE)
- [ ] 2.2 Settings page UI (app/settings/page.tsx)
- [ ] 2.3 Email send script (scrapers/send_notifications.py)
- [ ] 2.4 GitHub Actions workflow for notifications

### Phase 3: Saved Jobs
- [ ] 3.1 Saved jobs API routes (GET/POST/DELETE)
- [ ] 3.2 Save button component
- [ ] 3.3 Update job cards with save button
- [ ] 3.4 Saved jobs page (app/saved/page.tsx)

### Phase 4: Analytics + Polish
- [ ] 4.1 Update analytics.tsx to send user_id
- [ ] 4.2 Update admin stats to use user_id

### Phase 5: Tests
- [ ] 5.1 Auth flow tests
- [ ] 5.2 Subscription API tests
- [ ] 5.3 Saved jobs API tests
- [ ] 5.4 Email matching logic tests

## Decisions
- Google OAuth creds not yet available → build everything else, test with mock auth
- Resend API key not yet available → build email template + send logic, test with console output
- Auth provider wraps layout as client boundary component
