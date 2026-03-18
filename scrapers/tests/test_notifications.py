"""Tests for email notification pipeline — matching logic and email rendering."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from send_notifications import render_job_card_html, render_email_html


class TestJobCardRendering:
    def test_basic_job_card(self):
        job = {
            "id": "test-123",
            "title": "AI Engineer",
            "company_name": "Anthropic",
            "funding_stage": "Series C",
            "funding_amount_cents": 730000000000,
            "funding_amount_status": "known",
            "salary_annual_min": 180000,
            "salary_annual_max": 250000,
            "role_category": "AI Engineer",
            "work_type": "Hybrid",
            "location": "San Francisco, CA",
        }
        html = render_job_card_html(job)
        assert "Anthropic" in html
        assert "AI Engineer" in html
        assert "$180K" in html
        assert "Series C" in html
        assert "$7.3B" in html
        assert "View Job" in html
        assert "test-123" in html

    def test_job_card_no_salary(self):
        job = {
            "id": "test-456",
            "title": "SWE Intern",
            "company_name": "Startup X",
            "salary_annual_min": None,
        }
        html = render_job_card_html(job)
        assert "SWE Intern" in html
        assert "$" not in html or "Funding unknown" in html

    def test_job_card_no_funding(self):
        job = {
            "id": "test-789",
            "title": "PM",
            "company_name": "Mystery Co",
            "funding_stage": None,
            "funding_amount_cents": None,
        }
        html = render_job_card_html(job)
        assert "Funding unknown" in html

    def test_job_card_public_company(self):
        job = {
            "id": "test-pub",
            "title": "ML Engineer",
            "company_name": "Google",
            "funding_stage": "Public",
            "funding_amount_cents": 0,
            "funding_amount_status": "known",
        }
        html = render_job_card_html(job)
        assert "Public" in html


class TestEmailRendering:
    def test_email_with_multiple_jobs(self):
        jobs = [
            {"id": "1", "title": "AI Engineer", "company_name": "Co A",
             "funding_stage": "Series A", "funding_amount_cents": 5000000000,
             "funding_amount_status": "known", "salary_annual_min": 150000,
             "salary_annual_max": 200000, "role_category": "AI Engineer",
             "work_type": "Remote", "location": "US"},
            {"id": "2", "title": "PM", "company_name": "Co B",
             "funding_stage": None, "funding_amount_cents": None,
             "salary_annual_min": None},
        ]
        html = render_email_html("Gary", "My AI Alert", jobs)
        assert "2 new jobs" in html
        assert "My AI Alert" in html
        assert "Hi Gary" in html
        assert "Co A" in html
        assert "Co B" in html
        assert "Manage alerts" in html
        assert "Unsubscribe" in html

    def test_email_single_job(self):
        jobs = [{"id": "1", "title": "Engineer", "company_name": "X"}]
        html = render_email_html("User", "Alert", jobs)
        assert "1 new job" in html  # singular
        assert "1 new jobs" not in html

    def test_email_no_name(self):
        jobs = [{"id": "1", "title": "E", "company_name": "X"}]
        html = render_email_html(None, "Alert", jobs)
        assert "Hi there" in html

    def test_email_contains_site_links(self):
        jobs = [{"id": "abc", "title": "E", "company_name": "X"}]
        html = render_email_html("U", "A", jobs)
        assert "aistartupjob.com" in html
        assert "/jobs/abc" in html
        assert "/settings" in html


class TestMatchingLogic:
    """Test the subscription filter matching concept."""

    def _matches(self, job, sub):
        """Simulate matching logic from send_notifications."""
        roles = sub.get("roles") or []
        industries = sub.get("industries") or []
        funding_stages = sub.get("funding_stages") or []
        work_types = sub.get("work_types") or []

        if roles and job.get("role_category") not in roles:
            return False
        if industries and job.get("industry") not in industries:
            return False
        if funding_stages and job.get("funding_stage") not in funding_stages:
            return False
        if work_types and job.get("work_type") not in work_types:
            return False
        return True

    def test_empty_filters_match_all(self):
        job = {"role_category": "AI Engineer", "industry": "AI/ML", "funding_stage": "Seed", "work_type": "Remote"}
        sub = {"roles": [], "industries": [], "funding_stages": [], "work_types": []}
        assert self._matches(job, sub) is True

    def test_role_filter(self):
        job = {"role_category": "AI Engineer", "industry": "AI/ML"}
        assert self._matches(job, {"roles": ["AI Engineer"]}) is True
        assert self._matches(job, {"roles": ["AI PM"]}) is False

    def test_industry_filter(self):
        job = {"role_category": "SWE", "industry": "Fintech"}
        assert self._matches(job, {"industries": ["Fintech"]}) is True
        assert self._matches(job, {"industries": ["Healthcare"]}) is False

    def test_funding_filter(self):
        job = {"funding_stage": "Series A"}
        assert self._matches(job, {"funding_stages": ["Seed", "Series A"]}) is True
        assert self._matches(job, {"funding_stages": ["Series C"]}) is False

    def test_combined_filters(self):
        job = {"role_category": "AI Engineer", "industry": "AI/ML", "funding_stage": "Seed", "work_type": "Remote"}
        sub = {"roles": ["AI Engineer"], "industries": ["AI/ML"], "funding_stages": ["Seed"], "work_types": ["Remote"]}
        assert self._matches(job, sub) is True

        # Change one filter to not match
        sub2 = {**sub, "work_types": ["On-site"]}
        assert self._matches(job, sub2) is False

    def test_none_filters_treated_as_empty(self):
        job = {"role_category": "SWE"}
        sub = {"roles": None, "industries": None, "funding_stages": None, "work_types": None}
        assert self._matches(job, sub) is True


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
