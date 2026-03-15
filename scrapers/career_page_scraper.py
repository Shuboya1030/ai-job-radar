"""Career Page Scraper — find jobs on startup career pages (Greenhouse, Lever, Ashby)."""

import sys
import os
import re
import time
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import HEADERS, ROLES

# Common ATS URL patterns
ATS_PATTERNS = [
    # Greenhouse
    {"pattern": "boards.greenhouse.io/{slug}", "type": "greenhouse"},
    {"pattern": "{domain}/careers", "type": "generic"},
    {"pattern": "{domain}/jobs", "type": "generic"},
    # Lever
    {"pattern": "jobs.lever.co/{slug}", "type": "lever"},
    # Ashby
    {"pattern": "jobs.ashbyhq.com/{slug}", "type": "ashby"},
]

AI_KEYWORDS = [
    "ai", "machine learning", "ml engineer", "data scientist",
    "software engineer", "product manager", "ai pm",
    "deep learning", "nlp", "computer vision", "llm",
]


def _try_greenhouse(company_name):
    """Try to find jobs on Greenhouse for a company."""
    slug = company_name.lower().replace(" ", "").replace(".", "").replace(",", "")
    url = f"https://boards.greenhouse.io/{slug}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        if resp.status_code != 200:
            return []

        soup = BeautifulSoup(resp.text, "html.parser")
        jobs = []

        # Greenhouse uses specific class patterns
        openings = soup.select(".opening a, [class*='job-post'] a, .opening")
        for opening in openings:
            link = opening.get("href") or ""
            title = opening.get_text(strip=True)
            if not title or len(title) < 5:
                continue

            # Filter for AI/SWE related roles
            title_lower = title.lower()
            if not any(kw in title_lower for kw in AI_KEYWORDS):
                continue

            full_url = f"https://boards.greenhouse.io{link}" if link.startswith("/") else link

            jobs.append({
                "JobId": f"gh-{slug}-{hash(title) % 100000}",
                "JobTitle": title,
                "CompanyName": company_name,
                "CompanyUrl": url,
                "Location": None,
                "JobDescription": title,  # Will be enriched later if needed
                "apply_url": full_url,
                "_source": "Greenhouse",
            })

        return jobs
    except Exception:
        return []


def _try_lever(company_name):
    """Try to find jobs on Lever for a company."""
    slug = company_name.lower().replace(" ", "").replace(".", "")
    url = f"https://jobs.lever.co/{slug}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        if resp.status_code != 200:
            return []

        soup = BeautifulSoup(resp.text, "html.parser")
        jobs = []

        postings = soup.select(".posting")
        for posting in postings:
            title_el = posting.select_one(".posting-title h5, .posting-name")
            title = title_el.get_text(strip=True) if title_el else ""
            if not title:
                continue

            title_lower = title.lower()
            if not any(kw in title_lower for kw in AI_KEYWORDS):
                continue

            link_el = posting.select_one("a.posting-title, a")
            link = link_el.get("href", "") if link_el else ""

            location_el = posting.select_one(".posting-categories .location, .sort-by-location")
            location = location_el.get_text(strip=True) if location_el else None

            jobs.append({
                "JobId": f"lever-{slug}-{hash(title) % 100000}",
                "JobTitle": title,
                "CompanyName": company_name,
                "CompanyUrl": url,
                "Location": location,
                "JobDescription": title,
                "apply_url": link,
                "_source": "Lever",
            })

        return jobs
    except Exception:
        return []


def _try_ashby(company_name):
    """Try to find jobs on Ashby for a company."""
    slug = company_name.lower().replace(" ", "").replace(".", "")
    url = f"https://jobs.ashbyhq.com/{slug}"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        if resp.status_code != 200:
            return []

        soup = BeautifulSoup(resp.text, "html.parser")
        jobs = []

        # Ashby renders jobs in a specific structure
        postings = soup.select("[class*='posting'], a[href*='/jobs/']")
        for posting in postings:
            title = posting.get_text(strip=True)
            if not title or len(title) < 5 or len(title) > 200:
                continue

            title_lower = title.lower()
            if not any(kw in title_lower for kw in AI_KEYWORDS):
                continue

            link = posting.get("href", "")
            full_url = f"https://jobs.ashbyhq.com{link}" if link.startswith("/") else link

            jobs.append({
                "JobId": f"ashby-{slug}-{hash(title) % 100000}",
                "JobTitle": title,
                "CompanyName": company_name,
                "CompanyUrl": url,
                "Location": None,
                "JobDescription": title,
                "apply_url": full_url,
                "_source": "Ashby",
            })

        return jobs
    except Exception:
        return []


def scrape_career_pages(supabase, max_companies=50):
    """
    For companies discovered via news (source=Manual) or with known websites,
    try to find AI-related job openings on their career pages.
    """
    print("\n[careers] Scanning startup career pages...")

    # Get companies from discovery pipeline that might have career pages
    result = supabase.table("companies").select(
        "id, name, website, canonical_domain"
    ).eq("is_active", True).limit(max_companies).execute()

    companies = result.data or []
    print(f"  Checking {len(companies)} companies for career pages...")

    all_jobs = []
    found_companies = 0

    for i, co in enumerate(companies):
        name = co["name"]
        jobs = []

        # Try each ATS platform
        jobs.extend(_try_greenhouse(name))
        jobs.extend(_try_lever(name))
        jobs.extend(_try_ashby(name))

        if jobs:
            found_companies += 1
            print(f"  {name}: {len(jobs)} AI jobs found")
            for j in jobs:
                j["_role_category"] = _guess_role(j["JobTitle"])
                j["_company_id_hint"] = co["id"]
            all_jobs.extend(jobs)

        if (i + 1) % 20 == 0:
            print(f"    {i+1}/{len(companies)} checked ({found_companies} with jobs)")

        time.sleep(0.3)  # Be polite

    print(f"\n  [careers] Done: {len(all_jobs)} jobs from {found_companies} companies")
    return all_jobs


def _guess_role(title):
    """Guess role category from job title."""
    t = title.lower()
    if any(kw in t for kw in ["product manager", "pm", "product lead"]):
        return "AI PM"
    if any(kw in t for kw in ["ml engineer", "machine learning", "ai engineer", "deep learning", "nlp", "computer vision"]):
        return "AI Engineer"
    return "Software Engineer"


if __name__ == "__main__":
    from db import get_supabase
    supabase = get_supabase()
    jobs = scrape_career_pages(supabase, max_companies=30)
    for j in jobs[:10]:
        print(f"  {j['CompanyName']:20s} | {j['JobTitle']:50s} | {j.get('_source', '')}")
