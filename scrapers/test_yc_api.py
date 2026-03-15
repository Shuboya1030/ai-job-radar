"""Test YC Work at a Startup API access."""
import requests
import re
import json

# First, fetch the page and extract Algolia credentials from JS bundle
resp = requests.get("https://www.workatastartup.com/jobs",
    headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
print(f"Page status: {resp.status_code}")

# Find script tags that might contain Algolia config
scripts = re.findall(r'src="([^"]*\.js[^"]*)"', resp.text)
print(f"JS bundles: {scripts[:5]}")

# Look for algolia config in inline scripts
inline = re.findall(r'<script[^>]*>(.*?)</script>', resp.text, re.DOTALL)
for s in inline:
    if "algolia" in s.lower() or "45BWZJ1SGC" in s:
        print(f"Found Algolia inline script: {s[:300]}")

# Try the YC companies API instead
print("\n--- Testing YC Companies API ---")
resp2 = requests.get(
    "https://www.workatastartup.com/companies/fetch",
    params={"query": "AI", "page": 1},
    headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"},
    timeout=15,
)
print(f"Companies API: {resp2.status_code}")
if resp2.status_code == 200:
    try:
        data = resp2.json()
        print(f"Type: {type(data)}, keys: {list(data.keys()) if isinstance(data, dict) else 'list'}")
        print(json.dumps(data, indent=2)[:500])
    except:
        print(resp2.text[:300])

# Try jobs API
print("\n--- Testing YC Jobs API ---")
resp3 = requests.get(
    "https://www.workatastartup.com/companies/fetch",
    params={"query": "AI Engineer", "page": 1, "hasJob": "true"},
    headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"},
    timeout=15,
)
print(f"Jobs API: {resp3.status_code}")
if resp3.status_code == 200:
    try:
        data = resp3.json()
        if isinstance(data, list):
            print(f"Got {len(data)} results")
            if data:
                print(json.dumps(data[0], indent=2)[:500])
        elif isinstance(data, dict):
            print(f"Keys: {list(data.keys())}")
            print(json.dumps(data, indent=2)[:500])
    except:
        print(resp3.text[:300])
