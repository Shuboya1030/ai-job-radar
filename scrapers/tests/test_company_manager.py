"""Tests for company_manager — domain extraction, title normalization."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from company_manager import extract_domain, normalize_title


class TestExtractDomain:
    def test_normal_url(self):
        assert extract_domain("https://www.anthropic.com/careers") == "anthropic.com"

    def test_no_www(self):
        assert extract_domain("https://stripe.com/jobs") == "stripe.com"

    def test_subdomain(self):
        assert extract_domain("https://jobs.lever.co/openai") == "jobs.lever.co"

    def test_linkedin_url_returns_none(self):
        """LinkedIn company URLs should return None — they're not real company domains."""
        assert extract_domain("https://www.linkedin.com/company/apple") is None
        assert extract_domain("https://ca.linkedin.com/company/stripe") is None
        assert extract_domain("https://uk.linkedin.com/company/deepmind") is None

    def test_none_input(self):
        assert extract_domain(None) is None

    def test_empty_string(self):
        assert extract_domain("") is None

    def test_bare_domain(self):
        assert extract_domain("anthropic.com") == "anthropic.com"

    def test_with_port(self):
        assert extract_domain("https://example.com:8080/path") == "example.com"

    def test_trailing_dot(self):
        assert extract_domain("https://example.com./path") == "example.com"


class TestNormalizeTitle:
    def test_basic(self):
        assert normalize_title("Software Engineer") == "software engineer"

    def test_strip_trailing_id(self):
        assert normalize_title("Software Engineer - 12345") == "software engineer"

    def test_strip_parenthetical(self):
        assert normalize_title("AI Engineer (Remote)") == "ai engineer"

    def test_collapse_whitespace(self):
        assert normalize_title("  Senior   Software   Engineer  ") == "senior software engineer"

    def test_none_input(self):
        assert normalize_title(None) is None

    def test_empty_string(self):
        assert normalize_title("") is None

    def test_preserves_level(self):
        assert normalize_title("Staff Machine Learning Engineer") == "staff machine learning engineer"

    def test_en_dash(self):
        assert normalize_title("Data Scientist – 789") == "data scientist"


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
