-- Resume Matching Feature Migration
-- Prerequisite: user_profiles table must exist (from user-subscription migration)

-- 1. User Resumes
CREATE TABLE IF NOT EXISTS user_resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx', 'md')),
    file_size INTEGER NOT NULL CHECK (file_size > 0 AND file_size <= 5242880),
    raw_text TEXT,
    parsed_profile JSONB,
    processing_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (processing_status IN ('pending', 'parsing', 'matching', 'completed', 'failed')),
    error_message TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

ALTER TABLE user_resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own resume" ON user_resumes
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own resume" ON user_resumes
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own resume" ON user_resumes
    FOR UPDATE USING (auth.uid() = user_id);

-- 2. Job Match Results
CREATE TABLE IF NOT EXISTS user_job_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    match_score INTEGER NOT NULL CHECK (match_score BETWEEN 0 AND 100),
    match_tier TEXT NOT NULL CHECK (match_tier IN ('strong', 'good', 'stretch')),
    match_reasoning TEXT NOT NULL,
    skills_matched JSONB DEFAULT '[]',
    skills_missing JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now(),
    refreshed_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, job_id)
);

ALTER TABLE user_job_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own matches" ON user_job_matches
    FOR SELECT USING (auth.uid() = user_id);
-- Insert/update/delete only via service role (backend pipeline)

-- 3. User Preferences
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
    work_type_preference TEXT CHECK (work_type_preference IN ('remote', 'hybrid', 'onsite', 'any')),
    salary_min INTEGER,
    salary_max INTEGER,
    company_size_preference TEXT CHECK (company_size_preference IN ('startup', 'growth', 'bigtech', 'any')),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CHECK (salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max)
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own preferences" ON user_preferences
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users upsert own preferences" ON user_preferences
    FOR ALL USING (auth.uid() = user_id);

-- 4. Indexes for performance
CREATE INDEX idx_user_job_matches_user ON user_job_matches(user_id);
CREATE INDEX idx_user_job_matches_score ON user_job_matches(user_id, match_score DESC);
CREATE INDEX idx_user_resumes_status ON user_resumes(processing_status) WHERE processing_status != 'completed';

-- 5. Storage bucket policies (run separately after creating 'resumes' bucket in dashboard)
-- CREATE POLICY "Users upload own resumes" ON storage.objects
--     FOR INSERT WITH CHECK (
--         bucket_id = 'resumes'
--         AND auth.uid()::text = (storage.foldername(name))[1]
--     );
-- CREATE POLICY "Users read own resumes" ON storage.objects
--     FOR SELECT USING (
--         bucket_id = 'resumes'
--         AND auth.uid()::text = (storage.foldername(name))[1]
--     );
-- CREATE POLICY "Users delete own resumes" ON storage.objects
--     FOR DELETE USING (
--         bucket_id = 'resumes'
--         AND auth.uid()::text = (storage.foldername(name))[1]
--     );
