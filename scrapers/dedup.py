"""T-09: Cross-Source Deduplication — detect same job across LinkedIn/Wellfound/YC."""

import sys
import os
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from company_manager import normalize_title


def deduplicate_jobs(supabase):
    """
    Find and mark duplicate jobs across sources.
    Match on: company_id + title_normalized + location
    Richer source wins (more non-NULL fields).
    Winner: canonical_job_id = NULL
    Loser: canonical_job_id = winner's ID
    """
    print("[dedup] Running cross-source deduplication...")

    # Get all active canonical jobs (not already marked as duplicates)
    result = supabase.table("jobs").select(
        "id, source, company_id, title_normalized, location, "
        "salary_annual_min, salary_annual_max, description, hard_skills, soft_skills, tools"
    ).eq("is_active", True).is_("canonical_job_id", "null").execute()

    jobs = result.data or []
    print(f"  {len(jobs)} canonical jobs to check")

    # Group by (company_id, title_normalized, location)
    groups = {}
    for job in jobs:
        key = (
            job.get("company_id"),
            (job.get("title_normalized") or "").strip().lower(),
            (job.get("location") or "").strip().lower(),
        )
        # Skip if no company or no title
        if not key[0] or not key[1]:
            continue
        if key not in groups:
            groups[key] = []
        groups[key].append(job)

    # Find duplicates (groups with > 1 job)
    dupes_found = 0
    for key, group in groups.items():
        if len(group) <= 1:
            continue

        # Pick winner: most non-NULL fields
        def richness(j):
            score = 0
            if j.get("salary_annual_min"): score += 2
            if j.get("description"): score += 1
            if j.get("hard_skills") and j["hard_skills"] != "[]": score += 1
            if j.get("tools") and j["tools"] != "[]": score += 1
            return score

        group.sort(key=richness, reverse=True)
        winner = group[0]
        losers = group[1:]

        for loser in losers:
            supabase.table("jobs").update({
                "canonical_job_id": winner["id"]
            }).eq("id", loser["id"]).execute()
            dupes_found += 1

    print(f"  [dedup] Done: {dupes_found} duplicates marked\n")
    return dupes_found


if __name__ == "__main__":
    from db import get_supabase
    supabase = get_supabase()
    deduplicate_jobs(supabase)
