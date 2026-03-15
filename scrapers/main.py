"""T-11: Scraper Orchestrator — runs all scrapers, enrichment, and writes to Supabase."""

import sys
import os
import time
from datetime import datetime

# Add scrapers dir to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import ROLES, OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
from linkedin_scraper import scrape_linkedin
from enrichment import enrich_jobs_batch
from db import get_supabase, write_jobs, deactivate_stale_jobs


def run_pipeline():
    start = time.time()
    print("=" * 60)
    print(f"  AIJobRadar Daily Scrape Pipeline")
    print(f"  Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # Validate config
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

    for role in ROLES:
        keywords = role["keywords"]
        category = role["category"]

        # Step 1: Scrape LinkedIn
        jobs, _ = scrape_linkedin(keywords, category)
        if not jobs:
            print(f"  WARNING: 0 jobs for {keywords} — source may be blocked!")
            continue

        total_scraped += len(jobs)

        # Step 2: Enrich with GPT
        enriched = enrich_jobs_batch(jobs, category)

        # Step 3: Write to Supabase
        written, errors = write_jobs(supabase, jobs, enriched, category, source="LinkedIn")
        total_written += written
        total_errors += errors

    # Step 4: Deactivate stale jobs
    stale = deactivate_stale_jobs(supabase, days=7)

    elapsed = time.time() - start
    print("\n" + "=" * 60)
    print(f"  Pipeline Complete!")
    print(f"  Duration: {elapsed:.0f}s")
    print(f"  Scraped: {total_scraped} | Written: {total_written} | Errors: {total_errors} | Stale: {stale}")
    print("=" * 60)


if __name__ == "__main__":
    run_pipeline()
