"""Test Growjo with playwright-stealth to bypass Cloudflare."""
import re
from playwright.sync_api import sync_playwright
from playwright_stealth import Stealth

COMPANIES = ["Apple", "Anthropic", "OpenAI"]

stealth = Stealth()

with sync_playwright() as p:
    browser = p.chromium.launch(
        headless=False,
        args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
    )
    context = browser.new_context(viewport={"width": 1920, "height": 1080}, locale="en-US")
    stealth.apply_stealth_sync(context)
    page = context.new_page()

    # Visit homepage, wait for Cloudflare challenge to resolve
    print("Visiting homepage...")
    page.goto("https://growjo.com/", timeout=30000)
    page.wait_for_timeout(8000)
    title = page.title()
    print(f"  Title: {title}")

    if "Just a moment" in title:
        print("  Cloudflare challenge detected, waiting 15s...")
        page.wait_for_timeout(15000)
        title = page.title()
        print(f"  Title after wait: {title}")

    for name in COMPANIES:
        url = f"https://growjo.com/company/{name}"
        print(f"\nFetching: {name}")
        try:
            page.goto(url, timeout=20000)
            page.wait_for_timeout(5000)

            title = page.title()
            if "Just a moment" in title:
                print(f"  Cloudflare - waiting 15s...")
                page.wait_for_timeout(15000)

            text = page.inner_text("body")
            m = re.search(r"\$([\d,.]+)([BMK]?)\s*Total\s*Funding", text)
            if m:
                print(f"  SUCCESS: ${m.group(1)}{m.group(2)} Total Funding")
            else:
                print(f"  Not found. Title: {page.title()}")
                print(f"  First 200 chars: {text[:200]}")

        except Exception as e:
            print(f"  ERROR: {e}")

        page.wait_for_timeout(2000)

    browser.close()
    print("\nDone.")
