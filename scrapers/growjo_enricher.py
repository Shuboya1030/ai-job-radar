"""Growjo Company Enricher — scrape funding data using Playwright stealth."""

import re
import time
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from playwright.sync_api import sync_playwright
from playwright_stealth import Stealth


def _parse_money(num_str, suffix):
    """Parse '$33.7B' into cents."""
    val = float(num_str.replace(",", ""))
    mult = {"B": 1_000_000_000, "M": 1_000_000, "K": 1_000, "": 1}
    return int(val * mult.get(suffix.upper(), 1) * 100)


def _employee_range(count):
    if count <= 10: return "1-10"
    if count <= 50: return "11-50"
    if count <= 200: return "51-200"
    if count <= 500: return "201-500"
    if count <= 1000: return "501-1000"
    if count <= 5000: return "1001-5000"
    return "5000+"


def _guess_stage(cents):
    d = cents / 100
    if d < 500_000: return "Pre-seed"
    if d < 5_000_000: return "Seed"
    if d < 20_000_000: return "Series A"
    if d < 60_000_000: return "Series B"
    if d < 200_000_000: return "Series C"
    return "Series D+"


def fetch_growjo_page(page, company_name):
    """Fetch a single company from Growjo. Returns dict or None."""
    url = f"https://growjo.com/company/{company_name.strip()}"
    try:
        page.goto(url, timeout=20000)
        page.wait_for_timeout(3000)

        title = page.title()
        if "Just a moment" in title:
            page.wait_for_timeout(12000)

        text = page.inner_text("body")
        data = {}

        m = re.search(r"\$([\d,.]+)([BMK]?)\s*Total\s*Funding", text)
        if m:
            data["total_funding"] = _parse_money(m.group(1), m.group(2))

        m = re.search(r"has\s*([\d,]+)\s*Employees?", text, re.IGNORECASE)
        if m:
            data["employees"] = int(m.group(1).replace(",", ""))

        return data if data else None
    except Exception as e:
        print(f"    [growjo] Error for {company_name}: {e}")
        return None


def enrich_companies_from_growjo(supabase, batch_size=50):
    """Enrich companies with Growjo funding data using Playwright stealth."""
    print("\n[growjo] Enriching companies with Playwright stealth...")

    result = supabase.table("companies").select(
        "id, name, funding_amount_cents, funding_amount_status"
    ).eq("is_active", True).execute()

    companies = result.data or []
    # Prioritize companies without known funding
    companies = sorted(companies, key=lambda c: (c.get("funding_amount_status") == "known", c["name"]))
    companies = companies[:batch_size]

    print(f"  Processing {len(companies)} companies (batch_size={batch_size})")

    stealth = Stealth()

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
        )
        context = browser.new_context(viewport={"width": 1920, "height": 1080}, locale="en-US")
        stealth.apply_stealth_sync(context)
        page = context.new_page()

        # Warm up with homepage
        print("  Visiting Growjo homepage...")
        page.goto("https://growjo.com/", timeout=30000)
        page.wait_for_timeout(5000)
        if "Just a moment" in page.title():
            print("  Waiting for Cloudflare...")
            page.wait_for_timeout(15000)
        print(f"  Homepage: {page.title()}")

        enriched = 0
        not_found = 0
        skipped = 0

        for i, co in enumerate(companies):
            if co.get("funding_amount_status") == "known" and co.get("funding_amount_cents"):
                skipped += 1
                continue

            data = fetch_growjo_page(page, co["name"])

            if not data:
                not_found += 1
            else:
                updates = {}
                if "total_funding" in data:
                    new_val = data["total_funding"]
                    old_val = co.get("funding_amount_cents") or 0
                    if new_val > old_val:
                        updates["funding_amount_cents"] = new_val
                        updates["funding_amount_status"] = "known"
                        updates["funding_stage"] = _guess_stage(new_val)

                if "employees" in data:
                    updates["employee_range"] = _employee_range(data["employees"])

                if updates:
                    supabase.table("companies").update(updates).eq("id", co["id"]).execute()
                    enriched += 1
                    print(f"    {co['name']}: {updates.get('funding_stage', '')} ${updates.get('funding_amount_cents', 0)//100:,}")

            if (i + 1) % 10 == 0:
                print(f"  {i+1}/{len(companies)} processed ({enriched} enriched, {not_found} not found)")

            # Be polite — 3-5 second delay
            time.sleep(3)

        browser.close()

    print(f"\n  [growjo] Done: {enriched} enriched, {skipped} skipped, {not_found} not found")
    return enriched


if __name__ == "__main__":
    from config import SUPABASE_URL, SUPABASE_SERVICE_KEY
    from supabase import create_client
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    enrich_companies_from_growjo(supabase, batch_size=193)
