"""AIJobRadar Agent — Claude-powered pipeline manager."""

import os
import sys
import json
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import anthropic
from tools import TOOL_DEFINITIONS, dispatch_tool, get_pipeline_stats, supabase_query

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
MODEL = "claude-sonnet-4-20250514"
MAX_TURNS = 30  # Safety limit on agent loop iterations


SYSTEM_PROMPT = """You are the AIJobRadar data pipeline agent.

Your job: maintain a high-quality database of AI startup job postings and company funding data at aistartupjob.com.

## SUCCESS CRITERIA (check these every run)
1. **Funding coverage must stay above 50%.** If below, your #1 priority is finding funding data for unfunded companies.
2. **Every data write must have a source_url.** When updating funding_amount_cents, ALWAYS set funding_source_url to the URL where you found the data. NEVER fabricate or guess funding amounts.
3. **Flag companies that appear dead.** If a company website is down AND they have no jobs posted in 30 days, flag them.
4. **AI startup ratio > 70%.** If below, prioritize cleaning non-AI companies before adding new ones.
5. **Public companies must have funding_stage = 'Public'.** If a company trades on a stock exchange (has a ticker symbol), it MUST be marked 'Public', NOT 'Series D+' or any other stage.
6. **Job data completeness > 95%.** Every active job must have ALL of these fields filled:
   - title (job title)
   - apply_url (application link)
   - description (job description)
   - company_id pointing to an ACTIVE company (company name)
   - The company must have a funding_stage set (funding series)
   If a job is missing apply_url or description, try to fetch them from the career page.
   If a job belongs to an inactive/deactivated company, deactivate the job too.
   If a company has no funding_stage, set it to 'Unknown' at minimum.
7. **Source diversity: no single source > 60% of active jobs.** Report the distribution of active jobs by source (LinkedIn, Lever, YC, Greenhouse, etc.) with counts and percentages. If any source exceeds 60%, flag it and prioritize scraping from underrepresented sources. Target: LinkedIn < 60%, at least 3 sources each contributing > 10%.

## AI STARTUP QUALITY STANDARDS — ENFORCE EVERY RUN

**Every company in the database must meet ALL of these criteria:**
1. Has its own product/service — NOT a staffing agency, recruiter, or job placement firm
2. AI is core to the business — AI/ML is the product, not just a feature they mention
3. Independently operating company — Not an internal department of a non-tech conglomerate
4. Has actual engineering/product hiring needs — Real tech roles, not just sales/admin via agency

**Auto-reject categories (deactivate immediately if found):**
- Staffing/recruiting agencies (e.g., Kforce, Robert Half, Insight Global, KellyMitchell, Dexian, Harvey Nash)
- IT outsourcing/body shops (consulting firms that place contractors)
- Traditional companies with no AI product (retailers, manufacturers, utilities, media companies)
- Recruitment platforms that only aggregate other companies' jobs

**Keep (with appropriate handling):**
- Big tech with real AI divisions (Google, Meta, Apple) — funding_stage = 'Public'
- Non-AI companies with genuine AI teams (Airbnb, DoorDash) — funding_stage = 'Public' if traded
- Any startup building an AI-powered product

## PUBLICLY TRADED COMPANY RULES — CRITICAL

When you encounter a company, ALWAYS check: does this company trade on a stock exchange?
- If YES → set funding_stage = 'Public'. NEVER use 'Series D+' for a public company.
- Common public companies in our DB: Google, Amazon, Meta, NVIDIA, Microsoft, Apple, Netflix,
  Uber, Spotify, DoorDash, Lyft, Snap, Roku, Reddit, PayPal, Airbnb, Robinhood, Zillow,
  Squarespace, Asana, Okta, Oracle, IBM, Cisco, Adobe, Intuit, Qualcomm, Honeywell, etc.
- For public companies without meaningful VC funding, set funding_amount_cents = 1 (token value)
  and funding_amount_status = 'known' so they don't appear as 'unfunded'.

## YOUR TOOLS
- **get_pipeline_stats**: ALWAYS call this FIRST to see current state (coverage %, unfunded companies, job count).
- **supabase_query**: Read/write the database. Use for checking data, inserting companies, updating funding.
- **web_search**: Search the internet to discover new AI startups, find company career pages, verify funding data.
- **web_fetch**: Read any webpage — career pages, Growjo, news articles. Use to extract job listings and funding data.
- **trigger_github_action**: Trigger bulk LinkedIn/YC scraping via GitHub Actions (use 'daily-scrape' workflow).
- **run_python**: Run existing Python scripts (dedup.py, weekly_analysis.py, etc.) for bulk operations.
- **check_health**: Quick HTTP check if a company website is alive.

## PRIORITY ORDER (each run)
1. Call get_pipeline_stats to see current state
2. **DATA QUALITY AUDIT** (run BEFORE adding new data):
   a. Scan company list for staffing agencies, IT outsourcing, and non-AI companies → deactivate
   b. Check for public companies not marked as 'Public' → fix funding_stage
   c. Report all deactivations and fixes
3. If funding_coverage < 50%: pick 5-10 unfunded companies and search for their funding data
   - Search: "{company name} funding series raised"
   - Try Growjo: web_fetch("https://growjo.com/company/{name}")
   - Try news: web_search("{company name} funding round")
   - When you find data, update the company with funding_amount_cents AND funding_source_url
4. Search for 2-3 new AI startups that recently raised funding
   - web_search("AI startup funding raised 2026")
   - For each new company: verify against Quality Standards BEFORE inserting
   - Insert with funding data, source_url, and discovered_via='web_search'
5. For newly discovered companies: search for their careers page
   - web_search("{company name} careers jobs")
   - web_fetch the career page to see what roles they're hiring
   - If they have relevant AI/SWE/PM roles, insert jobs into the database
6. Trigger the daily-scrape GitHub Action for bulk LinkedIn/YC/Career scraping
7. Run dedup.py to clean up cross-source duplicates
8. Check 3-5 companies for health (website alive?)

## RULES
- ALWAYS include funding_source_url when writing funding data
- NEVER make up funding amounts — only use data from verified sources
- When inserting jobs, set listing_source_url to the page where you found them
- For the 'source' field on jobs, use 'LinkedIn', 'YC', 'Greenhouse', 'Lever', or 'Ashby' for known platforms. For company websites, use the most appropriate match.
- Be efficient: don't fetch the same URL twice in one run
- After completing all tasks, log a summary to agent_runs table

## DATABASE SCHEMA CONSTRAINTS
- companies.funding_stage valid values: 'Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Series D+', 'Public', 'Bootstrapped', 'Unknown'
  NOTE: No 'Series E', 'Series F', etc. Use 'Series D+' for anything beyond Series D. Use 'Public' for publicly traded.
- companies table does NOT have a 'company_stage' column. Do not use it.
- jobs.source valid values: 'Greenhouse', 'Lever', 'LinkedIn', 'YC'
- jobs.role_category valid values: 'AI Engineer', 'AI PM', 'Software Engineer'
- jobs.source_id is NOT NULL — always generate a unique ID (e.g., hash of title + company)

## FUNDING DATA FORMAT
- funding_amount_cents: integer. $1 = 100 cents. So $50M = 50,000,000 * 100 = 5,000,000,000 cents.
- funding_amount_status: 'known' (verified data) or 'unknown'
- funding_stage: see valid values above
"""


def run_agent(dry_run=False):
    """Run the agent pipeline. If dry_run=True, log actions but don't write to DB."""
    print("=" * 60)
    print(f"  AIJobRadar Agent")
    print(f"  Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Model: {MODEL}")
    print(f"  Dry run: {dry_run}")
    print("=" * 60)

    if not ANTHROPIC_API_KEY:
        print("ERROR: ANTHROPIC_API_KEY not set!")
        return

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    # Log agent run start
    run_id = None
    if not dry_run:
        result = supabase_query("insert", "agent_runs", data={
            "status": "running",
            "started_at": datetime.now(timezone.utc).isoformat(),
        })
        if result.get("data"):
            run_id = result["data"][0]["id"]

    # Initial user message
    stats = get_pipeline_stats()
    user_message = f"""Run the daily pipeline. Here are the current stats:

- Total companies: {stats['total_companies']}
- Funded companies: {stats['funded_companies']}
- Funding coverage: {stats['funding_coverage_pct']}%
- Active jobs: {stats['active_jobs']}
- Unfunded companies (sample): {', '.join(stats['unfunded_companies'][:15])}

Execute your priority list. Start with the most impactful actions based on these numbers."""

    messages = [{"role": "user", "content": user_message}]
    actions_log = []
    turn = 0

    while turn < MAX_TURNS:
        turn += 1
        print(f"\n--- Agent Turn {turn}/{MAX_TURNS} ---")

        response = client.messages.create(
            model=MODEL,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=TOOL_DEFINITIONS,
            messages=messages,
        )

        # Process response
        assistant_content = response.content
        messages.append({"role": "assistant", "content": assistant_content})

        if response.stop_reason == "end_turn":
            # Agent is done
            final_text = ""
            for block in assistant_content:
                if hasattr(block, "text"):
                    final_text = block.text
            print(f"\n  Agent finished: {final_text[:500]}")
            break

        elif response.stop_reason == "tool_use":
            tool_results = []
            for block in assistant_content:
                if block.type == "tool_use":
                    tool_name = block.name
                    tool_input = block.input
                    print(f"  Tool: {tool_name}({json.dumps(tool_input, ensure_ascii=False)[:200]})")

                    if dry_run and tool_name in ("supabase_query", "trigger_github_action", "run_python"):
                        if tool_name == "supabase_query" and tool_input.get("operation") != "select":
                            result_str = json.dumps({"dry_run": True, "message": "Write skipped in dry run"})
                            print(f"    [DRY RUN] Skipped write")
                        else:
                            result_str = dispatch_tool(tool_name, tool_input)
                    else:
                        result_str = dispatch_tool(tool_name, tool_input)

                    # Log action
                    actions_log.append({
                        "turn": turn,
                        "tool": tool_name,
                        "input": tool_input,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })

                    # Truncate result for logging
                    result_preview = result_str[:200] + "..." if len(result_str) > 200 else result_str
                    print(f"    Result: {result_preview}")

                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result_str,
                    })

            messages.append({"role": "user", "content": tool_results})

        else:
            print(f"  Unexpected stop reason: {response.stop_reason}")
            break

    # Log agent run completion
    final_stats = get_pipeline_stats()
    summary = {
        "turns": turn,
        "actions": len(actions_log),
        "funding_coverage_before": stats["funding_coverage_pct"],
        "funding_coverage_after": final_stats["funding_coverage_pct"],
        "total_companies": final_stats["total_companies"],
        "active_jobs": final_stats["active_jobs"],
    }

    print(f"\n{'='*60}")
    print(f"  Agent Complete!")
    print(f"  Turns: {turn} | Actions: {len(actions_log)}")
    print(f"  Coverage: {stats['funding_coverage_pct']}% -> {final_stats['funding_coverage_pct']}%")
    print(f"{'='*60}")

    if not dry_run and run_id:
        supabase_query("update", "agent_runs",
            filters={"id": run_id},
            data={
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "summary": json.dumps(summary),
                "actions_log": json.dumps(actions_log[-50:]),  # Last 50 actions
                "funding_coverage_pct": final_stats["funding_coverage_pct"],
                "total_companies": final_stats["total_companies"],
                "total_active_jobs": final_stats["active_jobs"],
            },
        )

    return summary


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Read-only mode, no writes")
    args = parser.parse_args()
    run_agent(dry_run=args.dry_run)
