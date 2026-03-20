# Subscription System — Design Spec

**Date**: 2026-03-20
**Status**: Draft

## Problem

Resume matching costs $0.50-1.00 per user (30+ OpenAI API calls) and takes 30-60 seconds. Currently all users get this for free, which is unsustainable. We need a subscription model that gates the expensive matching behind payment while giving free users enough value to convert.

## Solution

$10/month subscription via Stripe Checkout. Free users upload resume and get AI profile + market comparison (cheap). Paid users get full job matching (two-stage for speed), skills gap analysis, and weekly new-match email alerts.

## User Journey

### Free User
1. Browse site → login gate at 15 jobs / salary / resume tabs
2. Sign in with Google → unlock browsing
3. Go to Dashboard → upload resume
4. Upload triggers **profile parsing only** (not matching) — $0.02, ~5 seconds
5. See: Profile summary + **Market Comparison** ("Your Python skill is needed by 72% of AI jobs")
6. Below: matches area blurred with SubscribeGate showing price + 3 value props + Subscribe button

### Paid User (after subscribing)
7. Click Subscribe → redirect to Stripe Checkout → pay $10
8. Stripe webhook fires → sets `subscription_status = 'active'`
9. Webhook also triggers **two-stage matching**:
   - **Stage 1 (~10s)**: Pre-filter top 50 jobs (role + skill intersection, DB only) → AI match → results appear
   - **Stage 2 (background, 2-3min)**: Match remaining 600+ jobs → results appear progressively
10. Dashboard shows: full matches + skills gap analysis
11. Every week: GitHub Action runs incremental matching → sends email "3 new Strong Matches this week"

### Cancelled User
12. Cancel via Stripe Customer Portal
13. Webhook fires → `subscription_status = 'cancelled'`, `subscription_expires_at` = period end
14. Historical matches remain visible (read-only)
15. No new matching runs, no weekly emails
16. SubscribeGate reappears on new-matches section: "Resubscribe to get new matches"

## Database Changes

```sql
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'free'
    CHECK (subscription_status IN ('free', 'active', 'cancelled')),
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
```

No new tables needed.

## Two-Stage Matching

### Stage 1: Pre-filter + Fast Match (~10 seconds)

Pre-filter is pure SQL, no API cost:
1. Get user's `parsed_profile.job_titles` → map to closest `role_category`
2. Get user's `parsed_profile.skills` array
3. Query jobs where `role_category` matches AND `hard_skills`/`tools` JSON arrays overlap with user skills
4. Score by overlap count, take top 50
5. Run `matchJobsBatch` on these 50 only (2-3 API calls)

### Stage 2: Background Full Match

After Stage 1 completes and returns:
1. Fire-and-forget request to `/api/resume/process` with `{ user_id, stage: 2, exclude_job_ids: [...] }`
2. Process matches remaining jobs in batches of 20
3. Frontend polls for new results

### Processing Status Flow

```
upload → 'parsing' (profile only, free)
       → 'parsed' (new status — profile done, no matching yet)

subscribe → 'matching_stage1' (fast 50)
          → 'matching_stage2' (background rest)
          → 'completed'
```

## Market Comparison (Free Feature)

Cross-reference user's `parsed_profile.skills` with `market_snapshots.hard_skills` + `market_snapshots.tools`:

For each user skill, find it in market data and show demand %:
- "Python — needed by 72% of AI Engineer roles"
- "SQL — needed by 33% of AI PM roles"

Also show top skills the user is MISSING:
- "You don't have Kubernetes — needed by 48% of roles"

This uses existing data, zero API cost. Implemented as a new API route `/api/resume/market-comparison`.

## Stripe Integration

### Flow
1. User clicks Subscribe → POST `/api/billing/checkout` → creates Stripe Checkout Session → returns URL
2. Frontend redirects to Stripe Checkout
3. User pays → Stripe redirects to `/dashboard?subscription=success`
4. Stripe webhook POST `/api/billing/webhook` with `checkout.session.completed`
5. Webhook: create/update Stripe customer, set `subscription_status = 'active'`, trigger matching

### Webhook Events
- `checkout.session.completed` → activate subscription + trigger matching
- `customer.subscription.updated` → update status (handles renewals)
- `customer.subscription.deleted` → set cancelled + expiry date
- `invoice.payment_failed` → set cancelled

### Customer Portal
- GET `/api/billing/portal` → creates Stripe Customer Portal session → returns URL
- User can cancel/update payment method from there

## API Routes

### New
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/billing/checkout` | POST | Create Stripe Checkout Session |
| `/api/billing/webhook` | POST | Handle Stripe webhook events |
| `/api/billing/portal` | POST | Create Customer Portal session |
| `/api/resume/market-comparison` | GET | Free market skill comparison |

### Modified
| Route | Change |
|-------|--------|
| `/api/resume/upload` | Only trigger profile parsing, NOT matching |
| `/api/resume/process` | Support `stage` param (1 = fast 50, 2 = remaining) |
| `/api/resume/status` | Return `subscription_status` alongside processing status |

## UI Components

### SubscribeGate
Similar to LoginGate but for paid features. Shows:
- Blurred content behind gradient
- Lock icon + "$10/month"
- Three value props: "Full match results" / "Skills gap analysis" / "Weekly new match alerts"
- Subscribe button → calls `/api/billing/checkout` → redirects to Stripe

### Dashboard Changes
- Free user: Profile card + Market Comparison card + SubscribeGate over matches
- Paid user: Profile + full matches (two-stage loading) + skills gap
- Cancelled user: Profile + historical matches (read-only) + "Resubscribe" prompt over new matches

### Auth Provider Changes
- Add `subscriptionStatus: 'free' | 'active' | 'cancelled'` to context
- Fetch from `/api/resume/status` on load
- Expose `subscribe()` function that calls checkout API

## Weekly Email

Modify `.github/workflows/daily-match.yml`:
1. After running incremental matching, query users with `subscription_status = 'active'`
2. For each, find matches created since last email
3. Send via Resend: "X new matches this week" with top 5
4. Only run weekly (change cron or add day check)

## Cost Analysis

| User Type | Per-user cost | Revenue |
|-----------|--------------|---------|
| Free (profile only) | $0.02 | $0 |
| Paid (full match) | $0.50-1.00 first month | $10/month |
| Paid (weekly incremental) | $0.05-0.10/week | included |

Break-even: 1 paid user covers ~10-20 free users' profile parsing costs.

## Files

### New
- `database/migration_subscription.sql`
- `app/api/billing/checkout/route.ts`
- `app/api/billing/webhook/route.ts`
- `app/api/billing/portal/route.ts`
- `app/api/resume/market-comparison/route.ts`
- `components/subscribe-gate.tsx`

### Modified
- `components/auth-provider.tsx` — add subscription status
- `app/dashboard/page.tsx` — free/paid split, market comparison, subscribe gate
- `app/api/resume/upload/route.ts` — only parse profile, don't trigger matching
- `app/api/resume/process/route.ts` — two-stage matching with pre-filter
- `app/api/resume/status/route.ts` — include subscription status
- `.github/workflows/daily-match.yml` — add weekly email
- `scripts/incremental-match.js` — add email sending
- `.env.example` — Stripe env vars
- `package.json` — add stripe
