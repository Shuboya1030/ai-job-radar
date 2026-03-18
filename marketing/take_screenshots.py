"""Take screenshots of key pages on aistartupjob.com using Playwright."""
import os
from playwright.sync_api import sync_playwright

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_URL = "https://aistartupjob.com"

PAGES = [
    {"name": "01_homepage", "path": "/", "width": 1440, "height": 900, "full_page": True},
    {"name": "02_jobboard", "path": "/jobs", "width": 1440, "height": 900, "full_page": False},
    {"name": "03_jobboard_filter", "path": "/jobs?funding_stage=Series+A", "width": 1440, "height": 900, "full_page": False},
    {"name": "04_market_skills", "path": "/market/ai-engineer", "width": 1440, "height": 1200, "full_page": False},
    {"name": "05_job_detail", "path": "/jobs", "width": 1440, "height": 900, "full_page": False, "click_first_job": True},
    {"name": "06_compare", "path": "/compare", "width": 1440, "height": 900, "full_page": False},
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    for page_config in PAGES:
        name = page_config["name"]
        path = page_config["path"]
        print(f"  Capturing {name}...")

        page = browser.new_page(viewport={
            "width": page_config["width"],
            "height": page_config["height"],
        })

        page.goto(f"{BASE_URL}{path}", timeout=30000)
        page.wait_for_timeout(3000)  # Wait for data to load

        # Special handling: click first job card for detail screenshot
        if page_config.get("click_first_job"):
            try:
                first_job = page.query_selector("a[href^='/jobs/']")
                if first_job:
                    first_job.click()
                    page.wait_for_timeout(3000)
            except:
                pass

        filepath = os.path.join(OUTPUT_DIR, f"{name}.png")
        page.screenshot(
            path=filepath,
            full_page=page_config.get("full_page", False),
        )
        print(f"    Saved: {filepath}")
        page.close()

    browser.close()
    print("\nDone! All screenshots saved.")
