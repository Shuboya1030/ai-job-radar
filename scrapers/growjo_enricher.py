"""Growjo Company Enricher — scrape funding, revenue, employee data from Growjo."""

import re
import time
import requests
from bs4 import BeautifulSoup
from config import HEADERS

GROWJO_URL = "https://growjo.com/company/{}"


def fetch_growjo_data(company_name):
    """Fetch company data from Growjo. Returns dict or None."""
    # Growjo URL uses company name with spaces replaced by hyphens or exact name
    slug = company_name.strip()
    url = GROWJO_URL.format(requests.utils.quote(slug))

    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code != 200:
            return None

        soup = BeautifulSoup(resp.text, "html.parser")
        text = soup.get_text(" ", strip=True)

        data = {}

        # Total Funding
        m = re.search(r'\$([\d,.]+)([BMK]?)\s*Total\s*Funding', text, re.IGNORECASE)
        if m:
            data["total_funding"] = _parse_money(m.group(1), m.group(2))

        # Estimated Revenue
        m = re.search(r'estimated\s*annual\s*revenue\s*is\s*currently\s*\$([\d,.]+)([BMK]?)', text, re.IGNORECASE)
        if m:
            data["estimated_revenue"] = _parse_money(m.group(1), m.group(2))

        # Valuation
        m = re.search(r'valuation\s*is\s*\$([\d,.]+)([BMK]?)', text, re.IGNORECASE)
        if m:
            data["valuation"] = _parse_money(m.group(1), m.group(2))

        # Employees
        m = re.search(r'has\s*([\d,]+)\s*Employees?', text, re.IGNORECASE)
        if m:
            data["employees"] = int(m.group(1).replace(",", ""))

        # Employee growth
        m = re.search(r'employee\s*count\s*by\s*(\d+)%', text, re.IGNORECASE)
        if m:
            data["employee_growth_pct"] = int(m.group(1))

        # Industry
        m = re.search(r'Total\s*Funding\s+(\w[\w\s/&]*?)\s+Industry', text)
        if m:
            data["growjo_industry"] = m.group(1).strip()

        return data if data else None

    except Exception as e:
        print(f"    [growjo] Error for {company_name}: {e}")
        return None


def _parse_money(num_str, suffix):
    """Parse '$33.7B' style into cents (integer)."""
    val = float(num_str.replace(",", ""))
    multiplier = {"B": 1_000_000_000, "M": 1_000_000, "K": 1_000, "": 1}
    dollars = val * multiplier.get(suffix.upper(), 1)
    return int(dollars * 100)  # cents


def _employee_range(count):
    """Convert employee count to range enum."""
    if count <= 10: return "1-10"
    if count <= 50: return "11-50"
    if count <= 200: return "51-200"
    if count <= 500: return "201-500"
    if count <= 1000: return "501-1000"
    if count <= 5000: return "1001-5000"
    return "5000+"


def _guess_funding_stage(total_funding_cents):
    """Guess funding stage from total funding amount."""
    dollars = total_funding_cents / 100
    if dollars < 500_000: return "Pre-seed"
    if dollars < 5_000_000: return "Seed"
    if dollars < 20_000_000: return "Series A"
    if dollars < 60_000_000: return "Series B"
    if dollars < 200_000_000: return "Series C"
    if dollars < 1_000_000_000: return "Series D+"
    return "Series D+"


def enrich_companies_from_growjo(supabase):
    """Enrich all companies in database with Growjo data."""
    print("\n[growjo] Enriching companies with funding data...")

    # Get all active companies
    result = supabase.table("companies").select(
        "id, name, funding_amount_cents, funding_amount_status"
    ).eq("is_active", True).execute()

    companies = result.data or []
    print(f"  Found {len(companies)} active companies")

    enriched = 0
    skipped = 0
    not_found = 0

    for i, co in enumerate(companies):
        # Skip if already has known funding
        if co.get("funding_amount_status") == "known" and co.get("funding_amount_cents"):
            skipped += 1
            continue

        name = co["name"]
        data = fetch_growjo_data(name)

        if not data:
            not_found += 1
            if (i + 1) % 20 == 0:
                print(f"    {i+1}/{len(companies)} processed")
            time.sleep(0.5)
            continue

        updates = {}

        # Funding — upgrade only
        if "total_funding" in data:
            new_funding = data["total_funding"]
            old_funding = co.get("funding_amount_cents") or 0
            if new_funding > old_funding:
                updates["funding_amount_cents"] = new_funding
                updates["funding_amount_status"] = "known"
                updates["funding_stage"] = _guess_funding_stage(new_funding)

        # Employees
        if "employees" in data:
            updates["employee_range"] = _employee_range(data["employees"])

        if updates:
            updates["updated_at"] = "now()"
            supabase.table("companies").update(updates).eq("id", co["id"]).execute()
            enriched += 1

        if (i + 1) % 20 == 0:
            print(f"    {i+1}/{len(companies)} processed ({enriched} enriched)")

        time.sleep(0.5)  # Be nice to Growjo

    print(f"  [growjo] Done: {enriched} enriched, {skipped} already known, {not_found} not found\n")
    return enriched


if __name__ == "__main__":
    import sys, os
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from db import get_supabase
    supabase = get_supabase()
    enrich_companies_from_growjo(supabase)
