-- ═══════════════════════════════════════════════════════════
-- AIJobRadar Database Schema
-- Run this in Supabase SQL Editor to set up all tables
-- ═══════════════════════════════════════════════════════════

-- COMPANIES
CREATE TABLE companies (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  canonical_domain TEXT UNIQUE,
  name          TEXT NOT NULL,
  website       TEXT,
  logo_url      TEXT,
  company_type  TEXT CHECK (company_type IN (
                  'Startup', 'Scale-up', 'Big Tech', 'Enterprise'
                )),
  industry      TEXT CHECK (industry IN (
                  'AI/ML', 'Fintech', 'Healthcare', 'E-commerce', 'SaaS',
                  'Cybersecurity', 'Robotics', 'EdTech', 'Adtech',
                  'Cloud/Infra', 'Gaming', 'Automotive', 'Biotech',
                  'Enterprise Software', 'Social/Media', 'Other'
                )),
  funding_stage TEXT CHECK (funding_stage IN (
                  'Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C',
                  'Series D+', 'Public', 'Bootstrapped', 'Unknown'
                )),
  funding_amount_cents  BIGINT,
  funding_amount_status TEXT DEFAULT 'unknown' CHECK (funding_amount_status IN ('known', 'unknown')),
  last_funding_date     DATE,
  employee_range TEXT CHECK (employee_range IN (
                  '1-10', '11-50', '51-200', '201-500', '501-1000',
                  '1001-5000', '5000+'
                )),
  headquarter   TEXT,
  description   TEXT,
  is_active     BOOLEAN DEFAULT true,
  health_warnings INTEGER DEFAULT 0,
  last_health_check TIMESTAMPTZ,
  health_failure_type TEXT,
  source        TEXT CHECK (source IN ('LinkedIn', 'Wellfound', 'YC', 'Manual')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Company aliases
CREATE TABLE company_aliases (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  alias         TEXT NOT NULL,
  source        TEXT,
  UNIQUE(alias, source)
);

-- Source-specific company IDs
CREATE TABLE company_source_ids (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source        TEXT NOT NULL CHECK (source IN ('LinkedIn', 'Wellfound', 'YC')),
  source_company_id TEXT NOT NULL,
  UNIQUE(source, source_company_id)
);

-- JOBS
CREATE TABLE jobs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id       TEXT NOT NULL,
  source          TEXT NOT NULL CHECK (source IN ('LinkedIn', 'Wellfound', 'YC')),
  company_id      UUID REFERENCES companies(id),
  title           TEXT NOT NULL,
  title_normalized TEXT,
  role_category   TEXT CHECK (role_category IN ('AI PM', 'AI Engineer', 'Software Engineer')),
  seniority       TEXT CHECK (seniority IN (
                    'Intern', 'Junior', 'Mid', 'Senior', 'Staff',
                    'Principal', 'Lead', 'Manager', 'Unknown'
                  )),
  employment_type TEXT CHECK (employment_type IN (
                    'Full-time', 'Part-time', 'Contract', 'Internship'
                  )),
  work_type       TEXT CHECK (work_type IN ('Remote', 'Hybrid', 'On-site', 'Unknown')),
  location        TEXT,
  salary_annual_min  INTEGER,
  salary_annual_max  INTEGER,
  salary_raw_min     NUMERIC,
  salary_raw_max     NUMERIC,
  salary_raw_type    TEXT CHECK (salary_raw_type IN ('Annual', 'Hourly', 'Unknown')),
  description     TEXT,
  hard_skills     JSONB DEFAULT '[]',
  soft_skills     JSONB DEFAULT '[]',
  tools           JSONB DEFAULT '[]',
  experience_years TEXT,
  industry        TEXT,
  apply_url       TEXT,
  posted_at       DATE,
  scraped_at      TIMESTAMPTZ DEFAULT now(),
  last_seen_at    TIMESTAMPTZ DEFAULT now(),
  is_active       BOOLEAN DEFAULT true,
  canonical_job_id UUID REFERENCES jobs(id),
  UNIQUE(source, source_id)
);

-- MARKET SNAPSHOTS
CREATE TABLE market_snapshots (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role_category   TEXT NOT NULL,
  snapshot_date   DATE NOT NULL,
  total_jobs      INTEGER,
  hard_skills     JSONB,
  soft_skills     JSONB,
  tools           JSONB,
  work_type_dist  JSONB,
  seniority_dist  JSONB,
  salary_stats    JSONB,
  top_companies   JSONB,
  top_locations   JSONB,
  experience_dist JSONB,
  must_have_keywords JSONB,
  nice_to_have_keywords JSONB,
  jobs_with_salary_pct NUMERIC,
  UNIQUE(role_category, snapshot_date)
);

-- ═══════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════
CREATE INDEX idx_jobs_role ON jobs(role_category);
CREATE INDEX idx_jobs_source ON jobs(source);
CREATE INDEX idx_jobs_company ON jobs(company_id);
CREATE INDEX idx_jobs_work_type ON jobs(work_type);
CREATE INDEX idx_jobs_industry ON jobs(industry);
CREATE INDEX idx_jobs_posted ON jobs(posted_at DESC);
CREATE INDEX idx_jobs_active ON jobs(is_active) WHERE is_active = true;
CREATE INDEX idx_jobs_canonical ON jobs(canonical_job_id) WHERE canonical_job_id IS NULL;
CREATE INDEX idx_jobs_salary ON jobs(salary_annual_min, salary_annual_max) WHERE salary_annual_min IS NOT NULL;
CREATE INDEX idx_jobs_skills ON jobs USING GIN(hard_skills);
CREATE INDEX idx_jobs_tools ON jobs USING GIN(tools);
CREATE INDEX idx_jobs_last_seen ON jobs(last_seen_at);
CREATE INDEX idx_jobs_title_norm ON jobs(title_normalized);
CREATE INDEX idx_companies_active ON companies(is_active) WHERE is_active = true;
CREATE INDEX idx_companies_domain ON companies(canonical_domain);
CREATE INDEX idx_company_aliases ON company_aliases(alias);
CREATE INDEX idx_market_role_date ON market_snapshots(role_category, snapshot_date DESC);

-- ═══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_source_ids ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read jobs" ON jobs FOR SELECT USING (true);
CREATE POLICY "Public read companies" ON companies FOR SELECT USING (true);
CREATE POLICY "Public read aliases" ON company_aliases FOR SELECT USING (true);
CREATE POLICY "Public read source ids" ON company_source_ids FOR SELECT USING (true);
CREATE POLICY "Public read snapshots" ON market_snapshots FOR SELECT USING (true);

-- ═══════════════════════════════════════════════════════════
-- VIEWS
-- ═══════════════════════════════════════════════════════════
CREATE VIEW v_jobs_full AS
SELECT
  j.*,
  c.name AS company_name,
  c.logo_url AS company_logo,
  c.company_type,
  c.funding_stage,
  c.funding_amount_cents,
  c.funding_amount_status,
  c.last_funding_date,
  c.employee_range,
  c.headquarter,
  c.description AS company_description,
  c.industry AS company_industry
FROM jobs j
LEFT JOIN companies c ON j.company_id = c.id
WHERE j.is_active = true
  AND j.canonical_job_id IS NULL
  AND (c.is_active = true OR c.id IS NULL);

CREATE VIEW v_jobs_with_salary AS
SELECT * FROM v_jobs_full
WHERE salary_annual_min IS NOT NULL;
