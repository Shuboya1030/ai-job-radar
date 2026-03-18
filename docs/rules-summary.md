# AIJobRadar — Rules & Standards Summary

> All rules governing data quality, pipeline behavior, and product decisions.
> Organized by confidence level: Hard Rules (never break) → Soft Rules (follow unless good reason) → Guidelines (best practice)

---

## Hard Rules (NEVER break)

These are non-negotiable. Violating any of these is a data quality incident.

### Data Integrity
1. **Source URL required for all funding data** — Every company with `funding_amount_cents` MUST have `funding_source_url` pointing to the verifiable source. No exceptions. No fabrication.
2. **Never fabricate funding amounts** — Only use data found from a real, verifiable source (Growjo, TechCrunch, Crunchbase, company press release, etc.)
3. **Funding upgrade-only** — `funding_amount_cents` can only increase. If new scrape returns NULL, do NOT overwrite existing known value. Missing ≠ zero.
4. **Public companies = "Public"** — Any company with a stock ticker must have `funding_stage = "Public"`. Never "Series D+". Check: Uber, Airbnb, Apple, Netflix, DoorDash, Robinhood, etc.
5. **Salary stored as annualized USD** — Hourly rates × 2080 = annual. Raw values preserved in `salary_raw_*` for audit.

### Company Quality
6. **No staffing agencies** — Companies that place contractors, recruit for others, or are headhunting firms must be deactivated. Examples: Kforce, Robert Half, Revel IT, Agile Resources.
7. **No IT outsourcing/body shops** — Consulting firms that sell engineer hours, not products. Examples: Tiger Analytics, Synechron, Marlabs.
8. **No traditional non-AI companies** — Luxury brands, retailers, utilities that have no AI product. Examples: Nike, CHANEL, Best Buy, Patriot Mobile.
9. **AI startup ratio > 70%** — If the ratio of qualified AI companies to total active companies drops below 70%, prioritize cleaning before adding new companies.

### User Data
10. **User data stays private** — RLS enforced on user_profiles, subscriptions, saved_jobs. Users can only access their own data.
11. **Source traceability only in admin** — `funding_source_url` visible only in admin dashboard, not shown to public users.

---

## Soft Rules (follow unless good reason to override)

### Pipeline Metrics
12. **Funding coverage > 50%** — Target: more than half of active companies should have known funding data. Currently 51.6%.
13. **Dedup before analytics** — Always run cross-source dedup after writing jobs, before generating market snapshots.
14. **Stale job cutoff = 7 days** — Jobs not seen in 7 days are auto-deactivated. Adjustable if data sources have different refresh cycles.

### Company Classification
15. **Big Tech with AI divisions: keep but tag** — Google, Meta, Apple, Amazon → `company_type = "Big Tech"`. Keep because users want to see these AI jobs.
16. **Non-AI companies with real AI teams: keep** — Airbnb, DoorDash, Stripe → tag as "Scale-up" or "Enterprise". They have genuine AI engineering roles.
17. **"Stealth Startup": skip if no info** — If a company is in stealth with zero public information, don't add it. No value to users.

### Email Notifications
18. **Default frequency = weekly** — New subscribers default to weekly (Monday). Daily is opt-in.
19. **Empty filters = match all** — If a subscription has empty roles/industries/etc, it matches all jobs (not zero).
20. **Max 20 jobs per email** — Truncate to 20 job cards per email to avoid overwhelming inboxes.

---

## Guidelines (best practice, not enforced)

### Pipeline Operations
21. **3-5 second delay between Playwright requests** — Be polite to Growjo, YC, and other sites behind Cloudflare.
22. **Log every pipeline run** — Write to `agent_runs` table with summary, coverage metrics, and actions taken.
23. **Report deactivated companies** — Every `/run-pipeline` run must list any companies deactivated and why.

### Data Discovery
24. **Prefer company career pages over LinkedIn** — Company career pages (Greenhouse, Lever) have more accurate and complete JDs.
25. **TechCrunch RSS feeds for company discovery** — Three feeds: Venture, Fundraising, AI category.
26. **GPT enrichment: constrained enums** — GPT must choose from predefined lists for industry, seniority, work_type. Never free-form.

### Product Decisions
27. **Always show cost/effort for proposals** — When presenting options to user, include: API cost, development effort, and trade-offs for each.
28. **Data quality > feature velocity** — Fix data issues before building new features.
29. **Commit specs before code** — PRD → Architecture Design → Implementation Plan → Code.

### UI/UX
30. **Funding = most prominent info on job card** — Lime badge for funding stage+amount. Visible before job title.
31. **"HOT" badge for recently funded companies** — Red pulsing badge on companies that raised in last 7 days.
32. **Design: Bloomberg × Startup** — JetBrains Mono for data, DM Sans for body, lime accent (#BFFF00), dark nav, cream ground.

---

## Current Metrics (as of 2026-03-18)

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| AI startup ratio | > 70% | ~82% | ✅ |
| Funding coverage | > 50% | 51.6% | ✅ |
| Source URL coverage | 100% | 100% | ✅ |
| Public companies correctly labeled | 100% | 100% (30 companies) | ✅ |
| Active companies | — | 258 | — |
| Active jobs | — | 637 | — |
| Unit tests | All pass | 54 passing | ✅ |
