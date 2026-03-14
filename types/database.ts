export type CompanyType = 'Startup' | 'Scale-up' | 'Big Tech' | 'Enterprise'

export type Industry =
  | 'AI/ML' | 'Fintech' | 'Healthcare' | 'E-commerce' | 'SaaS'
  | 'Cybersecurity' | 'Robotics' | 'EdTech' | 'Adtech'
  | 'Cloud/Infra' | 'Gaming' | 'Automotive' | 'Biotech'
  | 'Enterprise Software' | 'Social/Media' | 'Other'

export type FundingStage =
  | 'Pre-seed' | 'Seed' | 'Series A' | 'Series B' | 'Series C'
  | 'Series D+' | 'Public' | 'Bootstrapped' | 'Unknown'

export type RoleCategory = 'AI PM' | 'AI Engineer' | 'Software Engineer'

export type Seniority =
  | 'Intern' | 'Junior' | 'Mid' | 'Senior' | 'Staff'
  | 'Principal' | 'Lead' | 'Manager' | 'Unknown'

export type WorkType = 'Remote' | 'Hybrid' | 'On-site' | 'Unknown'

export type EmploymentType = 'Full-time' | 'Part-time' | 'Contract' | 'Internship'

export interface Company {
  id: string
  canonical_domain: string | null
  name: string
  website: string | null
  logo_url: string | null
  company_type: CompanyType | null
  industry: Industry | null
  funding_stage: FundingStage | null
  funding_amount_cents: number | null
  funding_amount_status: 'known' | 'unknown'
  last_funding_date: string | null
  employee_range: string | null
  headquarter: string | null
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Job {
  id: string
  source_id: string
  source: 'LinkedIn' | 'Wellfound' | 'YC'
  company_id: string | null
  title: string
  title_normalized: string | null
  role_category: RoleCategory | null
  seniority: Seniority | null
  employment_type: EmploymentType | null
  work_type: WorkType | null
  location: string | null
  salary_annual_min: number | null
  salary_annual_max: number | null
  salary_raw_min: number | null
  salary_raw_max: number | null
  salary_raw_type: 'Annual' | 'Hourly' | 'Unknown' | null
  description: string | null
  hard_skills: string[]
  soft_skills: string[]
  tools: string[]
  experience_years: string | null
  industry: Industry | null
  apply_url: string | null
  posted_at: string | null
  scraped_at: string
  last_seen_at: string
  is_active: boolean
  canonical_job_id: string | null
}

export interface JobFull extends Job {
  company_name: string | null
  company_logo: string | null
  company_type: CompanyType | null
  funding_stage: FundingStage | null
  funding_amount_cents: number | null
  funding_amount_status: 'known' | 'unknown' | null
  last_funding_date: string | null
  employee_range: string | null
  headquarter: string | null
  company_description: string | null
  company_industry: Industry | null
}

export interface SkillEntry {
  name: string
  count: number
  pct: number
}

export interface MarketSnapshot {
  id: string
  role_category: RoleCategory
  snapshot_date: string
  total_jobs: number
  hard_skills: SkillEntry[]
  soft_skills: SkillEntry[]
  tools: SkillEntry[]
  work_type_dist: Record<string, number>
  seniority_dist: Record<string, number>
  salary_stats: {
    overall_avg_min: number | null
    overall_avg_max: number | null
    by_seniority: Record<string, { avg_min: number; avg_max: number; count: number }>
    top_paying_companies: { name: string; avg_max: number }[]
  }
  top_companies: { name: string; count: number }[]
  top_locations: { name: string; count: number }[]
  experience_dist: Record<string, number>
  must_have_keywords: { hard: string[]; soft: string[]; tools: string[] }
  nice_to_have_keywords: { hard: string[]; soft: string[]; tools: string[] }
  jobs_with_salary_pct: number
}

export interface Database {
  public: {
    Tables: {
      companies: { Row: Company }
      jobs: { Row: Job }
      market_snapshots: { Row: MarketSnapshot }
    }
    Views: {
      v_jobs_full: { Row: JobFull }
      v_jobs_with_salary: { Row: JobFull }
    }
  }
}
