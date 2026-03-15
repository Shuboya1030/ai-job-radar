"""B-18/B-19: Company Discovery Pipeline — find new AI startups from funding news."""

import sys
import os
import re
import json
import time
import requests
from datetime import datetime, timezone
from bs4 import BeautifulSoup

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import OPENAI_API_KEY, INDUSTRY_ENUM
from company_manager import resolve_company, extract_domain

FEEDS = [
    "https://techcrunch.com/category/venture/feed/",
    "https://techcrunch.com/tag/fundraising/feed/",
    "https://techcrunch.com/category/artificial-intelligence/feed/",
]

FUNDING_KEYWORDS = ["raises", "raised", "funding", "series", "million", "billion", "seed", "valuation"]

GPT_PROMPT = """You are analyzing a tech funding news article. Extract structured data as JSON:
{
  "company_name": "exact company name" or null,
  "is_ai_related": true or false,
  "funding_amount_usd": number in dollars (e.g., 30000000 for $30M) or null,
  "funding_stage": "Pre-seed" or "Seed" or "Series A" or "Series B" or "Series C" or "Series D+" or null,
  "industry": one of [INDUSTRY_LIST] or "Other",
  "description": "one-sentence company description" or null,
  "headquarter": "city, state/country" or null
}

Rules:
- is_ai_related: true if company works on AI/ML, uses AI as core product, or is an AI infrastructure company
- Only extract the PRIMARY company being funded (not investors)
- Return ONLY valid JSON
""".replace("INDUSTRY_LIST", ", ".join(f'"{i}"' for i in INDUSTRY_ENUM))


def fetch_funding_articles():
    """Fetch recent funding articles from TechCrunch RSS feeds."""
    articles = []
    seen_links = set()

    for feed_url in FEEDS:
        try:
            resp = requests.get(feed_url, headers={"User-Agent": "Mozilla/5.0 AIJobRadar"}, timeout=15)
            if resp.status_code != 200:
                continue

            soup = BeautifulSoup(resp.text, "xml")
            for item in soup.find_all("item"):
                title = item.find("title").text if item.find("title") else ""
                link = item.find("link").text if item.find("link") else ""
                desc = item.find("description").text if item.find("description") else ""
                pub_date = item.find("pubDate").text if item.find("pubDate") else ""

                if link in seen_links:
                    continue
                seen_links.add(link)

                # Filter for funding-related articles
                combined = (title + " " + desc).lower()
                if any(kw in combined for kw in FUNDING_KEYWORDS):
                    articles.append({
                        "title": title,
                        "link": link,
                        "description": BeautifulSoup(desc, "html.parser").get_text(strip=True)[:500],
                        "pub_date": pub_date,
                    })
        except Exception as e:
            print(f"  [discovery] Error fetching {feed_url}: {e}")

    print(f"  [discovery] Found {len(articles)} funding articles from {len(FEEDS)} feeds")
    return articles


def analyze_article(article):
    """Use GPT to extract company info from article."""
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }

    text = f"Title: {article['title']}\n\nSummary: {article['description']}"

    try:
        resp = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers=headers,
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": GPT_PROMPT},
                    {"role": "user", "content": text},
                ],
                "temperature": 0.1,
                "max_tokens": 300,
            },
            timeout=20,
        )

        if resp.status_code != 200:
            return None

        content = resp.json()["choices"][0]["message"]["content"].strip()
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\s*", "", content)
            content = re.sub(r"\s*```$", "", content)

        return json.loads(content)
    except Exception as e:
        print(f"    [discovery] GPT error: {e}")
        return None


def run_company_discovery(supabase):
    """Discover new AI companies from funding news and add to database."""
    print("\n" + "=" * 60)
    print("  AIJobRadar Company Discovery Pipeline")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # Step 1: Fetch articles
    articles = fetch_funding_articles()
    if not articles:
        print("  No funding articles found.")
        return

    # Step 2: Analyze each with GPT
    new_companies = 0
    updated_companies = 0
    skipped = 0

    for i, article in enumerate(articles):
        data = analyze_article(article)
        if not data:
            continue

        name = data.get("company_name")
        is_ai = data.get("is_ai_related", False)

        if not name:
            continue

        if not is_ai:
            skipped += 1
            continue

        amt = data.get('funding_amount_usd') or 0
        print(f"  AI Company: {name} — {data.get('funding_stage', '?')} ${amt:,.0f}")

        # Step 3: Upsert company
        enrichment = {
            "industry": data.get("industry", "AI/ML"),
            "company_type": "Startup",
        }

        company_id = resolve_company(supabase, name, None, "Manual", enrichment)

        if company_id and data.get("funding_amount_usd"):
            # Update funding (upgrade-only)
            existing = supabase.table("companies").select(
                "funding_amount_cents, funding_amount_status"
            ).eq("id", company_id).single().execute()

            if existing.data:
                new_cents = int(data["funding_amount_usd"] * 100)
                old_cents = existing.data.get("funding_amount_cents") or 0

                updates = {}
                if new_cents > old_cents:
                    updates["funding_amount_cents"] = new_cents
                    updates["funding_amount_status"] = "known"
                if data.get("funding_stage"):
                    updates["funding_stage"] = data["funding_stage"]
                if data.get("description"):
                    updates["description"] = data["description"][:200]
                if data.get("headquarter"):
                    updates["headquarter"] = data["headquarter"]

                if updates:
                    supabase.table("companies").update(updates).eq("id", company_id).execute()
                    updated_companies += 1
                else:
                    new_companies += 1

        time.sleep(0.5)

        if (i + 1) % 10 == 0:
            print(f"    {i+1}/{len(articles)} processed")

    print(f"\n  [discovery] Done: {new_companies} new, {updated_companies} updated, {skipped} non-AI skipped")
    print("=" * 60)


if __name__ == "__main__":
    from db import get_supabase
    supabase = get_supabase()
    run_company_discovery(supabase)
