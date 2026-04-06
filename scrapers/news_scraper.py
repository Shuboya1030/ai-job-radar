"""News Scraper — fetches AI startup news from RSS feeds, enriches with GPT, writes to Supabase."""

import sys
import os
import re
import json
import time
import requests
import feedparser
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import OPENAI_API_KEY, INDUSTRY_ENUM

NEWS_FEEDS = [
    "https://techcrunch.com/category/artificial-intelligence/feed/",
    "https://news.crunchbase.com/feed/",
]

EVENT_TYPES = ["funding", "launch", "acquisition", "milestone", "other"]

GPT_PROMPT = """You are analyzing a tech/AI news article. Return a JSON object:
{
  "summary": "2-3 sentence summary of the article",
  "industry_tags": ["tag1", "tag2"],
  "event_type": "funding" or "launch" or "acquisition" or "milestone" or "other",
  "company_name": "primary company mentioned" or null
}

Rules:
- industry_tags: pick from [INDUSTRY_LIST]. Can include multiple.
- event_type: classify as funding (raises/investment), launch (new product/service), acquisition (M&A), milestone (growth/award/partnership), or other.
- company_name: the primary AI/tech company the article is about (not investors or acquirers).
- summary: concise, factual, 2-3 sentences.
- Return ONLY valid JSON.
""".replace("INDUSTRY_LIST", ", ".join(f'"{i}"' for i in INDUSTRY_ENUM))

HEADERS = {
    "User-Agent": "Mozilla/5.0 AIJobRadar NewsBot/1.0",
}


def fetch_rss_entries():
    """Fetch entries from all configured RSS feeds."""
    entries = []
    seen_links = set()

    for feed_url in NEWS_FEEDS:
        try:
            feed = feedparser.parse(feed_url, agent=HEADERS["User-Agent"])
            if feed.bozo and not feed.entries:
                print(f"  [news] Error parsing {feed_url}: {feed.bozo_exception}")
                continue

            for entry in feed.entries:
                link = entry.get("link", "")
                if link in seen_links or not link:
                    continue
                seen_links.add(link)

                # Parse published date
                published = None
                if hasattr(entry, "published_parsed") and entry.published_parsed:
                    published = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc).isoformat()
                elif hasattr(entry, "updated_parsed") and entry.updated_parsed:
                    published = datetime(*entry.updated_parsed[:6], tzinfo=timezone.utc).isoformat()

                # Get description text (strip HTML)
                desc = entry.get("summary", "") or entry.get("description", "")
                if "<" in desc:
                    from bs4 import BeautifulSoup
                    desc = BeautifulSoup(desc, "html.parser").get_text(strip=True)

                entries.append({
                    "title": entry.get("title", ""),
                    "link": link,
                    "description": desc[:500],
                    "published_at": published,
                    "source_name": feed_url.split("/")[2],  # e.g. techcrunch.com
                })

            print(f"  [news] {feed_url}: {len(feed.entries)} entries")
        except Exception as e:
            print(f"  [news] Error fetching {feed_url}: {e}")

    print(f"  [news] Total unique entries: {len(entries)}")
    return entries


def enrich_batch(entries_batch):
    """Call GPT-4o-mini to enrich a batch of entries (one call per entry, batched for rate limiting)."""
    results = []
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }

    for entry in entries_batch:
        text = f"Title: {entry['title']}\n\nSummary: {entry['description']}"

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
                    "max_tokens": 400,
                },
                timeout=20,
            )

            if resp.status_code != 200:
                print(f"    [news] GPT error {resp.status_code}: {resp.text[:100]}")
                results.append(None)
                continue

            content = resp.json()["choices"][0]["message"]["content"].strip()
            if content.startswith("```"):
                content = re.sub(r"^```(?:json)?\s*", "", content)
                content = re.sub(r"\s*```$", "", content)

            results.append(json.loads(content))
        except Exception as e:
            print(f"    [news] GPT error: {e}")
            results.append(None)

    return results


def match_company(supabase, company_name):
    """Try to match a company name against existing companies in the database."""
    if not company_name:
        return None

    try:
        result = supabase.table("companies").select("id").ilike(
            "name", company_name
        ).limit(1).execute()

        if result.data:
            return result.data[0]["id"]
    except Exception:
        pass

    return None


def scrape_news(supabase):
    """Main entry point: fetch RSS, enrich with GPT, write to Supabase."""
    print("\n" + "=" * 60)
    print("  AIJobRadar News Scraper")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # Step 1: Fetch RSS entries
    entries = fetch_rss_entries()
    if not entries:
        print("  No news entries found.")
        return

    # Step 2: Enrich in batches of 5
    batch_size = 5
    written = 0
    skipped = 0
    errors = 0

    for i in range(0, len(entries), batch_size):
        batch = entries[i:i + batch_size]
        enrichments = enrich_batch(batch)

        for entry, enrichment in zip(batch, enrichments):
            if not enrichment:
                errors += 1
                continue

            # Match company against DB
            company_name = enrichment.get("company_name")
            company_id = match_company(supabase, company_name)

            record = {
                "title": entry["title"],
                "source_url": entry["link"],
                "source_name": entry.get("source_name", "unknown"),
                "published_at": entry.get("published_at"),
                "summary": enrichment.get("summary", ""),
                "industry_tags": enrichment.get("industry_tags", []),
                "event_type": enrichment.get("event_type", "other"),
                "company_name": company_name,
                "company_id": company_id,
            }

            # Remove None values
            record = {k: v for k, v in record.items() if v is not None}

            try:
                supabase.table("news_items").upsert(
                    record, on_conflict="source_url"
                ).execute()
                written += 1
            except Exception as e:
                errors += 1
                if errors <= 3:
                    print(f"    [news] Error writing {entry['title'][:50]}: {e}")

        # Rate limit between batches
        if i + batch_size < len(entries):
            time.sleep(1)

        processed = min(i + batch_size, len(entries))
        if processed % 10 == 0 or processed == len(entries):
            print(f"  [news] Processed {processed}/{len(entries)}")

    print(f"\n  [news] Done: {written} written, {skipped} skipped, {errors} errors")
    print("=" * 60)


if __name__ == "__main__":
    from db import get_supabase
    supabase = get_supabase()
    scrape_news(supabase)
