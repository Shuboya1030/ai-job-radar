"""YC Work at a Startup Scraper — extract AI/SWE jobs from YC companies using Playwright."""

import sys
import os
import re
import time
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from playwright.sync_api import sync_playwright
from playwright_stealth import Stealth

# Role pages on YC WaaS
YC_ROLE_URLS = [
    {"url": "https://www.workatastartup.com/jobs?role=eng", "category": "Software Engineer"},
    {"url": "https://www.workatastartup.com/jobs?role=eng&type=machine-learning", "category": "AI Engineer"},
    {"url": "https://www.workatastartup.com/jobs?role=product", "category": "AI PM"},
]


def _create_browser(playwright):
    """Create stealth browser context."""
    stealth = Stealth()
    browser = playwright.chromium.launch(
        headless=False,
        args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
    )
    context = browser.new_context(viewport={"width": 1920, "height": 1080}, locale="en-US")
    stealth.apply_stealth_sync(context)
    page = context.new_page()
    return browser, page


def _handle_cloudflare(page):
    """Wait for Cloudflare challenge if present."""
    if "Just a moment" in page.title():
        print("    Cloudflare detected, waiting...")
        page.wait_for_timeout(15000)


def _scroll_to_load(page, max_scrolls=10):
    """Scroll down to trigger lazy loading."""
    for i in range(max_scrolls):
        prev_height = page.evaluate("document.body.scrollHeight")
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(2000)
        new_height = page.evaluate("document.body.scrollHeight")
        if new_height == prev_height:
            break
    # Scroll back to top
    page.evaluate("window.scrollTo(0, 0)")


def _parse_yc_jobs(page):
    """Parse job listings from YC WaaS page text."""
    jobs = []
    text = page.inner_text("body")
    if not text:
        return jobs

    lines = [l.strip() for l in text.split("\n") if l.strip()]

    # YC format: Company (Batch) Description (time ago)
    # Next line: Job Title
    # Next line: Type Location Specialty
    i = 0
    while i < len(lines) - 2:
        line = lines[i]

        # Detect company line: contains (W/S + 2 digits) batch pattern
        batch_match = re.search(r"\(([WS]\d{2})\)", line)
        if batch_match:
            batch = batch_match.group(1)
            # Company name is before the batch
            company_name = line[:batch_match.start()].strip().rstrip("\u00b7").strip()

            # Time posted
            time_match = re.search(r"\((\d+ (?:days?|hours?|weeks?) ago)\)", line)
            time_posted = time_match.group(1) if time_match else None

            # Next line should be job title
            if i + 1 < len(lines):
                title = lines[i + 1].strip()
                # Skip if it looks like another company line
                if re.search(r"\([WS]\d{2}\)", title):
                    i += 1
                    continue

                # Next line: metadata (Fulltime, location, specialty)
                meta = lines[i + 2].strip() if i + 2 < len(lines) else ""

                # Parse location from meta
                location = None
                work_type = "Unknown"
                if "Remote" in meta:
                    work_type = "Remote"
                    location = "Remote"
                else:
                    # Try to extract city, state pattern
                    loc_match = re.search(r"(?:Fulltime|Parttime|Contract|Internship)\s*(.+?)(?:Full Stack|Backend|Frontend|Machine Learning|Data|DevOps|iOS|Android|$)", meta)
                    if loc_match:
                        location = loc_match.group(1).strip().rstrip(",")

                employment_type = "Full-time"
                if "Parttime" in meta:
                    employment_type = "Part-time"
                elif "Contract" in meta:
                    employment_type = "Contract"
                elif "Internship" in meta:
                    employment_type = "Internship"

                # Create unique source ID
                source_id = f"yc-{company_name}-{title}".lower().replace(" ", "-")[:100]

                # YC apply URL pattern
                company_slug = company_name.lower().replace(" ", "-").replace(".", "")
                apply_url = f"https://www.workatastartup.com/companies/{company_slug}"

                jobs.append({
                    "JobId": source_id,
                    "JobTitle": title,
                    "CompanyName": company_name,
                    "CompanyUrl": apply_url,
                    "Location": location,
                    "TimePosted": time_posted,
                    "JobDescription": f"{title} at {company_name} (YC {batch}). {meta}",
                    "SeniorityLevel": None,
                    "EmploymentType": employment_type,
                    "apply_url": apply_url,
                    "_source": "YC",
                    "_batch": batch,
                    "_work_type": work_type,
                })

                i += 3
                continue

        i += 1

    return jobs


def scrape_yc(max_per_role=50):
    """Scrape YC Work at a Startup for all roles."""
    all_jobs = []

    print("\n[yc] Starting YC Work at a Startup scraper...")

    with sync_playwright() as p:
        browser, page = _create_browser(p)

        for role_config in YC_ROLE_URLS:
            url = role_config["url"]
            category = role_config["category"]

            print(f"\n  [yc] Scraping {category}...")
            try:
                page.goto(url, timeout=30000)
                page.wait_for_timeout(5000)
                _handle_cloudflare(page)

                # Scroll to load more jobs
                _scroll_to_load(page, max_scrolls=5)

                jobs = _parse_yc_jobs(page)
                # Tag with role category
                for job in jobs:
                    job["_role_category"] = category

                jobs = jobs[:max_per_role]
                all_jobs.extend(jobs)
                print(f"    Found {len(jobs)} jobs")

            except Exception as e:
                print(f"    Error: {e}")

            time.sleep(3)

        browser.close()

    print(f"\n  [yc] Total: {len(all_jobs)} jobs scraped")
    return all_jobs


if __name__ == "__main__":
    jobs = scrape_yc(max_per_role=20)
    for j in jobs[:10]:
        print(f"  {j['CompanyName']:20s} | {j['JobTitle']:40s} | {j.get('Location', 'N/A')}")
