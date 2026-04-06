-- Company Suggestions + News tables migration

-- 1. Company suggestions (user-submitted)
CREATE TABLE IF NOT EXISTS company_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id),
    company_name TEXT NOT NULL,
    website TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE company_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own suggestions" ON company_suggestions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own suggestions" ON company_suggestions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 2. News items
CREATE TABLE IF NOT EXISTS news_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    summary TEXT,
    source_url TEXT NOT NULL,
    source_name TEXT NOT NULL,
    industry_tags JSONB DEFAULT '[]',
    event_type TEXT CHECK (event_type IN ('funding', 'launch', 'acquisition', 'milestone', 'other')),
    company_name TEXT,
    company_id UUID REFERENCES companies(id),
    image_url TEXT,
    published_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(source_url)
);

CREATE INDEX idx_news_published ON news_items(published_at DESC);
CREATE INDEX idx_news_event_type ON news_items(event_type);

-- 3. News subscriptions
CREATE TABLE IF NOT EXISTS news_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    industry_tags JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now(),
    last_sent_at TIMESTAMPTZ,
    UNIQUE(user_id)
);

ALTER TABLE news_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own news sub" ON news_subscriptions
    FOR ALL USING (auth.uid() = user_id);

-- 4. Company matches
CREATE TABLE IF NOT EXISTS user_company_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    match_score INTEGER NOT NULL CHECK (match_score BETWEEN 0 AND 100),
    match_tier TEXT NOT NULL CHECK (match_tier IN ('strong', 'good', 'stretch')),
    match_reasoning TEXT NOT NULL,
    skills_matched JSONB DEFAULT '[]',
    skills_missing JSONB DEFAULT '[]',
    has_open_jobs BOOLEAN DEFAULT false,
    open_job_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, company_id)
);

ALTER TABLE user_company_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own company matches" ON user_company_matches
    FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_user_company_matches_user ON user_company_matches(user_id);
CREATE INDEX idx_user_company_matches_score ON user_company_matches(user_id, match_score DESC);
