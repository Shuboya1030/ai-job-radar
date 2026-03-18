"""Email notification pipeline — sends job alerts to subscribers."""

import sys
import os
import json
import time
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import SUPABASE_URL, SUPABASE_SERVICE_KEY
from supabase import create_client

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
FROM_EMAIL = "alerts@aistartupjob.com"
SITE_URL = "https://aistartupjob.com"


def send_email_resend(to_email, subject, html_body):
    """Send email via Resend API."""
    import requests
    if not RESEND_API_KEY:
        print(f"    [email] RESEND_API_KEY not set, would send to {to_email}: {subject}")
        return "mock-id"

    resp = requests.post("https://api.resend.com/emails", headers={
        "Authorization": f"Bearer {RESEND_API_KEY}",
        "Content-Type": "application/json",
    }, json={
        "from": FROM_EMAIL,
        "to": [to_email],
        "subject": subject,
        "html": html_body,
    }, timeout=15)

    if resp.status_code in (200, 201):
        return resp.json().get("id", "sent")
    else:
        print(f"    [email] Error: {resp.status_code} {resp.text[:200]}")
        return None


def render_job_card_html(job):
    """Render a single job as an HTML card for email."""
    salary = ""
    if job.get("salary_annual_min"):
        salary = f"${job['salary_annual_min']//1000}K–${(job.get('salary_annual_max') or job['salary_annual_min'])//1000}K"

    funding = ""
    if job.get("funding_stage") and job["funding_stage"] != "Unknown":
        funding = job["funding_stage"]
    if job.get("funding_amount_cents") and job.get("funding_amount_status") == "known":
        d = job["funding_amount_cents"] / 100
        amt = f"${d/1e9:.1f}B" if d >= 1e9 else f"${d/1e6:.0f}M" if d >= 1e6 else f"${d/1e3:.0f}K"
        funding = f"{funding} · {amt}" if funding else amt

    tags = []
    if job.get("role_category"):
        tags.append(job["role_category"])
    if job.get("work_type") and job["work_type"] != "Unknown":
        tags.append(job["work_type"])
    if job.get("location"):
        tags.append(job["location"])

    return f"""
    <div style="border:1px solid #e4e4e7; border-radius:8px; padding:16px; margin-bottom:12px; font-family:'DM Sans',system-ui,sans-serif;">
      <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <span style="font-size:12px; font-weight:600; color:#18181b;">{job.get('company_name','Unknown')}</span>
        <span style="font-size:11px; font-family:monospace; color:#BFFF00; background:#18181b; padding:2px 6px; border-radius:4px;">{funding or 'Funding unknown'}</span>
      </div>
      <div style="font-size:14px; font-weight:700; color:#18181b; margin-bottom:6px;">{job.get('title','Untitled')}</div>
      {f'<div style="font-size:13px; font-family:monospace; font-weight:600; color:#18181b; margin-bottom:6px;">{salary}</div>' if salary else ''}
      <div style="font-size:11px; color:#71717a; margin-bottom:10px;">{' · '.join(tags)}</div>
      <a href="{SITE_URL}/jobs/{job.get('id','')}" style="font-size:12px; font-weight:700; color:#18181b; text-decoration:none; background:#BFFF00; padding:6px 14px; border-radius:4px;">View Job →</a>
    </div>
    """


def render_email_html(user_name, sub_name, jobs):
    """Render full email HTML."""
    job_cards = "\n".join(render_job_card_html(j) for j in jobs[:20])

    return f"""
    <!DOCTYPE html>
    <html>
    <body style="margin:0; padding:0; background:#fafaf8; font-family:'DM Sans',system-ui,sans-serif;">
      <div style="max-width:600px; margin:0 auto; padding:24px;">
        <div style="margin-bottom:24px;">
          <span style="font-family:monospace; font-weight:700; font-size:14px; color:#18181b;">● AIJobRadar</span>
        </div>

        <h1 style="font-size:18px; font-weight:700; color:#18181b; margin-bottom:4px;">
          {len(jobs)} new job{'' if len(jobs)==1 else 's'} matching "{sub_name}"
        </h1>
        <p style="font-size:12px; color:#71717a; margin-bottom:20px;">
          Hi {user_name or 'there'}, here are the latest matches for your alert.
        </p>

        {job_cards}

        <div style="margin-top:24px; padding-top:16px; border-top:1px solid #e4e4e7; font-size:11px; color:#a1a1aa;">
          <a href="{SITE_URL}/settings" style="color:#71717a;">Manage alerts</a> ·
          <a href="{SITE_URL}/settings" style="color:#71717a;">Unsubscribe</a>
          <br/><br/>
          AIJobRadar · aistartupjob.com
        </div>
      </div>
    </body>
    </html>
    """


def run_notifications():
    print("=" * 60)
    print("  AIJobRadar Email Notifications")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # Get all active subscriptions with user info
    result = supabase.table("subscriptions").select(
        "*, user_profiles(email, name)"
    ).eq("is_active", True).execute()

    subs = result.data or []
    print(f"  Active subscriptions: {len(subs)}")

    today = datetime.now(timezone.utc)
    is_monday = today.weekday() == 0

    sent_count = 0
    skipped_count = 0

    for sub in subs:
        freq = sub.get("frequency", "weekly")
        user_info = sub.get("user_profiles") or {}
        email = user_info.get("email")
        name = user_info.get("name", "")

        if not email:
            continue

        # Check frequency
        if freq == "weekly" and not is_monday:
            skipped_count += 1
            continue

        # Find matching jobs since last sent
        last_sent = sub.get("last_sent_at")
        if not last_sent:
            last_sent = (today - timedelta(days=7)).isoformat()

        # Build query
        query = supabase.from_("v_jobs_full").select("*").gt("scraped_at", last_sent).eq("is_active", True).is_("canonical_job_id", "null")

        roles = sub.get("roles") or []
        industries = sub.get("industries") or []
        funding_stages = sub.get("funding_stages") or []
        work_types = sub.get("work_types") or []

        if roles:
            query = query.in_("role_category", roles)
        if industries:
            query = query.in_("industry", industries)
        if funding_stages:
            query = query.in_("funding_stage", funding_stages)
        if work_types:
            query = query.in_("work_type", work_types)

        result = query.limit(50).execute()
        jobs = result.data or []

        if not jobs:
            skipped_count += 1
            continue

        print(f"  {email}: {len(jobs)} matching jobs for '{sub.get('name','Alert')}'")

        # Render and send email
        html = render_email_html(name, sub.get("name", "My Alert"), jobs)
        subject = f"{len(jobs)} new AI job{'s' if len(jobs)>1 else ''} matching your alert"

        resend_id = send_email_resend(email, subject, html)

        if resend_id:
            # Log notification
            supabase.table("notification_log").insert({
                "subscription_id": sub["id"],
                "user_id": sub["user_id"],
                "jobs_matched": len(jobs),
                "jobs_sent": json.dumps([{"id": j["id"], "title": j["title"]} for j in jobs[:10]]),
                "resend_id": resend_id,
            }).execute()

            # Update last_sent_at
            supabase.table("subscriptions").update({
                "last_sent_at": today.isoformat()
            }).eq("id", sub["id"]).execute()

            sent_count += 1

        time.sleep(0.2)

    print(f"\n  Sent: {sent_count} | Skipped: {skipped_count}")
    print("=" * 60)


if __name__ == "__main__":
    run_notifications()
