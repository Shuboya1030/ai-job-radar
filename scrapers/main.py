"""Scraper Orchestrator — runs all sources, enrichment, dedup, and writes to Supabase."""

import sys
import os
import time
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import ROLES, OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
from linkedin_scraper import scrape_linkedin
from enrichment import enrich_jobs_batch
from db import get_supabase, write_jobs, deactivate_stale_jobs
from dedup import deduplicate_jobs


def run_pipeline(skip_linkedin=False, skip_yc=False, skip_careers=False):
    start = time.time()
    print("=" * 60)
    print(f"  AIJobRadar Daily Scrape Pipeline")
    print(f"  Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    if not OPENAI_API_KEY:
        print("ERROR: OPENAI_API_KEY not set!")
        return
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("ERROR: Supabase credentials not set!")
        return

    supabase = get_supabase()
    total_scraped = 0
    total_written = 0
    total_errors = 0

    # ─── Source 1: LinkedIn ─────────────────────────────────────
    if not skip_linkedin:
        print("\n" + "-" * 40)
        print("  SOURCE: LinkedIn")
        print("-" * 40)
        for role in ROLES:
            jobs, _ = scrape_linkedin(role["keywords"], role["category"])
            if not jobs:
                print(f"  WARNING: 0 jobs for {role['keywords']}")
                continue
            total_scraped += len(jobs)
            enriched = enrich_jobs_batch(jobs, role["category"])
            written, errors = write_jobs(supabase, jobs, enriched, role["category"], source="LinkedIn")
            total_written += written
            total_errors += errors

    # ─── Source 2: YC Work at a Startup ─────────────────────────
    if not skip_yc:
        print("\n" + "-" * 40)
        print("  SOURCE: YC Work at a Startup")
        print("-" * 40)
        try:
            from yc_scraper import scrape_yc
            yc_jobs = scrape_yc(max_per_role=50)
            if yc_jobs:
                total_scraped += len(yc_jobs)
                # Group by role for enrichment
                by_role = {}
                for j in yc_jobs:
                    cat = j.get("_role_category", "Software Engineer")
                    by_role.setdefault(cat, []).append(j)

                for category, jobs in by_role.items():
                    enriched = enrich_jobs_batch(jobs, category)
                    written, errors = write_jobs(supabase, jobs, enriched, category, source="YC")
                    total_written += written
                    total_errors += errors
            else:
                print("  WARNING: 0 jobs from YC")
        except Exception as e:
            print(f"  ERROR: YC scraper failed: {e}")

    # ─── Source 3: Career Pages (Greenhouse/Lever/Ashby) ────────
    if not skip_careers:
        print("\n" + "-" * 40)
        print("  SOURCE: Startup Career Pages")
        print("-" * 40)
        try:
            from career_page_scraper import scrape_career_pages
            career_jobs = scrape_career_pages(supabase, max_companies=100)
            if career_jobs:
                total_scraped += len(career_jobs)
                # Group by (source, role) since jobs come from different ATS platforms
                by_source_role = {}
                for j in career_jobs:
                    key = (j.get("_source", "Greenhouse"), j.get("_role_category", "Software Engineer"))
                    by_source_role.setdefault(key, []).append(j)

                for (source, category), jobs in by_source_role.items():
                    enriched = enrich_jobs_batch(jobs, category)
                    written, errors = write_jobs(supabase, jobs, enriched, category, source=source)
                    total_written += written
                    total_errors += errors
        except Exception as e:
            print(f"  ERROR: Career page scraper failed: {e}")

    # ─── Company Discovery (TechCrunch news) ────────────────────
    print("\n" + "-" * 40)
    print("  COMPANY DISCOVERY: TechCrunch")
    print("-" * 40)
    try:
        from company_discovery import run_company_discovery
        run_company_discovery(supabase)
    except Exception as e:
        print(f"  ERROR: Company discovery failed: {e}")

    # ─── NEWS: AI Startup News Scraper ─────────────────────────
    print("\n" + "-" * 40)
    print("  NEWS: AI Startup News Scraper")
    print("-" * 40)
    try:
        from news_scraper import scrape_news
        scrape_news(supabase)
    except Exception as e:
        print(f"  ERROR: News scraper failed: {e}")

    # ─── Cross-Source Dedup ─────────────────────────────────────
    print("\n" + "-" * 40)
    print("  DEDUP: Cross-source deduplication")
    print("-" * 40)
    deduped = deduplicate_jobs(supabase)

    # ─── Stale Job Cleanup ──────────────────────────────────────
    stale = deactivate_stale_jobs(supabase, days=7)

    # ─── Summary ────────────────────────────────────────────────
    elapsed = time.time() - start
    print("\n" + "=" * 60)
    print(f"  Pipeline Complete!")
    print(f"  Duration: {elapsed:.0f}s")
    print(f"  Scraped: {total_scraped} | Written: {total_written} | Errors: {total_errors}")
    print(f"  Deduped: {deduped} | Stale: {stale}")
    print("=" * 60)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-linkedin", action="store_true")
    parser.add_argument("--skip-yc", action="store_true")
    parser.add_argument("--skip-careers", action="store_true")
    args = parser.parse_args()
    run_pipeline(
        skip_linkedin=args.skip_linkedin,
        skip_yc=args.skip_yc,
        skip_careers=args.skip_careers,
    )
