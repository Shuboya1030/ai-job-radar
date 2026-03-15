"""T-04: LinkedIn Scraper — fetches job IDs and details from LinkedIn guest API."""

import requests
from bs4 import BeautifulSoup
import time
import re
from datetime import datetime, timezone
from config import HEADERS, SEARCH_LOCATION, TARGET_JOB_COUNT, TIME_FILTER


def fetch_job_ids(search_keywords, target_count=TARGET_JOB_COUNT):
    """Fetch job IDs from LinkedIn guest search API."""
    job_ids = []
    page = 0
    retries = 0

    print(f"  [linkedin] Fetching IDs for '{search_keywords}'...")

    while len(job_ids) < target_count and retries < 10:
        url = (
            f"https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
            f"?keywords={requests.utils.quote(search_keywords)}"
            f"&location={requests.utils.quote(SEARCH_LOCATION)}"
            f"&sortBy=DD&start={page * 10}"
            f"&f_TPR={TIME_FILTER}"
        )
        try:
            resp = requests.get(url, headers=HEADERS, timeout=15)
            if resp.status_code == 429:
                time.sleep(2 + retries * 2)
                retries += 1
                continue
            if resp.status_code != 200:
                retries += 1
                time.sleep(1)
                continue

            soup = BeautifulSoup(resp.text, "html.parser")
            items = soup.find_all("li")
            if not items:
                break

            for item in items:
                urn = item.find("div", {"data-entity-urn": True})
                if urn:
                    jid = urn["data-entity-urn"].split(":")[-1]
                    if jid not in job_ids:
                        job_ids.append(jid)

            retries = 0
            page += 1
            print(f"    Page {page}: {len(job_ids)} IDs")
            time.sleep(0.5)
        except Exception as e:
            print(f"    Error page {page}: {e}")
            retries += 1
            time.sleep(1)

    job_ids = job_ids[:target_count]
    print(f"  [linkedin] Collected {len(job_ids)} IDs.\n")
    return job_ids


def _safe_text(soup, selector, attr=None):
    """Safely extract text from a soup element."""
    try:
        el = soup.select_one(selector)
        if el:
            return el[attr].strip() if attr else el.get_text(strip=True)
    except Exception:
        pass
    return None


def fetch_job_details(job_ids):
    """Fetch full job details for each job ID."""
    jobs = []
    print(f"  [linkedin] Fetching details for {len(job_ids)} jobs...")

    for i, job_id in enumerate(job_ids):
        url = f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}"
        for attempt in range(5):
            try:
                resp = requests.get(url, headers=HEADERS, timeout=15)
                if resp.status_code == 429:
                    time.sleep(2 + attempt * 2)
                    continue
                if resp.status_code != 200:
                    time.sleep(1)
                    continue

                soup = BeautifulSoup(resp.text, "html.parser")
                job = {"JobId": job_id}

                job["JobTitle"] = _safe_text(soup, "h2.top-card-layout__title")

                # Company
                co = soup.select_one("a.topcard__org-name-link")
                if co:
                    job["CompanyName"] = co.get_text(strip=True)
                    job["CompanyUrl"] = co.get("href", "").strip()
                else:
                    job["CompanyName"] = None
                    job["CompanyUrl"] = None

                job["Location"] = _safe_text(soup, "span.topcard__flavor.topcard__flavor--bullet")
                job["TimePosted"] = _safe_text(soup, "span.posted-time-ago__text")

                # Description
                desc_div = soup.select_one("div.show-more-less-html__markup")
                job["JobDescription"] = desc_div.get_text(separator=" ", strip=True) if desc_div else None

                # Criteria
                criteria = soup.select("ul.description__job-criteria-list li")
                labels = ["SeniorityLevel", "EmploymentType", "JobFunction", "Industries"]
                for idx, label in enumerate(labels):
                    if idx < len(criteria):
                        span = criteria[idx].select_one("span.description__job-criteria-text")
                        job[label] = span.get_text(strip=True) if span else None
                    else:
                        job[label] = None

                job["ExtractionDatetime"] = datetime.now(timezone.utc).isoformat()
                jobs.append(job)
                break
            except Exception:
                time.sleep(1)

        if (i + 1) % 10 == 0:
            print(f"    {i+1}/{len(job_ids)} fetched")
        time.sleep(0.4)

    print(f"  [linkedin] Fetched {len(jobs)} job details.\n")
    return jobs


def scrape_linkedin(search_keywords, role_category, target_count=TARGET_JOB_COUNT):
    """Full LinkedIn scrape pipeline for one role. Returns (jobs, role_category)."""
    print(f"\n{'='*50}")
    print(f"  LinkedIn: {search_keywords} ({role_category})")
    print(f"{'='*50}")

    job_ids = fetch_job_ids(search_keywords, target_count)
    if not job_ids:
        print(f"  No IDs found for {search_keywords}")
        return [], role_category

    jobs = fetch_job_details(job_ids)
    # Tag each job with source info
    for job in jobs:
        job["_source"] = "LinkedIn"
        job["_role_category"] = role_category

    return jobs, role_category
