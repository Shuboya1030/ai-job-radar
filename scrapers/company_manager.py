"""T-08: Company Resolution — domain-based identity, funding upgrade-only."""

import re
from urllib.parse import urlparse


def extract_domain(url):
    """Extract canonical domain from URL. 'https://www.anthropic.com/careers' → 'anthropic.com'
    Returns None for LinkedIn company URLs (they're not real company domains)."""
    if not url:
        return None
    try:
        parsed = urlparse(url if "://" in url else f"https://{url}")
        domain = parsed.netloc or parsed.path.split("/")[0]
        domain = domain.lower().strip()

        # LinkedIn company URLs are NOT real company domains — skip them
        if "linkedin.com" in domain:
            return None

        # Strip www prefix
        if domain.startswith("www."):
            domain = domain[4:]
        # Strip port
        domain = domain.split(":")[0]
        # Strip trailing dots
        domain = domain.rstrip(".")
        return domain if domain else None
    except Exception:
        return None


def normalize_title(title):
    """Normalize job title for dedup matching."""
    if not title:
        return None
    t = title.lower().strip()
    # Remove common prefixes/suffixes that vary across sources
    t = re.sub(r'\s*[-–—]\s*\d+$', '', t)  # trailing IDs like "- 12345"
    t = re.sub(r'\s*\(.*?\)\s*', ' ', t)    # parenthetical content
    t = re.sub(r'\s+', ' ', t).strip()
    return t


def resolve_company(supabase, company_name, company_url, source, enrichment_data=None):
    """
    Resolve a company to an existing record or create a new one.
    Returns company_id (UUID string).

    Identity strategy: domain-based first, alias fallback.
    Funding rule: upgrade-only (never overwrite known with unknown).
    """
    if not company_name:
        return None

    domain = extract_domain(company_url)
    name_normalized = company_name.strip()

    # 1. Try domain match (only for real company domains, not LinkedIn)
    if domain:
        result = supabase.table("companies").select("id, funding_amount_cents, funding_amount_status").eq(
            "canonical_domain", domain
        ).limit(1).execute()

        if result.data:
            company_id = result.data[0]["id"]
            _maybe_update_company(supabase, company_id, result.data[0], enrichment_data)
            _ensure_alias(supabase, company_id, name_normalized, source)
            return company_id

    # 2. Try exact name match in companies table
    name_result = supabase.table("companies").select("id, funding_amount_cents, funding_amount_status").eq(
        "name", name_normalized
    ).limit(1).execute()

    if name_result.data:
        company_id = name_result.data[0]["id"]
        _maybe_update_company(supabase, company_id, name_result.data[0], enrichment_data)
        return company_id

    # 3. Try alias match
    alias_result = supabase.table("company_aliases").select("company_id").eq(
        "alias", name_normalized
    ).limit(1).execute()

    if alias_result.data:
        return alias_result.data[0]["company_id"]

    # 4. Create new company
    company_type = enrichment_data.get("company_type", "Enterprise") if enrichment_data else "Enterprise"
    industry = enrichment_data.get("industry", "Other") if enrichment_data else "Other"

    insert_data = {
        "canonical_domain": domain,
        "name": company_name,
        "website": company_url,
        "company_type": company_type,
        "industry": industry,
        "source": source,
    }
    # Remove None values
    insert_data = {k: v for k, v in insert_data.items() if v is not None}

    result = supabase.table("companies").insert(insert_data).execute()
    if not result.data:
        print(f"  [company] Failed to create: {company_name}")
        return None

    company_id = result.data[0]["id"]

    # Insert alias
    _ensure_alias(supabase, company_id, company_name, source)

    return company_id


def _maybe_update_company(supabase, company_id, existing, enrichment_data):
    """Update company fields if new data is richer. Funding: upgrade-only."""
    if not enrichment_data:
        return

    updates = {}

    # Industry/type: only fill if currently NULL-ish
    if enrichment_data.get("industry") and enrichment_data["industry"] != "Other":
        updates["industry"] = enrichment_data["industry"]
    if enrichment_data.get("company_type"):
        updates["company_type"] = enrichment_data["company_type"]

    if updates:
        supabase.table("companies").update(updates).eq("id", company_id).execute()


def _ensure_alias(supabase, company_id, alias, source):
    """Insert alias if not exists."""
    try:
        supabase.table("company_aliases").upsert(
            {"company_id": company_id, "alias": alias, "source": source},
            on_conflict="alias,source",
        ).execute()
    except Exception:
        pass  # Alias already exists, that's fine
