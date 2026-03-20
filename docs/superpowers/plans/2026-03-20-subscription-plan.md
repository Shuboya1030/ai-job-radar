# Subscription System — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add $10/month Stripe subscription that gates job matching behind payment, with two-stage matching for speed and weekly email alerts for retention.

**Architecture:** Free users get profile parsing + market comparison (cheap). Stripe Checkout redirect handles payment. Webhook activates subscription and triggers two-stage matching (fast 50 pre-filtered jobs first, then background full scan). Weekly GitHub Action sends new-match emails to paid users via Resend.

**Tech Stack:** Next.js 14, Supabase, Stripe Checkout + Webhooks, OpenAI (gpt-4o), Resend (email), Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-20-subscription-design.md`

**Note:** No test framework in project. Manual verification only.

---

## File Structure

### New Files
```
database/migration_subscription.sql          — Add subscription columns to user_profiles
app/api/billing/checkout/route.ts            — Create Stripe Checkout Session
app/api/billing/webhook/route.ts             — Handle Stripe webhook events
app/api/billing/portal/route.ts              — Create Stripe Customer Portal session
app/api/resume/market-comparison/route.ts    — Free market skill comparison
components/subscribe-gate.tsx                — Paywall blur + subscribe CTA
```

### Modified Files
```
package.json                                 — Add stripe
.env.example                                 — Add Stripe env vars
components/auth-provider.tsx                 — Add subscriptionStatus to context
app/api/resume/upload/route.ts               — Only parse profile, don't trigger matching
app/api/resume/process/route.ts              — Two-stage matching with pre-filter
app/api/resume/status/route.ts               — Include subscription_status
app/dashboard/page.tsx                       — Free/paid split UI
scripts/incremental-match.js                 — Add email sending for paid users
.github/workflows/daily-match.yml            — Change to weekly + email
```

---

## Chunk 1: Database & Dependencies

### Task 1: Database Migration

**Files:**
- Create: `database/migration_subscription.sql`

- [ ] **Step 1: Write migration**

```sql
-- Subscription columns on user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'free'
    CHECK (subscription_status IN ('free', 'active', 'cancelled')),
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription
  ON user_profiles(subscription_status)
  WHERE subscription_status = 'active';
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**
- [ ] **Step 3: Verify**: `user_profiles` table has 3 new columns
- [ ] **Step 4: Commit**

```bash
git add database/migration_subscription.sql
git commit -m "feat: add subscription columns to user_profiles"
```

### Task 2: Install Stripe + Env Vars

**Files:**
- Modify: `package.json`
- Modify: `.env.example`

- [ ] **Step 1: Install stripe**

```bash
npm install stripe
```

- [ ] **Step 2: Update .env.example**

Add:
```
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
```

- [ ] **Step 3: Add actual keys to .env.local**

User must create Stripe account and:
1. Get API keys from Stripe Dashboard → Developers → API Keys
2. Create a Product ($10/month recurring) → copy the Price ID
3. Set up webhook endpoint → copy signing secret

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "feat: add stripe dependency and env var placeholders"
```

---

## Chunk 2: Stripe API Routes

### Task 3: Checkout Route

**Files:**
- Create: `app/api/billing/checkout/route.ts`

- [ ] **Step 1: Create checkout route**

```typescript
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' })

async function getUser() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value }, set() {}, remove() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function POST() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard?subscription=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`,
    client_reference_id: user.id,
    customer_email: user.email || undefined,
    metadata: { user_id: user.id },
  })

  return NextResponse.json({ url: session.url })
}
```

- [ ] **Step 2: Commit**

### Task 4: Webhook Route

**Files:**
- Create: `app/api/billing/webhook/route.ts`

- [ ] **Step 1: Create webhook route**

This handles: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.

On checkout complete:
1. Get `user_id` from `client_reference_id`
2. Update `user_profiles` with `stripe_customer_id`, `subscription_status = 'active'`
3. Fire-and-forget trigger matching: POST `/api/resume/process` with `{ user_id, stage: 1 }`

On subscription deleted/failed:
1. Look up user by `stripe_customer_id`
2. Set `subscription_status = 'cancelled'`, `subscription_expires_at` = period end

```typescript
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' })

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const db = createSupabaseServerClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.client_reference_id || session.metadata?.user_id
      if (!userId) break

      await db.from('user_profiles').update({
        stripe_customer_id: session.customer as string,
        subscription_status: 'active',
        subscription_expires_at: null,
      }).eq('id', userId)

      // Trigger two-stage matching (stage 1: fast 50)
      const processUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/resume/process`
      fetch(processUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, stage: 1 }),
      }).catch(err => console.error('Failed to trigger matching:', err))
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const customerId = sub.customer as string
      if (sub.status === 'active') {
        await db.from('user_profiles').update({
          subscription_status: 'active',
          subscription_expires_at: null,
        }).eq('stripe_customer_id', customerId)
      }
      break
    }

    case 'customer.subscription.deleted':
    case 'invoice.payment_failed': {
      const obj = event.data.object as any
      const customerId = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id
      if (customerId) {
        const expiresAt = obj.current_period_end
          ? new Date(obj.current_period_end * 1000).toISOString()
          : new Date().toISOString()
        await db.from('user_profiles').update({
          subscription_status: 'cancelled',
          subscription_expires_at: expiresAt,
        }).eq('stripe_customer_id', customerId)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
```

- [ ] **Step 2: Commit**

### Task 5: Customer Portal Route

**Files:**
- Create: `app/api/billing/portal/route.ts`

- [ ] **Step 1: Create portal route**

```typescript
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' })

async function getUser() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value }, set() {}, remove() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function POST() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createSupabaseServerClient()
  const { data: profile } = await db
    .from('user_profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: 'No subscription found' }, { status: 404 })
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard`,
  })

  return NextResponse.json({ url: session.url })
}
```

- [ ] **Step 2: Commit**

---

## Chunk 3: Market Comparison API + Upload Flow Change

### Task 6: Market Comparison Route (Free Feature)

**Files:**
- Create: `app/api/resume/market-comparison/route.ts`

- [ ] **Step 1: Create route**

Cross-references user's parsed_profile.skills with market_snapshots data. Zero API cost.

```typescript
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createSupabaseServerClient } from '@/lib/supabase-server'

async function getUser() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value }, set() {}, remove() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createSupabaseServerClient()

  // Get user profile
  const { data: resume } = await db
    .from('user_resumes')
    .select('parsed_profile')
    .eq('user_id', user.id)
    .single()

  if (!resume?.parsed_profile?.skills) {
    return NextResponse.json({ error: 'No parsed profile' }, { status: 404 })
  }

  const userSkills: string[] = resume.parsed_profile.skills
  const userTitles: string[] = resume.parsed_profile.job_titles || []

  // Get all market snapshots
  const { data: snapshots } = await db
    .from('market_snapshots')
    .select('role_category, hard_skills, tools')

  if (!snapshots?.length) {
    return NextResponse.json({ error: 'No market data' }, { status: 404 })
  }

  // Find best matching role based on job titles
  const roleMap: Record<string, string> = {
    'ai-pm': 'AI PM', 'ai-engineer': 'AI Engineer', 'swe': 'Software Engineer'
  }
  // Simple heuristic: check if titles contain PM/product/engineer keywords
  const titleStr = userTitles.join(' ').toLowerCase()
  let bestRole = 'AI Engineer' // default
  if (titleStr.includes('product') || titleStr.includes('pm')) bestRole = 'AI PM'
  else if (titleStr.includes('software') || titleStr.includes('swe') || titleStr.includes('full stack') || titleStr.includes('frontend') || titleStr.includes('backend')) bestRole = 'Software Engineer'

  const snapshot = snapshots.find(s => s.role_category === bestRole) || snapshots[0]

  // Parse market skills
  const marketHardSkills: { name: string; pct: number }[] =
    typeof snapshot.hard_skills === 'string' ? JSON.parse(snapshot.hard_skills) : snapshot.hard_skills || []
  const marketTools: { name: string; pct: number }[] =
    typeof snapshot.tools === 'string' ? JSON.parse(snapshot.tools) : snapshot.tools || []
  const allMarketSkills = [...marketHardSkills, ...marketTools]

  // Cross-reference
  const userSkillsLower = userSkills.map(s => s.toLowerCase())

  const yourStrengths = allMarketSkills
    .filter(ms => userSkillsLower.some(us => us.includes(ms.name.toLowerCase()) || ms.name.toLowerCase().includes(us)))
    .map(ms => ({ skill: ms.name, demand_pct: ms.pct }))
    .sort((a, b) => b.demand_pct - a.demand_pct)
    .slice(0, 10)

  const yourGaps = allMarketSkills
    .filter(ms => !userSkillsLower.some(us => us.includes(ms.name.toLowerCase()) || ms.name.toLowerCase().includes(us)))
    .filter(ms => ms.pct >= 10) // only show gaps for commonly needed skills
    .map(ms => ({ skill: ms.name, demand_pct: ms.pct }))
    .sort((a, b) => b.demand_pct - a.demand_pct)
    .slice(0, 10)

  return NextResponse.json({
    matched_role: bestRole,
    your_strengths: yourStrengths,
    your_gaps: yourGaps,
    total_jobs: snapshot.total_jobs,
  })
}
```

- [ ] **Step 2: Commit**

### Task 7: Modify Upload Route — Profile Parse Only

**Files:**
- Modify: `app/api/resume/upload/route.ts`

- [ ] **Step 1: Change upload to only trigger profile parsing, not matching**

Current upload route triggers `/api/resume/process` which does parse + match.

Split into two phases:
- Upload route triggers a new lightweight `/api/resume/parse` (or modify process to accept `{ parse_only: true }`)
- Simpler approach: modify `/api/resume/process` to accept a `mode` param.

Change the fire-and-forget call in upload route:
```typescript
// OLD: triggers full matching
fetch(processUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ user_id: user.id }),
})

// NEW: only parse profile
fetch(processUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ user_id: user.id, mode: 'parse_only' }),
})
```

Also: do NOT delete old matches on re-upload if user is paid (they may want to keep historical).

- [ ] **Step 2: Commit**

### Task 8: Modify Process Route — Support Modes

**Files:**
- Modify: `app/api/resume/process/route.ts`

- [ ] **Step 1: Add mode support**

Accept `mode` param in request body:
- `parse_only` — extract text + parse profile with AI → set status to `'parsed'`
- `stage1` — pre-filter top 50 jobs + AI match → set status to `'matching_stage2'` → fire-and-forget stage 2
- `stage2` — match remaining jobs (exclude already matched)
- `undefined`/`full` — legacy behavior (parse + match all), kept for backward compat

Pre-filter logic for stage 1:
1. Get user skills from `parsed_profile`
2. Query all active jobs with `hard_skills` and `tools` fields
3. For each job, compute skill overlap count (how many user skills appear in job's hard_skills + tools)
4. Also boost jobs matching user's role_category
5. Sort by overlap count descending, take top 50
6. Run AI matching only on these 50

- [ ] **Step 2: Add new processing_status value 'parsed'**

Migration note: need to update the CHECK constraint on `user_resumes.processing_status`:
```sql
ALTER TABLE user_resumes DROP CONSTRAINT IF EXISTS user_resumes_processing_status_check;
ALTER TABLE user_resumes ADD CONSTRAINT user_resumes_processing_status_check
  CHECK (processing_status IN ('pending', 'parsing', 'parsed', 'matching', 'matching_stage1', 'matching_stage2', 'completed', 'failed'));
```

Add this to `migration_subscription.sql`.

- [ ] **Step 3: Commit**

---

## Chunk 4: Auth Provider + Subscribe Gate UI

### Task 9: Update Auth Provider with Subscription Status

**Files:**
- Modify: `components/auth-provider.tsx`

- [ ] **Step 1: Add subscriptionStatus to context**

```typescript
interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  subscriptionStatus: 'free' | 'active' | 'cancelled'
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  subscribe: () => Promise<void>  // triggers Stripe Checkout
}
```

Fetch subscription status from `/api/resume/status` after login. Add `subscribe()` that calls `/api/billing/checkout` and redirects.

- [ ] **Step 2: Commit**

### Task 10: Create SubscribeGate Component

**Files:**
- Create: `components/subscribe-gate.tsx`

- [ ] **Step 1: Create the component**

Similar to LoginGate but:
- Triggers Stripe Checkout instead of Google sign-in
- Shows pricing: "$10/month"
- Shows 3 value props:
  1. "See your Strong & Good matches with detailed reasoning"
  2. "Skills gap analysis to guide your learning"
  3. "Weekly email alerts when new matches appear"
- Subscribe button
- Use `frontend-design` skill for visual design

- [ ] **Step 2: Commit**

### Task 11: Update Status Route

**Files:**
- Modify: `app/api/resume/status/route.ts`

- [ ] **Step 1: Include subscription_status in response**

Query `user_profiles.subscription_status` alongside resume status and return it.

- [ ] **Step 2: Commit**

---

## Chunk 5: Dashboard UI — Free/Paid Split

### Task 12: Dashboard — Market Comparison (Free)

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Add market comparison section**

After profile card, for free users (or all users):
- Fetch `/api/resume/market-comparison`
- Show "Your Skills vs Market Demand" card with:
  - Your strengths: skill name + demand % bar (green)
  - Skills you're missing: skill name + demand % bar (amber)
  - "Based on {total_jobs} {matched_role} positions"

- [ ] **Step 2: Commit**

### Task 13: Dashboard — Subscribe Gate over Matches

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Wrap matches section in SubscribeGate for free users**

```tsx
{subscriptionStatus !== 'active' ? (
  <SubscribeGate>
    {/* Show blurred placeholder matches */}
    <div className="space-y-2">
      {[1,2,3,4,5].map(i => (
        <div key={i} className="card p-4 h-24" /> // placeholder cards
      ))}
    </div>
  </SubscribeGate>
) : (
  // Real matches for paid users
  <MatchList ... />
)}
```

- [ ] **Step 2: Handle subscription=success query param**

When redirected back from Stripe, show a success message and start polling for match results.

- [ ] **Step 3: Commit**

### Task 14: Dashboard — Two-Stage Loading for Paid Users

**Files:**
- Modify: `app/dashboard/page.tsx`

- [ ] **Step 1: Update polling to handle new statuses**

New statuses: `parsed`, `matching_stage1`, `matching_stage2`

- During `matching_stage1`: show "Finding your top matches..." with spinner
- When stage 1 completes (matches start appearing): show results + "Finding more matches in background..."
- During `matching_stage2`: show existing results + subtle loading indicator
- `completed`: show all results, hide loading

- [ ] **Step 2: Commit**

---

## Chunk 6: Weekly Email for Paid Users

### Task 15: Update Incremental Match Script + Email

**Files:**
- Modify: `scripts/incremental-match.js`
- Modify: `.github/workflows/daily-match.yml`

- [ ] **Step 1: Add email sending to incremental match script**

After matching new jobs for each user:
1. Check `subscription_status = 'active'`
2. If new matches found, compose email via Resend
3. Email template: "X new matches this week" + top 5 with score/company/title
4. Include link to dashboard

- [ ] **Step 2: Change workflow to weekly (Monday)**

```yaml
on:
  schedule:
    - cron: '0 8 * * 1'  # Monday 8am UTC
```

- [ ] **Step 3: Add RESEND_API_KEY to workflow env vars**

- [ ] **Step 4: Commit**

---

## Chunk 7: Settings Page + Nav Updates

### Task 16: Settings Page — Manage Subscription

**Files:**
- Modify: `app/settings/page.tsx`

- [ ] **Step 1: Add subscription management section**

For paid users: show "Pro Subscriber" badge + "Manage Subscription" button → calls `/api/billing/portal` → redirects to Stripe portal.

For free users: show "Upgrade to Pro" button → calls `/api/billing/checkout`.

- [ ] **Step 2: Commit**

### Task 17: Nav — Subscription Badge

**Files:**
- Modify: `components/nav.tsx`

- [ ] **Step 1: Show subscription status in user dropdown**

After user email, show a small badge: "Pro" (green) for active, "Free" for free.

- [ ] **Step 2: Commit**

---

## Chunk 8: Final Verification

### Task 18: Stripe Setup Verification

- [ ] **Step 1: Create Stripe product + price in test mode**
- [ ] **Step 2: Set up webhook in Stripe Dashboard → point to `https://aistartupjob.com/api/billing/webhook`**
- [ ] **Step 3: Add all Stripe env vars to Vercel**
- [ ] **Step 4: Add STRIPE_WEBHOOK_SECRET to Vercel**

### Task 19: End-to-End Test

- [ ] **Step 1: Sign in → upload resume → see profile + market comparison**
- [ ] **Step 2: Click Subscribe → Stripe Checkout → use test card 4242424242424242**
- [ ] **Step 3: After payment → redirected to dashboard → see matching in progress**
- [ ] **Step 4: Stage 1 results appear in ~10s → stage 2 continues in background**
- [ ] **Step 5: All matches appear → skills gap visible**
- [ ] **Step 6: Go to Settings → Manage Subscription → cancel in Stripe portal**
- [ ] **Step 7: Historical matches still visible → new matches blurred**

---

## Task Dependency Graph

```
Task 1 (DB Migration)
  ↓
Task 2 (Stripe + Deps)
  ↓
Tasks 3-5 (Billing API routes) ← parallel
  ↓
Task 6 (Market Comparison API)
Task 7 (Upload route change)
Task 8 (Process route two-stage)
  ↓
Task 9 (Auth Provider)
Task 10 (SubscribeGate)
Task 11 (Status route)
  ↓
Tasks 12-14 (Dashboard UI) ← sequential
  ↓
Task 15 (Weekly email)
Tasks 16-17 (Settings + Nav)
  ↓
Tasks 18-19 (Verification)
```
