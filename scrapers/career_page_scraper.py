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

AI_KEYWORDS = [
    "ai", "machine learning", "ml engineer", "data scientist",
    "software engineer", "product manager", "ai pm",
    "deep learning", "nlp", "computer vision", "llm",
]


def _fetch_page(url):
    """Fetch a page with error handling."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        if resp.status_code != 200:
            return None
        return BeautifulSoup(resp.text, "html.parser")
    except Exception:
        return None


def _try_greenhouse(company_name):
    """Find jobs on Greenhouse — fetches listing page then each job detail."""
    slug = company_name.lower().replace(" ", "").replace(".", "").replace(",", "")
    list_url = f"https://boards.greenhouse.io/{slug}"

    soup = _fetch_page(list_url)
    if not soup:
        return []

    jobs = []
    openings = soup.select(".opening a")

    for opening in openings:
        link = opening.get("href", "")
        title = opening.get_text(strip=True)
        if not title or len(title) < 5:
            continue

        title_lower = title.lower()
        if not any(kw in title_lower for kw in AI_KEYWORDS):
            continue

        # Build full detail URL
        if link.startswith("/"):
            detail_url = f"https://boards.greenhouse.io{link}"
        elif link.startswith("http"):
            detail_url = link
        else:
            continue

        # Fetch detail page for JD + apply URL
        detail_soup = _fetch_page(detail_url)
        description = ""
        apply_url = detail_url  # Default: the detail page IS the apply page

        if detail_soup:
            # Extract description
            content = detail_soup.select_one("#content, .content, [class*='job-description'], [class*='body']")
            if content:
                description = content.get_text(separator="\n", strip=True)[:5000]

            # Extract location
            location_el = detail_soup.select_one(".location, [class*='location']")
            location = location_el.get_text(strip=True) if location_el else None

            # Find apply button/link
            apply_el = detail_soup.select_one("a[href*='apply'], a[class*='apply'], #apply_button, a[data-job-id]")
            if apply_el and apply_el.get("href"):
                href = apply_el["href"]
                if href.startswith("http"):
                    apply_url = href
                elif href.startswith("/"):
                    apply_url = f"https://boards.greenhouse.io{href}"
        else:
            location = None

        # Skip if still no real description
        if len(description) < 50:
            description = f"View full job description at {detail_url}"

        jobs.append({
            "JobId": f"gh-{slug}-{hash(title + str(location)) % 100000}",
            "JobTitle": title,
            "CompanyName": company_name,
            "CompanyUrl": list_url,
            "Location": location,
            "JobDescription": description,
            "apply_url": apply_url,
            "_source": "Greenhouse",
        })

        time.sleep(0.3)  # Be polite

    return jobs


def _try_lever(company_name):
    """Find jobs on Lever — fetches listing page then each job detail."""
    slug = company_name.lower().replace(" ", "").replace(".", "")
    list_url = f"https://jobs.lever.co/{slug}"

    soup = _fetch_page(list_url)
    if not soup:
        return []

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

        # Get detail page URL
        link_el = posting.select_one("a.posting-title, a[href*='/lever.co/']")
        detail_url = link_el.get("href", "") if link_el else ""
        if not detail_url or not detail_url.startswith("http"):
            continue

        # Location from listing
        location_el = posting.select_one(".posting-categories .location, .sort-by-location")
        location = location_el.get_text(strip=True) if location_el else None

        # Fetch detail page for JD
        detail_soup = _fetch_page(detail_url)
        description = ""
        apply_url = f"{detail_url}/apply"  # Lever convention: /apply suffix

        if detail_soup:
            # Lever detail pages have content in specific divs
            content_parts = detail_soup.select("[class*='section-wrapper'] .content, .posting-page .content, [data-qa='job-description']")
            if content_parts:
                description = "\n".join(p.get_text(separator="\n", strip=True) for p in content_parts)[:5000]
            else:
                # Fallback: get all text from main content area
                main = detail_soup.select_one(".content, .posting-page, main")
                if main:
                    description = main.get_text(separator="\n", strip=True)[:5000]

        if len(description) < 50:
            description = f"View full job description at {detail_url}"

        jobs.append({
            "JobId": f"lever-{slug}-{hash(title + str(location)) % 100000}",
            "JobTitle": title,
            "CompanyName": company_name,
            "CompanyUrl": list_url,
            "Location": location,
            "JobDescription": description,
            "apply_url": apply_url,
            "_source": "Lever",
        })

        time.sleep(0.3)

    return jobs


def _try_ashby(company_name):
    """Find jobs on Ashby."""
    slug = company_name.lower().replace(" ", "").replace(".", "")
    list_url = f"https://jobs.ashbyhq.com/{slug}"

    soup = _fetch_page(list_url)
    if not soup:
        return []

    jobs = []
    postings = soup.select("a[href*='/jobs/']")

    for posting in postings:
        title = posting.get_text(strip=True)
        if not title or len(title) < 5 or len(title) > 200:
            continue

        title_lower = title.lower()
        if not any(kw in title_lower for kw in AI_KEYWORDS):
            continue

        link = posting.get("href", "")
        detail_url = f"https://jobs.ashbyhq.com{link}" if link.startswith("/") else link

        if not detail_url.startswith("http"):
            continue

        # Fetch detail for JD
        detail_soup = _fetch_page(detail_url)
        description = ""

        if detail_soup:
            content = detail_soup.select_one("[class*='description'], [class*='content'], main")
            if content:
                description = content.get_text(separator="\n", strip=True)[:5000]

        if len(description) < 50:
            description = f"View full job description at {detail_url}"

        jobs.append({
            "JobId": f"ashby-{slug}-{hash(title) % 100000}",
            "JobTitle": title,
            "CompanyName": company_name,
            "CompanyUrl": list_url,
            "Location": None,
            "JobDescription": description,
            "apply_url": detail_url,
            "_source": "Ashby",
        })

        time.sleep(0.3)

    return jobs


def scrape_career_pages(supabase, max_companies=50):
    """For known companies, try to find AI-related jobs on their career pages."""
    print("\n[careers] Scanning startup career pages...")

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

        jobs.extend(_try_greenhouse(name))
        jobs.extend(_try_lever(name))
        jobs.extend(_try_ashby(name))

        if jobs:
            found_companies += 1
            # Only count jobs that have actual content
            quality_jobs = [j for j in jobs if j.get("apply_url") and len(j.get("JobDescription", "")) > 50]
            if quality_jobs:
                print(f"  {name}: {len(quality_jobs)} AI jobs found (with JD)")
                for j in quality_jobs:
                    j["_role_category"] = _guess_role(j["JobTitle"])
                    j["_company_id_hint"] = co["id"]
                all_jobs.extend(quality_jobs)

        if (i + 1) % 20 == 0:
            print(f"    {i+1}/{len(companies)} checked ({found_companies} with jobs)")

        time.sleep(0.3)

    print(f"\n  [careers] Done: {len(all_jobs)} quality jobs from {found_companies} companies")
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
        desc_len = len(j.get("JobDescription", ""))
        has_apply = "YES" if j.get("apply_url") else "NO"
        print(f"  {j['CompanyName']:20s} | {j['JobTitle'][:40]:40s} | desc: {desc_len} chars | apply: {has_apply}")
