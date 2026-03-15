"""T-13: Company Health Check — verify company websites are still active."""

import sys
import os
import time
import requests
import socket
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import SUPABASE_URL, SUPABASE_SERVICE_KEY
from supabase import create_client


def classify_failure(e, status_code=None):
    """Classify the type of failure."""
    if isinstance(e, socket.gaierror):
        return "dns"
    if "SSL" in str(e) or "TLS" in str(e) or "certificate" in str(e).lower():
        return "tls"
    if status_code:
        if 400 <= status_code < 500:
            return "http_4xx"
        if 500 <= status_code < 600:
            return "http_5xx"
    if "timeout" in str(e).lower() or "Timeout" in str(type(e).__name__):
        return "timeout"
    return "unknown"


def check_company(website):
    """Check if a company website is reachable. Returns (ok, failure_type)."""
    if not website:
        return True, None  # No website = skip, don't penalize

    url = website if website.startswith("http") else f"https://{website}"

    try:
        resp = requests.get(
            url,
            headers={"User-Agent": "Mozilla/5.0 AIJobRadar HealthCheck"},
            timeout=10,
            allow_redirects=True,
        )
        if resp.status_code < 400:
            return True, None
        return False, classify_failure(None, resp.status_code)
    except requests.exceptions.ConnectionError as e:
        return False, classify_failure(e)
    except requests.exceptions.Timeout:
        return False, "timeout"
    except requests.exceptions.SSLError:
        return False, "tls"
    except Exception as e:
        return False, classify_failure(e)


def run_health_check():
    print("=" * 60)
    print("  AIJobRadar Company Health Check")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # Get all active companies with websites
    result = supabase.table("companies").select(
        "id, name, website, health_warnings, canonical_domain"
    ).eq("is_active", True).execute()

    companies = result.data or []
    print(f"\n  Checking {len(companies)} active companies...\n")

    # Get companies with recent jobs (exempt from deactivation)
    cutoff_14d = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
    recent_jobs = supabase.table("jobs").select("company_id").gte(
        "last_seen_at", cutoff_14d
    ).eq("is_active", True).execute()
    companies_with_recent_jobs = set(j["company_id"] for j in (recent_jobs.data or []) if j.get("company_id"))

    healthy = 0
    warned = 0
    deactivated = 0

    for co in companies:
        ok, failure_type = check_company(co.get("website") or co.get("canonical_domain"))

        if ok:
            # Reset warnings
            if co.get("health_warnings", 0) > 0:
                supabase.table("companies").update({
                    "health_warnings": 0,
                    "health_failure_type": None,
                    "last_health_check": datetime.now(timezone.utc).isoformat(),
                }).eq("id", co["id"]).execute()
            healthy += 1
        else:
            new_warnings = (co.get("health_warnings") or 0) + 1
            updates = {
                "health_warnings": new_warnings,
                "health_failure_type": failure_type,
                "last_health_check": datetime.now(timezone.utc).isoformat(),
            }

            # Deactivation rules
            should_deactivate = False
            if failure_type == "dns" and new_warnings >= 3:
                should_deactivate = True
            elif new_warnings >= 5:
                should_deactivate = True

            # Exception: don't deactivate if company has recent jobs
            if should_deactivate and co["id"] in companies_with_recent_jobs:
                print(f"  {co['name']}: {failure_type} x{new_warnings} — EXEMPT (has recent jobs)")
                should_deactivate = False

            if should_deactivate:
                updates["is_active"] = False
                deactivated += 1
                print(f"  {co['name']}: DEACTIVATED ({failure_type} x{new_warnings})")
            else:
                warned += 1

            supabase.table("companies").update(updates).eq("id", co["id"]).execute()

        time.sleep(0.3)

    print(f"\n  Results: {healthy} healthy, {warned} warned, {deactivated} deactivated")
    print("=" * 60)


if __name__ == "__main__":
    run_health_check()
