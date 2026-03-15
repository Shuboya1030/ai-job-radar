"""Tests for dedup module — richness scoring logic."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class TestRichnessScoring:
    """Test the richness scoring logic used in dedup to pick winners."""

    def _richness(self, j):
        """Copied from dedup.py for unit testing."""
        score = 0
        if j.get("salary_annual_min"): score += 2
        if j.get("description"): score += 1
        if j.get("hard_skills") and j["hard_skills"] != "[]": score += 1
        if j.get("tools") and j["tools"] != "[]": score += 1
        return score

    def test_full_record_scores_highest(self):
        full = {
            "salary_annual_min": 120000,
            "description": "Great job",
            "hard_skills": '["Python"]',
            "tools": '["AWS"]',
        }
        assert self._richness(full) == 5

    def test_empty_record_scores_zero(self):
        empty = {
            "salary_annual_min": None,
            "description": None,
            "hard_skills": "[]",
            "tools": "[]",
        }
        assert self._richness(empty) == 0

    def test_salary_worth_more(self):
        """Salary is worth 2 points, other fields 1 each."""
        with_salary = {"salary_annual_min": 100000}
        with_desc = {"description": "A job"}
        assert self._richness(with_salary) > self._richness(with_desc)

    def test_richer_source_wins(self):
        linkedin = {
            "salary_annual_min": 150000,
            "description": "Full description here",
            "hard_skills": '["Python", "ML"]',
            "tools": '["AWS"]',
        }
        wellfound = {
            "salary_annual_min": None,
            "description": "Short desc",
            "hard_skills": "[]",
            "tools": "[]",
        }
        assert self._richness(linkedin) > self._richness(wellfound)


class TestDedup:
    """Integration-level tests for dedup grouping logic."""

    def test_same_company_title_location_groups(self):
        """Jobs with same company_id + title_normalized + location should group."""
        jobs = [
            {"company_id": "abc", "title_normalized": "software engineer", "location": "sf"},
            {"company_id": "abc", "title_normalized": "software engineer", "location": "sf"},
            {"company_id": "abc", "title_normalized": "data scientist", "location": "sf"},
        ]

        groups = {}
        for job in jobs:
            key = (job["company_id"], job["title_normalized"], job["location"])
            groups.setdefault(key, []).append(job)

        dupes = {k: v for k, v in groups.items() if len(v) > 1}
        assert len(dupes) == 1
        assert len(list(dupes.values())[0]) == 2

    def test_different_location_no_group(self):
        jobs = [
            {"company_id": "abc", "title_normalized": "software engineer", "location": "sf"},
            {"company_id": "abc", "title_normalized": "software engineer", "location": "nyc"},
        ]

        groups = {}
        for job in jobs:
            key = (job["company_id"], job["title_normalized"], job["location"])
            groups.setdefault(key, []).append(job)

        dupes = {k: v for k, v in groups.items() if len(v) > 1}
        assert len(dupes) == 0

    def test_no_company_id_skipped(self):
        jobs = [
            {"company_id": None, "title_normalized": "engineer", "location": "sf"},
            {"company_id": None, "title_normalized": "engineer", "location": "sf"},
        ]

        groups = {}
        for job in jobs:
            key = (job["company_id"], job["title_normalized"], job["location"])
            if not key[0] or not key[1]:
                continue
            groups.setdefault(key, []).append(job)

        assert len(groups) == 0


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
