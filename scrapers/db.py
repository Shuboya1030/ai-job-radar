"""T-10: Database Writer — upsert jobs/companies to Supabase, manage freshness."""

import json
from datetime import datetime, timezone, timedelta
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_KEY
from company_manager import resolve_company, normalize_title


def get_supabase():
    """Create Supabase client with service role key (write access)."""
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def write_jobs(supabase, raw_jobs, enriched_jobs, role_category, source="LinkedIn"):
    """
    Write scraped + enriched jobs to Supabase.
    raw_jobs: list of dicts from scraper (JobId, JobTitle, CompanyName, etc.)
    enriched_jobs: list of dicts from enrichment (hard_skills, salary, etc.)
    """
    print(f"  [db] Writing {len(raw_jobs)} {role_category} jobs from {source}...")

    # Index enrichment by JobId
    enrich_map = {e["JobId"]: e for e in enriched_jobs}
    written = 0
    errors = 0

    for raw in raw_jobs:
        job_id = raw.get("JobId")
        enriched = enrich_map.get(job_id, {})

        # Resolve company
        company_id = resolve_company(
            supabase,
            raw.get("CompanyName"),
            raw.get("CompanyUrl"),
            source,
            enriched,
        )

        # Build job record
        now = datetime.now(timezone.utc).isoformat()
        record = {
            "source_id": str(job_id),
            "source": source,
            "company_id": company_id,
            "title": raw.get("JobTitle") or "Unknown",
            "title_normalized": normalize_title(raw.get("JobTitle")),
            "role_category": role_category,
            "seniority": enriched.get("seniority", "Unknown"),
            "employment_type": enriched.get("employment_type", "Full-time"),
            "work_type": enriched.get("work_type", "Unknown"),
            "location": raw.get("Location"),
            "salary_annual_min": enriched.get("salary_annual_min"),
            "salary_annual_max": enriched.get("salary_annual_max"),
            "salary_raw_min": enriched.get("salary_raw_min"),
            "salary_raw_max": enriched.get("salary_raw_max"),
            "salary_raw_type": enriched.get("salary_raw_type", "Unknown"),
            "description": raw.get("JobDescription"),
            "hard_skills": json.dumps(enriched.get("hard_skills", [])),
            "soft_skills": json.dumps(enriched.get("soft_skills", [])),
            "tools": json.dumps(enriched.get("tools", [])),
            "experience_years": enriched.get("experience_years", "Unknown"),
            "industry": enriched.get("industry", "Other"),
            "apply_url": f"https://www.linkedin.com/jobs/view/{job_id}/" if source == "LinkedIn" else None,
            "scraped_at": now,
            "last_seen_at": now,
            "is_active": True,
            "canonical_job_id": None,
        }

        # Remove None values for cleaner upsert
        record = {k: v for k, v in record.items() if v is not None}

        try:
            supabase.table("jobs").upsert(
                record, on_conflict="source,source_id"
            ).execute()
            written += 1
        except Exception as e:
            errors += 1
            if errors <= 3:
                print(f"    [db] Error writing job {job_id}: {e}")

    print(f"  [db] Written: {written}, Errors: {errors}\n")
    return written, errors


def deactivate_stale_jobs(supabase, days=7):
    """Mark jobs not seen in N days as inactive."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    result = supabase.table("jobs").update(
        {"is_active": False}
    ).eq("is_active", True).lt("last_seen_at", cutoff).execute()

    count = len(result.data) if result.data else 0
    if count > 0:
        print(f"  [db] Deactivated {count} stale jobs (>{days} days unseen)")
    return count
