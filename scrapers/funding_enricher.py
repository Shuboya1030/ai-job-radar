"""Funding Enricher — supplement Growjo with additional funding sources.

Uses OpenAI to search for and extract funding data for companies
that still have Unknown or NULL funding_stage.
"""

import sys
import os
import json
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from openai import OpenAI
from config import OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
from supabase import create_client


def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def _guess_stage(cents):
    """Guess funding stage from total amount."""
    if not cents or cents <= 0:
        return "Unknown"
    dollars = cents / 100
    if dollars < 500_000:
        return "Pre-seed"
    elif dollars < 5_000_000:
        return "Seed"
    elif dollars < 20_000_000:
        return "Series A"
    elif dollars < 60_000_000:
        return "Series B"
    elif dollars < 200_000_000:
        return "Series C"
    else:
        return "Series D+"


def enrich_funding_with_ai(max_companies=50):
    """Use OpenAI to find funding data for companies missing it."""
    sb = get_supabase()
    client = OpenAI(api_key=OPENAI_API_KEY)

    # Get companies with Unknown or NULL funding
    result = sb.table("companies").select(
        "id, name, website, funding_stage"
    ).eq("is_active", True).or_(
        "funding_stage.is.null,funding_stage.eq.Unknown"
    ).limit(max_companies).execute()

    companies = result.data or []
    print(f"[funding-ai] Found {len(companies)} companies needing funding data")

    if not companies:
        return 0

    # Batch companies for efficiency (10 at a time)
    updated = 0
    batch_size = 10

    for i in range(0, len(companies), batch_size):
        batch = companies[i:i + batch_size]
        company_list = "\n".join(
            f"- {c['name']} ({c.get('website', 'no website')})"
            for c in batch
        )

        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                max_tokens=2000,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": "You are a startup funding research assistant. For each company, provide known funding information. Return JSON."},
                    {"role": "user", "content": f"""For each company below, provide their latest known funding information.
If you know the company, provide the data. If you don't recognize it or aren't sure, set funding_stage to "Unknown".

Companies:
{company_list}

Return JSON: {{"companies": [
  {{"name": "CompanyName", "funding_stage": "Series A", "funding_amount_usd": 15000000, "is_public": false}},
  ...
]}}

Rules:
- funding_stage: one of "Pre-seed", "Seed", "Series A", "Series B", "Series C", "Series D+", "Public", "Bootstrapped", "Unknown"
- If a company trades on a stock exchange, set funding_stage = "Public"
- funding_amount_usd: total funding in USD (null if unknown)
- Only provide data you are confident about. When in doubt, use "Unknown"
- is_public: true if publicly traded"""}
                ],
            )

            text = response.choices[0].message.content or '{"companies":[]}'
            data = json.loads(text)
            results = data.get("companies", [])

            for r in results:
                name = r.get("name")
                stage = r.get("funding_stage", "Unknown")
                amount = r.get("funding_amount_usd")
                is_public = r.get("is_public", False)

                if stage == "Unknown" and not is_public:
                    continue  # No new info

                if is_public:
                    stage = "Public"

                # Find matching company
                match = next((c for c in batch if c["name"].lower() == name.lower()), None)
                if not match:
                    continue

                update = {"funding_stage": stage}
                if amount and amount > 0:
                    update["funding_amount_cents"] = int(amount * 100)
                    update["funding_amount_status"] = "known"
                    if stage == "Unknown":
                        update["funding_stage"] = _guess_stage(int(amount * 100))

                sb.table("companies").update(update).eq("id", match["id"]).execute()
                updated += 1
                print(f"  Updated: {name} → {update.get('funding_stage')} {('$' + str(amount)) if amount else ''}")

        except Exception as e:
            print(f"  Error processing batch: {e}")

        time.sleep(1)  # Rate limit

    print(f"[funding-ai] Updated {updated}/{len(companies)} companies")
    return updated


if __name__ == "__main__":
    updated = enrich_funding_with_ai(max_companies=100)
    print(f"\nDone. Updated {updated} companies.")
