"""Tests for enrichment module — salary normalization, enum validation."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from enrichment import _validate_enum, _normalize_salary, _validate_enrichment, _empty_enrichment


class TestValidateEnum:
    def test_exact_match(self):
        assert _validate_enum("Remote", ["Remote", "Hybrid", "On-site", "Unknown"]) == "Remote"

    def test_case_insensitive(self):
        assert _validate_enum("remote", ["Remote", "Hybrid", "On-site", "Unknown"]) == "Remote"

    def test_invalid_returns_default(self):
        assert _validate_enum("foo", ["Remote", "Hybrid"], "Unknown") == "Unknown"

    def test_none_returns_default(self):
        assert _validate_enum(None, ["Remote", "Hybrid"], "Unknown") == "Unknown"


class TestNormalizeSalary:
    def test_annual_passthrough(self):
        assert _normalize_salary(120000, 180000, "Annual") == (120000, 180000)

    def test_hourly_conversion(self):
        # $55.50/hr * 2080 = $115,440
        annual_min, annual_max = _normalize_salary(55.5, 75.0, "Hourly")
        assert annual_min == 115440
        assert annual_max == 156000

    def test_none_values(self):
        assert _normalize_salary(None, None, "Annual") == (None, None)

    def test_mixed_none(self):
        annual_min, annual_max = _normalize_salary(100000, None, "Annual")
        assert annual_min == 100000
        assert annual_max is None

    def test_garbage_small_numbers_filtered(self):
        # Numbers < 1000 are likely garbage (e.g. "5+" years misinterpreted)
        annual_min, _ = _normalize_salary(5, None, "Annual")
        assert annual_min is None

    def test_unknown_type_treated_as_annual(self):
        annual_min, annual_max = _normalize_salary(150000, 200000, "Unknown")
        assert annual_min == 150000
        assert annual_max == 200000


class TestValidateEnrichment:
    def test_full_valid_data(self):
        data = {
            "hard_skills": ["Python", "ML"],
            "soft_skills": ["Communication"],
            "tools": ["AWS"],
            "salary_min": 120000,
            "salary_max": 180000,
            "salary_type": "Annual",
            "work_type": "Remote",
            "seniority": "Senior",
            "experience_years": "5+",
            "industry": "AI/ML",
            "company_type": "Startup",
            "employment_type": "Full-time",
        }
        result = _validate_enrichment(data)
        assert result["salary_annual_min"] == 120000
        assert result["salary_annual_max"] == 180000
        assert result["salary_raw_min"] == 120000.0
        assert result["salary_raw_max"] == 180000.0
        assert result["salary_raw_type"] == "Annual"
        assert result["work_type"] == "Remote"
        assert result["seniority"] == "Senior"
        assert result["industry"] == "AI/ML"
        assert result["hard_skills"] == ["Python", "ML"]

    def test_hourly_salary_normalized(self):
        data = {
            "salary_min": 55.5,
            "salary_max": 75.0,
            "salary_type": "Hourly",
            "hard_skills": [], "soft_skills": [], "tools": [],
        }
        result = _validate_enrichment(data)
        assert result["salary_annual_min"] == 115440  # 55.5 * 2080
        assert result["salary_annual_max"] == 156000  # 75.0 * 2080
        assert result["salary_raw_min"] == 55.5
        assert result["salary_raw_type"] == "Hourly"

    def test_invalid_enums_fallback(self):
        data = {
            "work_type": "FullRemote",
            "seniority": "Expert",
            "industry": "SpaceTech",
            "company_type": "Unicorn",
            "hard_skills": [], "soft_skills": [], "tools": [],
        }
        result = _validate_enrichment(data)
        assert result["work_type"] == "Unknown"
        assert result["seniority"] == "Unknown"
        assert result["industry"] == "Other"
        assert result["company_type"] == "Enterprise"

    def test_null_salary(self):
        data = {
            "salary_min": None,
            "salary_max": None,
            "salary_type": "Unknown",
            "hard_skills": [], "soft_skills": [], "tools": [],
        }
        result = _validate_enrichment(data)
        assert result["salary_annual_min"] is None
        assert result["salary_annual_max"] is None

    def test_missing_fields_use_defaults(self):
        result = _validate_enrichment({})
        assert result["hard_skills"] == []
        assert result["work_type"] == "Unknown"
        assert result["seniority"] == "Unknown"
        assert result["industry"] == "Other"


class TestEmptyEnrichment:
    def test_returns_all_fields(self):
        result = _empty_enrichment()
        assert "hard_skills" in result
        assert "salary_annual_min" in result
        assert "salary_raw_type" in result
        assert result["hard_skills"] == []
        assert result["salary_annual_min"] is None
        assert result["work_type"] == "Unknown"


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
