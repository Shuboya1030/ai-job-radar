"""T-12: Weekly Market Analysis — aggregate job data into market snapshots."""

import sys
import os
import json
from datetime import datetime, timezone, timedelta
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import SUPABASE_URL, SUPABASE_SERVICE_KEY
from supabase import create_client


def run_weekly_analysis():
    print("=" * 60)
    print("  AIJobRadar Weekly Market Analysis")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    for role in ["AI PM", "AI Engineer", "Software Engineer"]:
        print(f"\n--- {role} ---")

        # Query canonical active jobs from past 7 days
        result = supabase.table("jobs").select("*").eq(
            "role_category", role
        ).eq("is_active", True).is_("canonical_job_id", "null").gte(
            "scraped_at", cutoff
        ).execute()

        jobs = result.data or []
        print(f"  Found {len(jobs)} canonical jobs")

        if not jobs:
            continue

        snapshot = build_snapshot(jobs, role, today)

        # Upsert snapshot
        supabase.table("market_snapshots").upsert(
            snapshot, on_conflict="role_category,snapshot_date"
        ).execute()
        print(f"  Snapshot saved for {role}")

    print("\n" + "=" * 60)
    print("  Weekly Analysis Complete!")
    print("=" * 60)


def build_snapshot(jobs, role_category, snapshot_date):
    total = len(jobs)

    def count_json_field(field):
        counter = Counter()
        for job in jobs:
            items = job.get(field, [])
            if isinstance(items, str):
                try:
                    items = json.loads(items)
                except:
                    items = []
            for item in items:
                if item and isinstance(item, str):
                    key = item.strip().title() if len(item.strip()) > 4 else item.strip().upper()
                    counter[key] += 1
        ranked = [{"name": k, "count": v, "pct": round(v / total * 100, 1)}
                  for k, v in counter.most_common(30)]
        return ranked

    hard_skills = count_json_field("hard_skills")
    soft_skills = count_json_field("soft_skills")
    tools = count_json_field("tools")

    # Work type distribution
    wt_counter = Counter(job.get("work_type", "Unknown") for job in jobs)
    work_type_dist = dict(wt_counter)

    # Seniority distribution
    sen_counter = Counter(job.get("seniority", "Unknown") for job in jobs)
    seniority_dist = dict(sen_counter)

    # Experience distribution
    exp_counter = Counter(job.get("experience_years", "Unknown") for job in jobs)
    experience_dist = dict(exp_counter.most_common(10))

    # Salary stats (only jobs with salary_annual_min)
    salary_jobs = [j for j in jobs if j.get("salary_annual_min")]
    salary_pct = round(len(salary_jobs) / total * 100, 1) if total > 0 else 0

    salary_stats = {"overall_avg_min": None, "overall_avg_max": None,
                    "by_seniority": {}, "top_paying_companies": []}

    if salary_jobs:
        mins = [j["salary_annual_min"] for j in salary_jobs if j["salary_annual_min"]]
        maxs = [j["salary_annual_max"] for j in salary_jobs if j.get("salary_annual_max")]
        salary_stats["overall_avg_min"] = int(sum(mins) / len(mins)) if mins else None
        salary_stats["overall_avg_max"] = int(sum(maxs) / len(maxs)) if maxs else None

        # By seniority
        by_sen = {}
        for j in salary_jobs:
            sen = j.get("seniority", "Unknown")
            if sen not in by_sen:
                by_sen[sen] = {"mins": [], "maxs": []}
            if j.get("salary_annual_min"):
                by_sen[sen]["mins"].append(j["salary_annual_min"])
            if j.get("salary_annual_max"):
                by_sen[sen]["maxs"].append(j["salary_annual_max"])

        for sen, data in by_sen.items():
            if data["mins"]:
                salary_stats["by_seniority"][sen] = {
                    "avg_min": int(sum(data["mins"]) / len(data["mins"])),
                    "avg_max": int(sum(data["maxs"]) / len(data["maxs"])) if data["maxs"] else None,
                    "count": len(data["mins"]),
                }

        # Top paying companies (by avg max salary)
        co_salary = {}
        for j in salary_jobs:
            co = j.get("company_id")
            if co and j.get("salary_annual_max"):
                if co not in co_salary:
                    co_salary[co] = []
                co_salary[co].append(j["salary_annual_max"])

        # We need company names - query them
        if co_salary:
            from db import get_supabase
            sb = get_supabase()
            co_ids = list(co_salary.keys())[:50]
            co_result = sb.table("companies").select("id, name").in_("id", co_ids).execute()
            co_names = {c["id"]: c["name"] for c in (co_result.data or [])}

            top_paying = []
            for co_id, salaries in co_salary.items():
                avg_max = int(sum(salaries) / len(salaries))
                name = co_names.get(co_id, "Unknown")
                top_paying.append({"name": name, "avg_max": avg_max})
            top_paying.sort(key=lambda x: -x["avg_max"])
            salary_stats["top_paying_companies"] = top_paying[:15]

    # Top companies (by job count)
    # Need company names
    co_counter = Counter()
    co_id_to_name = {}
    for j in jobs:
        co_id = j.get("company_id")
        if co_id:
            co_counter[co_id] += 1

    if co_counter:
        from db import get_supabase
        sb = get_supabase()
        top_co_ids = [c[0] for c in co_counter.most_common(20)]
        co_result = sb.table("companies").select("id, name").in_("id", top_co_ids).execute()
        co_id_to_name = {c["id"]: c["name"] for c in (co_result.data or [])}

    top_companies = [{"name": co_id_to_name.get(cid, "Unknown"), "count": cnt}
                     for cid, cnt in co_counter.most_common(15)]

    # Top locations
    loc_counter = Counter(j.get("location", "Unknown") for j in jobs if j.get("location"))
    top_locations = [{"name": k, "count": v} for k, v in loc_counter.most_common(15)]

    # Must-have / nice-to-have keywords
    def keyword_tiers(items):
        must = [s["name"] for s in items if s["pct"] >= 30]
        nice = [s["name"] for s in items if 15 <= s["pct"] < 30]
        return must, nice

    must_hard, nice_hard = keyword_tiers(hard_skills)
    must_soft, nice_soft = keyword_tiers(soft_skills)
    must_tools, nice_tools = keyword_tiers(tools)

    return {
        "role_category": role_category,
        "snapshot_date": snapshot_date,
        "total_jobs": total,
        "hard_skills": json.dumps(hard_skills),
        "soft_skills": json.dumps(soft_skills),
        "tools": json.dumps(tools),
        "work_type_dist": json.dumps(work_type_dist),
        "seniority_dist": json.dumps(seniority_dist),
        "salary_stats": json.dumps(salary_stats),
        "top_companies": json.dumps(top_companies),
        "top_locations": json.dumps(top_locations),
        "experience_dist": json.dumps(experience_dist),
        "must_have_keywords": json.dumps({"hard": must_hard, "soft": must_soft, "tools": must_tools}),
        "nice_to_have_keywords": json.dumps({"hard": nice_hard, "soft": nice_soft, "tools": nice_tools}),
        "jobs_with_salary_pct": salary_pct,
    }


if __name__ == "__main__":
    run_weekly_analysis()
