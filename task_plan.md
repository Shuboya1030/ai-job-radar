# AIJobRadar Agent Implementation — Task Plan

## Goal
Implement the Claude Agent as full pipeline manager per design spec at `docs/superpowers/specs/2026-03-15-agent-architecture-design.md`.

## Success Criteria
- SC1: Funding coverage > 50%, tracked in admin dashboard
- SC2: Field-level source_url traceability for all data writes
- SC3: Passive company liveness monitoring (website down + no jobs 30d = flagged)

## Phases

### Phase 1: Foundation (DB + Dependencies)
- [x] 1.1 Install Claude Agent SDK (`anthropic` package)
- [ ] 1.2 DB migration: Create `agent_runs` table
- [ ] 1.3 DB migration: Add `funding_source_url`, `funding_updated_at`, `discovered_via` to `companies`
- [ ] 1.4 DB migration: Add `listing_source_url` to `jobs`
- [ ] 1.5 Update `scrapers/requirements.txt`

### Phase 2: Agent Tools (6 tools)
- [ ] 2.1 `supabase_query` — read/write database
- [ ] 2.2 `trigger_github_action` — trigger GH workflow via `gh` CLI
- [ ] 2.3 `web_search` — search internet for companies/news
- [ ] 2.4 `web_fetch` — read any webpage content
- [ ] 2.5 `run_python` — execute existing Python scripts
- [ ] 2.6 `check_health` — HTTP ping company website

### Phase 3: Agent Core
- [ ] 3.1 Agent system prompt (planning skill, success criteria, rules)
- [ ] 3.2 Agent main script using Claude Agent SDK with tool bindings
- [ ] 3.3 Agent decision loop (read state → decide priorities → execute → report)
- [ ] 3.4 Run logging to `agent_runs` table

### Phase 4: Admin Dashboard Updates
- [ ] 4.1 API: funding coverage %, source breakdown, agent run history
- [ ] 4.2 UI: funding coverage gauge
- [ ] 4.3 UI: agent run history table
- [ ] 4.4 UI: source traceability view (funding_source_url per company)

### Phase 5: Testing & Verification
- [ ] 5.1 Unit tests for each tool
- [ ] 5.2 Dry-run agent (read-only, no writes) to verify decision logic
- [ ] 5.3 Full agent run with writes, verify data in Supabase
- [ ] 5.4 Verify admin dashboard shows correct metrics

## Decisions Log
- 2026-03-15: Single agent (not multi-agent) — simpler, sufficient for workload
- 2026-03-15: GitHub Actions stays as bulk scraping tool called by agent
- 2026-03-15: Passive company monitoring first, upgrade to active if needed
- 2026-03-15: Field-level source traceability, admin-only visibility
- 2026-03-15: Agent uses web_search + web_fetch to discover ANY career page (not just Greenhouse/Lever)
