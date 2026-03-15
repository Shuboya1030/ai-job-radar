"""Shared configuration for all scrapers."""
import os

# ─── API Keys ────────────────────────────────────────────────────────────────
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# ─── Scraper Settings ────────────────────────────────────────────────────────
OPENAI_MODEL = "gpt-4o-mini"
SEARCH_LOCATION = "United States"
TARGET_JOB_COUNT = 100
TIME_FILTER = "r604800"  # Past week

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

# ─── Role Definitions ────────────────────────────────────────────────────────
ROLES = [
    {"keywords": "AI Product Manager", "category": "AI PM"},
    {"keywords": "AI Engineer", "category": "AI Engineer"},
    {"keywords": "Software Engineer", "category": "Software Engineer"},
]

# ─── Enum Constraints (must match database schema) ────────────────────────────
INDUSTRY_ENUM = [
    "AI/ML", "Fintech", "Healthcare", "E-commerce", "SaaS",
    "Cybersecurity", "Robotics", "EdTech", "Adtech",
    "Cloud/Infra", "Gaming", "Automotive", "Biotech",
    "Enterprise Software", "Social/Media", "Other",
]

COMPANY_TYPE_ENUM = ["Startup", "Scale-up", "Big Tech", "Enterprise"]

SENIORITY_ENUM = [
    "Intern", "Junior", "Mid", "Senior", "Staff",
    "Principal", "Lead", "Manager", "Unknown",
]

WORK_TYPE_ENUM = ["Remote", "Hybrid", "On-site", "Unknown"]

EMPLOYMENT_TYPE_ENUM = ["Full-time", "Part-time", "Contract", "Internship"]

HOURLY_TO_ANNUAL = 2080  # Standard work hours per year
