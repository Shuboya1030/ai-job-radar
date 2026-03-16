"""Agent Tools — 6 tools the Claude Agent can call."""

import os
import sys
import json
import subprocess
import requests
from datetime import datetime, timezone, timedelta
from supabase import create_client
from bs4 import BeautifulSoup

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SCRAPERS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scrapers")

_supabase = None

def _get_supabase():
    global _supabase
    if _supabase is None:
        _supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _supabase


# ─── Tool 1: supabase_query ─────────────────────────────────────────────────

def supabase_query(operation: str, table: str, filters: dict = None,
                   data: dict = None, select: str = "*", limit: int = 100) -> dict:
    """Read/write Supabase database.

    Args:
        operation: 'select', 'insert', 'update', 'upsert'
        table: table name
        filters: dict of {column: value} for WHERE clauses
        data: dict of data for insert/update
        select: columns to select
        limit: max rows to return
    """
    sb = _get_supabase()

    try:
        if operation == "select":
            q = sb.table(table).select(select, count="exact")
            if filters:
                for col, val in filters.items():
                    if val is None:
                        q = q.is_(col, "null")
                    else:
                        q = q.eq(col, val)
            q = q.limit(limit)
            result = q.execute()
            return {"data": result.data, "count": result.count, "error": None}

        elif operation == "insert":
            result = sb.table(table).insert(data).execute()
            return {"data": result.data, "error": None}

        elif operation == "update":
            q = sb.table(table).update(data)
            if filters:
                for col, val in filters.items():
                    q = q.eq(col, val)
            result = q.execute()
            return {"data": result.data, "error": None}

        elif operation == "upsert":
            result = sb.table(table).upsert(data).execute()
            return {"data": result.data, "error": None}

        else:
            return {"data": None, "error": f"Unknown operation: {operation}"}

    except Exception as e:
        return {"data": None, "error": str(e)}


def get_pipeline_stats() -> dict:
    """Get current pipeline statistics for agent decision-making."""
    sb = _get_supabase()

    total = sb.table("companies").select("id", count="exact").eq("is_active", True).execute()
    funded = sb.table("companies").select("id", count="exact").eq(
        "is_active", True).eq("funding_amount_status", "known").execute()
    jobs = sb.table("jobs").select("id", count="exact").eq(
        "is_active", True).is_("canonical_job_id", "null").execute()

    total_count = total.count or 0
    funded_count = funded.count or 0
    coverage = round(funded_count / total_count * 100, 1) if total_count > 0 else 0

    # Companies without funding
    unfunded = sb.table("companies").select("id, name").eq(
        "is_active", True).neq("funding_amount_status", "known").limit(20).execute()

    return {
        "total_companies": total_count,
        "funded_companies": funded_count,
        "funding_coverage_pct": coverage,
        "active_jobs": jobs.count or 0,
        "unfunded_companies": [c["name"] for c in (unfunded.data or [])],
    }


# ─── Tool 2: trigger_github_action ──────────────────────────────────────────

def trigger_github_action(workflow_name: str) -> dict:
    """Trigger a GitHub Actions workflow.

    Args:
        workflow_name: one of 'daily-scrape', 'weekly-analysis', 'weekly-health-check', 'weekly-funding-enrichment'
    """
    allowed = ["daily-scrape", "weekly-analysis", "weekly-health-check", "weekly-funding-enrichment"]
    if workflow_name not in allowed:
        return {"success": False, "error": f"Unknown workflow. Allowed: {allowed}"}

    try:
        result = subprocess.run(
            ["gh", "workflow", "run", f"{workflow_name}.yml"],
            capture_output=True, text=True, timeout=30,
            cwd=os.path.dirname(SCRAPERS_DIR),
        )
        if result.returncode == 0:
            return {"success": True, "message": f"Triggered {workflow_name}"}
        else:
            return {"success": False, "error": result.stderr}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ─── Tool 3: web_search ─────────────────────────────────────────────────────

def web_search(query: str, num_results: int = 10) -> dict:
    """Search the internet using DuckDuckGo.

    Args:
        query: search query string
        num_results: max results to return
    """
    try:
        # Use DuckDuckGo HTML search (no API key needed)
        url = "https://html.duckduckgo.com/html/"
        resp = requests.post(url, data={"q": query}, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }, timeout=15)

        if resp.status_code != 200:
            return {"results": [], "error": f"HTTP {resp.status_code}"}

        soup = BeautifulSoup(resp.text, "html.parser")
        results = []
        for r in soup.select(".result")[:num_results]:
            title_el = r.select_one(".result__a")
            snippet_el = r.select_one(".result__snippet")
            url_el = r.select_one(".result__url")

            if title_el:
                results.append({
                    "title": title_el.get_text(strip=True),
                    "url": title_el.get("href", ""),
                    "snippet": snippet_el.get_text(strip=True) if snippet_el else "",
                })

        return {"results": results, "error": None}

    except Exception as e:
        return {"results": [], "error": str(e)}


# ─── Tool 4: web_fetch ──────────────────────────────────────────────────────

def web_fetch(url: str, extract_text: bool = True) -> dict:
    """Fetch and read a webpage.

    Args:
        url: URL to fetch
        extract_text: if True, return cleaned text; if False, return raw HTML
    """
    try:
        resp = requests.get(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }, timeout=15, allow_redirects=True)

        if resp.status_code != 200:
            return {"content": None, "status": resp.status_code, "error": f"HTTP {resp.status_code}"}

        if extract_text:
            soup = BeautifulSoup(resp.text, "html.parser")
            # Remove script/style tags
            for tag in soup(["script", "style", "nav", "footer", "header"]):
                tag.decompose()
            text = soup.get_text(separator="\n", strip=True)
            # Limit to 8000 chars (enough for Claude to process)
            return {"content": text[:8000], "url": str(resp.url), "status": 200, "error": None}
        else:
            return {"content": resp.text[:15000], "url": str(resp.url), "status": 200, "error": None}

    except Exception as e:
        return {"content": None, "status": 0, "error": str(e)}


# ─── Tool 5: run_python ─────────────────────────────────────────────────────

def run_python(script: str, args: list = None) -> dict:
    """Run an existing Python script from the scrapers directory.

    Args:
        script: script filename (e.g. 'enrichment.py', 'dedup.py', 'weekly_analysis.py')
        args: optional list of command-line arguments
    """
    allowed = [
        "main.py", "enrichment.py", "dedup.py", "weekly_analysis.py",
        "health_check.py", "company_discovery.py", "growjo_enricher.py",
    ]
    if script not in allowed:
        return {"success": False, "error": f"Script not allowed. Allowed: {allowed}"}

    script_path = os.path.join(SCRAPERS_DIR, script)
    if not os.path.exists(script_path):
        return {"success": False, "error": f"Script not found: {script_path}"}

    cmd = [sys.executable, "-u", script_path] + (args or [])
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=1800,  # 30 min max
            env={**os.environ},
            cwd=SCRAPERS_DIR,
        )
        return {
            "success": result.returncode == 0,
            "stdout": result.stdout[-3000:],  # Last 3000 chars
            "stderr": result.stderr[-1000:] if result.stderr else None,
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Script timed out after 30 minutes"}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ─── Tool 6: check_health ───────────────────────────────────────────────────

def check_health(url: str) -> dict:
    """Check if a website is reachable.

    Args:
        url: URL to check
    """
    if not url:
        return {"alive": None, "error": "No URL provided"}

    full_url = url if url.startswith("http") else f"https://{url}"
    try:
        resp = requests.get(full_url, headers={
            "User-Agent": "Mozilla/5.0 AIJobRadar HealthCheck"
        }, timeout=10, allow_redirects=True)
        return {
            "alive": resp.status_code < 400,
            "status_code": resp.status_code,
            "final_url": str(resp.url),
            "response_time_ms": int(resp.elapsed.total_seconds() * 1000),
            "error": None,
        }
    except requests.exceptions.ConnectionError:
        return {"alive": False, "status_code": 0, "error": "Connection failed"}
    except requests.exceptions.Timeout:
        return {"alive": False, "status_code": 0, "error": "Timeout"}
    except Exception as e:
        return {"alive": False, "status_code": 0, "error": str(e)}


# ─── Tool Definitions for Claude API ────────────────────────────────────────

TOOL_DEFINITIONS = [
    {
        "name": "supabase_query",
        "description": "Read or write to the Supabase database. Use for checking stats, inserting companies/jobs, updating funding data. Always include source_url when writing funding data.",
        "input_schema": {
            "type": "object",
            "properties": {
                "operation": {"type": "string", "enum": ["select", "insert", "update", "upsert"]},
                "table": {"type": "string", "description": "Table name: companies, jobs, agent_runs, etc."},
                "filters": {"type": "object", "description": "WHERE clause: {column: value}"},
                "data": {"type": "object", "description": "Data for insert/update"},
                "select": {"type": "string", "description": "Columns to select", "default": "*"},
                "limit": {"type": "integer", "description": "Max rows", "default": 100},
            },
            "required": ["operation", "table"],
        },
    },
    {
        "name": "get_pipeline_stats",
        "description": "Get current pipeline statistics: total companies, funding coverage %, active jobs, list of unfunded companies. Use this FIRST in every run to understand current state.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "trigger_github_action",
        "description": "Trigger a GitHub Actions workflow for bulk operations. Use 'daily-scrape' for LinkedIn/YC/Career bulk scraping. Use 'weekly-analysis' for market snapshots.",
        "input_schema": {
            "type": "object",
            "properties": {
                "workflow_name": {
                    "type": "string",
                    "enum": ["daily-scrape", "weekly-analysis", "weekly-health-check", "weekly-funding-enrichment"],
                },
            },
            "required": ["workflow_name"],
        },
    },
    {
        "name": "web_search",
        "description": "Search the internet. Use for: finding new AI startups ('AI startup funding 2026'), finding company career pages ('{company} careers'), checking company status ('{company} acquired shutdown'), finding funding data ('{company} series funding round').",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"},
                "num_results": {"type": "integer", "description": "Max results", "default": 10},
            },
            "required": ["query"],
        },
    },
    {
        "name": "web_fetch",
        "description": "Fetch and read any webpage. Use for: reading company career pages to find job listings, reading Growjo for funding data, reading news articles. Returns text content (max 8000 chars).",
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "URL to fetch"},
                "extract_text": {"type": "boolean", "description": "If true, return cleaned text; if false, raw HTML", "default": True},
            },
            "required": ["url"],
        },
    },
    {
        "name": "run_python",
        "description": "Run existing Python scripts for bulk operations. Available: main.py (full scrape pipeline), dedup.py (deduplication), weekly_analysis.py (market snapshots), health_check.py, company_discovery.py (TechCrunch RSS).",
        "input_schema": {
            "type": "object",
            "properties": {
                "script": {"type": "string", "description": "Script filename"},
                "args": {"type": "array", "items": {"type": "string"}, "description": "CLI arguments"},
            },
            "required": ["script"],
        },
    },
    {
        "name": "check_health",
        "description": "Check if a company website is reachable. Returns alive status, HTTP code, response time.",
        "input_schema": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "URL to check"},
            },
            "required": ["url"],
        },
    },
]

# ─── Tool Dispatcher ────────────────────────────────────────────────────────

TOOL_MAP = {
    "supabase_query": supabase_query,
    "get_pipeline_stats": lambda **kwargs: get_pipeline_stats(),
    "trigger_github_action": trigger_github_action,
    "web_search": web_search,
    "web_fetch": web_fetch,
    "run_python": run_python,
    "check_health": check_health,
}


def dispatch_tool(name: str, input_data: dict) -> str:
    """Dispatch a tool call and return JSON result."""
    fn = TOOL_MAP.get(name)
    if not fn:
        return json.dumps({"error": f"Unknown tool: {name}"})
    try:
        result = fn(**input_data)
        return json.dumps(result, default=str, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)})
