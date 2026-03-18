"""Create annotated screenshots with callout circles and labels."""
import os
from playwright.sync_api import sync_playwright

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

ANNOTATED_PAGES = [
    {
        "name": "annotated_01_homepage",
        "screenshot": "01_homepage.png",
        "width": 1440,
        "annotations": [
            {"x": 300, "y": 230, "w": 400, "h": 60, "label": "Real-time data, updated daily", "color": "#BFFF00"},
            {"x": 120, "y": 300, "w": 500, "h": 80, "label": "Skill demand decoded from 350+ JDs", "color": "#BFFF00"},
            {"x": 120, "y": 530, "w": 1200, "h": 160, "label": "3 AI roles with top skills at a glance", "color": "#FF6B6B"},
        ],
    },
    {
        "name": "annotated_02_jobboard",
        "screenshot": "02_jobboard.png",
        "width": 1440,
        "annotations": [
            {"x": 50, "y": 110, "w": 1340, "h": 50, "label": "Filter by Role, Work Type, Industry, Funding Stage", "color": "#BFFF00"},
            {"x": 50, "y": 215, "w": 430, "h": 45, "label": "Company funding info on EVERY card", "color": "#FF6B6B"},
            {"x": 370, "y": 190, "w": 60, "h": 25, "label": "HOT badge = just raised funding", "color": "#FF6B6B"},
            {"x": 50, "y": 270, "w": 430, "h": 30, "label": "Salary range extracted from JD", "color": "#BFFF00"},
            {"x": 490, "y": 215, "w": 430, "h": 45, "label": "Industry tag for quick scanning", "color": "#4ECDC4"},
        ],
    },
    {
        "name": "annotated_03_market",
        "screenshot": "04_market_skills.png",
        "width": 1440,
        "annotations": [
            {"x": 790, "y": 80, "w": 180, "h": 35, "label": "Switch between roles instantly", "color": "#BFFF00"},
            {"x": 50, "y": 120, "w": 200, "h": 35, "label": "Skills / Salary / Resume tabs", "color": "#4ECDC4"},
            {"x": 50, "y": 170, "w": 700, "h": 500, "label": "Hard skills ranked by % of JDs — know what to put on your resume", "color": "#FF6B6B"},
        ],
    },
    {
        "name": "annotated_04_jobdetail",
        "screenshot": "05_job_detail.png",
        "width": 1440,
        "annotations": [
            {"x": 50, "y": 200, "w": 800, "h": 55, "label": "One-click Apply — goes to original source", "color": "#BFFF00"},
            {"x": 960, "y": 100, "w": 420, "h": 300, "label": "Company card: funding, size, industry, HQ", "color": "#FF6B6B"},
            {"x": 50, "y": 130, "w": 500, "h": 50, "label": "Salary + seniority + work type at a glance", "color": "#4ECDC4"},
        ],
    },
]


def create_annotation_html(config):
    """Generate HTML page with screenshot + annotation overlays."""
    img_path = config["screenshot"]
    annotations = config["annotations"]
    width = config["width"]

    annotation_divs = ""
    for i, a in enumerate(annotations):
        annotation_divs += f'''
        <div style="
            position: absolute;
            left: {a["x"]}px; top: {a["y"]}px;
            width: {a["w"]}px; height: {a["h"]}px;
            border: 3px solid {a["color"]};
            border-radius: 8px;
            z-index: 10;
        "></div>
        <div style="
            position: absolute;
            left: {a["x"] + a["w"] + 15}px; top: {a["y"]}px;
            background: {a["color"]};
            color: #000;
            padding: 6px 12px;
            border-radius: 6px;
            font-family: 'DM Sans', system-ui, sans-serif;
            font-size: 13px;
            font-weight: 700;
            white-space: nowrap;
            z-index: 20;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        ">{a["label"]}</div>
        <div style="
            position: absolute;
            left: {a["x"] + a["w"]}px; top: {a["y"] + a["h"]//2 - 1}px;
            width: 15px; height: 3px;
            background: {a["color"]};
            z-index: 15;
        "></div>
        '''

    return f'''<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body {{ margin: 0; padding: 0; background: #f5f5f5; }}
  .container {{
    position: relative;
    width: {width}px;
    margin: 0 auto;
  }}
  .container img {{
    width: 100%;
    display: block;
  }}
</style>
</head>
<body>
<div class="container">
  <img src="{img_path}" />
  {annotation_divs}
</div>
</body>
</html>'''


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    for config in ANNOTATED_PAGES:
        name = config["name"]
        print(f"  Creating {name}...")

        html = create_annotation_html(config)
        html_path = os.path.join(OUTPUT_DIR, f"{name}.html")
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html)

        page = browser.new_page(viewport={"width": 1800, "height": 1200})
        page.goto(f"file:///{html_path.replace(os.sep, '/')}", timeout=10000)
        page.wait_for_timeout(1000)

        png_path = os.path.join(OUTPUT_DIR, f"{name}.png")
        page.screenshot(path=png_path, full_page=True)
        print(f"    Saved: {png_path}")
        page.close()

        # Clean up HTML
        os.remove(html_path)

    browser.close()
    print("\nDone! Annotated screenshots saved.")
