"""Test Growjo access with Playwright (real browser)."""
import re
from playwright.sync_api import sync_playwright

COMPANIES_TO_TEST = ["Apple", "Google", "Anthropic", "OpenAI", "Stripe"]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
    page = context.new_page()

    # Visit homepage first to get cookies
    print("Visiting Growjo homepage...")
    page.goto("https://growjo.com/", timeout=15000)
    page.wait_for_timeout(3000)
    print(f"  Homepage title: {page.title()}")

    for name in COMPANIES_TO_TEST:
        url = f"https://growjo.com/company/{name}"
        print(f"\nFetching: {name}")
        try:
            page.goto(url, timeout=15000)
            page.wait_for_timeout(2000)

            text = page.inner_text("body")

            # Check for funding
            m = re.search(r"\$([\d,.]+)([BMK]?)\s*Total\s*Funding", text)
            if m:
                print(f"  FOUND: ${m.group(1)}{m.group(2)} Total Funding")
            else:
                print(f"  NOT FOUND. Title: {page.title()}")
                # Check if it's a 403 / block page
                if "403" in text[:200] or "blocked" in text[:200].lower() or "captcha" in text[:500].lower():
                    print(f"  BLOCKED: {text[:200]}")
                else:
                    # Print some text to debug
                    print(f"  First 300 chars: {text[:300]}")

            # Look for employee count
            m2 = re.search(r"has\s*([\d,]+)\s*Employees?", text, re.IGNORECASE)
            if m2:
                print(f"  Employees: {m2.group(1)}")

        except Exception as e:
            print(f"  ERROR: {e}")

        page.wait_for_timeout(1500)

    browser.close()
    print("\nDone.")
