"""T-07: GPT Enrichment Module — extracts skills, salary, metadata from job descriptions."""

import json
import re
import time
import requests
from config import (
    OPENAI_API_KEY, OPENAI_MODEL, INDUSTRY_ENUM, COMPANY_TYPE_ENUM,
    SENIORITY_ENUM, WORK_TYPE_ENUM, HOURLY_TO_ANNUAL,
)

SYSTEM_PROMPT = """You are an expert at analyzing job descriptions.
Given a job description, extract the following as JSON:
{{
  "hard_skills": ["list of technical/hard skills required"],
  "soft_skills": ["list of soft/interpersonal skills required"],
  "tools": ["list of specific tools, platforms, technologies, programming languages"],
  "salary_min": null or number (raw minimum salary mentioned),
  "salary_max": null or number (raw maximum salary mentioned),
  "salary_type": "Annual" or "Hourly" or "Unknown",
  "work_type": "Remote" or "Hybrid" or "On-site" or "Unknown",
  "seniority": one of [{seniority_list}],
  "experience_years": "e.g. '5+' or '3-5' or 'Unknown'",
  "industry": one of [{industry_list}],
  "company_type": one of [{company_type_list}],
  "employment_type": "Full-time" or "Part-time" or "Contract" or "Internship"
}}

Rules:
- Be specific: prefer "Machine Learning" over "ML", "Distributed Systems" over "systems"
- Normalize tool names: "AWS" not "Amazon Web Services", "Kubernetes" not "K8s"
- For salary: extract the EXACT numbers from the job description. "$126,800 - $220,900" → salary_min: 126800, salary_max: 220900, salary_type: "Annual". "$55.50/hr" → salary_min: 55.5, salary_max: 55.5, salary_type: "Hourly". If no salary mentioned, use null.
- industry MUST be one of the listed options. If unsure, use "Other".
- seniority MUST be one of the listed options. Infer from title and requirements.
- company_type MUST be one of the listed options. Infer from company size/description.
- Return ONLY valid JSON, no markdown formatting, no explanations."""

SYSTEM_PROMPT = SYSTEM_PROMPT.format(
    seniority_list=", ".join(f'"{s}"' for s in SENIORITY_ENUM),
    industry_list=", ".join(f'"{i}"' for i in INDUSTRY_ENUM),
    company_type_list=", ".join(f'"{c}"' for c in COMPANY_TYPE_ENUM),
)


def _validate_enum(value, allowed, default="Unknown"):
    """Validate value against allowed enum, return default if invalid."""
    if value in allowed:
        return value
    # Try case-insensitive match
    for a in allowed:
        if a.lower() == str(value).lower():
            return a
    return default


def _normalize_salary(raw_min, raw_max, salary_type):
    """Convert salary to annualized USD. Returns (annual_min, annual_max)."""
    if raw_min is None and raw_max is None:
        return None, None

    annual_min = None
    annual_max = None

    if salary_type == "Hourly":
        if raw_min is not None:
            annual_min = int(float(raw_min) * HOURLY_TO_ANNUAL)
        if raw_max is not None:
            annual_max = int(float(raw_max) * HOURLY_TO_ANNUAL)
    else:  # Annual or Unknown (assume annual if numbers are large)
        if raw_min is not None:
            val = float(raw_min)
            annual_min = int(val) if val > 1000 else None  # Filter out garbage
        if raw_max is not None:
            val = float(raw_max)
            annual_max = int(val) if val > 1000 else None

    return annual_min, annual_max


def enrich_job(job_title, job_description, job_id="unknown"):
    """Enrich a single job with GPT. Returns dict with extracted fields."""
    if not job_description:
        return _empty_enrichment()

    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }

    desc = job_description[:4000]
    payload = {
        "model": OPENAI_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Job Title: {job_title or 'N/A'}\n\nJob Description:\n{desc}"},
        ],
        "temperature": 0.1,
        "max_tokens": 1000,
    }

    for attempt in range(3):
        try:
            resp = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers, json=payload, timeout=30,
            )
            if resp.status_code == 429:
                time.sleep(5 + attempt * 5)
                continue
            if resp.status_code != 200:
                print(f"  [enrich] OpenAI {resp.status_code} for {job_id}: {resp.text[:150]}")
                time.sleep(2)
                continue

            content = resp.json()["choices"][0]["message"]["content"].strip()
            if content.startswith("```"):
                content = re.sub(r'^```(?:json)?\s*', '', content)
                content = re.sub(r'\s*```$', '', content)

            parsed = json.loads(content)
            return _validate_enrichment(parsed)

        except json.JSONDecodeError:
            print(f"  [enrich] JSON parse error for {job_id}, attempt {attempt+1}")
            time.sleep(1)
        except Exception as e:
            print(f"  [enrich] Error for {job_id}: {e}")
            time.sleep(2)

    return _empty_enrichment()


def _validate_enrichment(data):
    """Validate and normalize GPT output against schema constraints."""
    raw_min = data.get("salary_min")
    raw_max = data.get("salary_max")
    salary_type = _validate_enum(data.get("salary_type", "Unknown"), ["Annual", "Hourly", "Unknown"], "Unknown")

    annual_min, annual_max = _normalize_salary(raw_min, raw_max, salary_type)

    return {
        "hard_skills": data.get("hard_skills", []) or [],
        "soft_skills": data.get("soft_skills", []) or [],
        "tools": data.get("tools", []) or [],
        "salary_annual_min": annual_min,
        "salary_annual_max": annual_max,
        "salary_raw_min": float(raw_min) if raw_min is not None else None,
        "salary_raw_max": float(raw_max) if raw_max is not None else None,
        "salary_raw_type": salary_type,
        "work_type": _validate_enum(data.get("work_type"), WORK_TYPE_ENUM, "Unknown"),
        "seniority": _validate_enum(data.get("seniority"), SENIORITY_ENUM, "Unknown"),
        "experience_years": data.get("experience_years", "Unknown") or "Unknown",
        "industry": _validate_enum(data.get("industry"), INDUSTRY_ENUM, "Other"),
        "company_type": _validate_enum(data.get("company_type"), COMPANY_TYPE_ENUM, "Enterprise"),
        "employment_type": _validate_enum(
            data.get("employment_type"), ["Full-time", "Part-time", "Contract", "Internship"], "Full-time"
        ),
    }


def _empty_enrichment():
    """Return empty enrichment result for failed extractions."""
    return {
        "hard_skills": [], "soft_skills": [], "tools": [],
        "salary_annual_min": None, "salary_annual_max": None,
        "salary_raw_min": None, "salary_raw_max": None, "salary_raw_type": "Unknown",
        "work_type": "Unknown", "seniority": "Unknown",
        "experience_years": "Unknown", "industry": "Other",
        "company_type": "Enterprise", "employment_type": "Full-time",
    }


def enrich_jobs_batch(jobs, role_category):
    """Enrich a batch of jobs. jobs = list of dicts with JobId, JobTitle, JobDescription."""
    print(f"  [enrich] Enriching {len(jobs)} {role_category} jobs...")
    results = []
    for i, job in enumerate(jobs):
        enriched = enrich_job(job.get("JobTitle"), job.get("JobDescription"), job.get("JobId"))
        enriched["JobId"] = job.get("JobId")
        results.append(enriched)
        if (i + 1) % 10 == 0:
            print(f"    {i+1}/{len(jobs)} enriched")
        time.sleep(0.3)
    print(f"  [enrich] Done: {len(results)} enriched.\n")
    return results
