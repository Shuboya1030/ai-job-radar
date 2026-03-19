-- Match Quality Metrics Migration
-- Prerequisite: user_job_matches table must exist (from resume matching migration)

-- 1. Add user feedback columns to matches
ALTER TABLE user_job_matches
    ADD COLUMN IF NOT EXISTS user_feedback TEXT CHECK (user_feedback IN ('up', 'down')),
    ADD COLUMN IF NOT EXISTS feedback_reason TEXT,
    ADD COLUMN IF NOT EXISTS dimension_scores JSONB;
    -- dimension_scores: {domain: 25, skills: 22, experience: 20, role_type: 12}

-- 2. Match interaction events (click + apply tracking)
CREATE TABLE IF NOT EXISTS match_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES user_job_matches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('click', 'apply')),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own events" ON match_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own events" ON match_events
    FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_match_events_match ON match_events(match_id);
CREATE INDEX idx_match_events_user ON match_events(user_id);

-- 3. Admin match reviews
CREATE TABLE IF NOT EXISTS match_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES user_job_matches(id) ON DELETE CASCADE,
    verdict TEXT NOT NULL CHECK (verdict IN ('good', 'bad', 'borderline')),
    notes TEXT,
    reviewed_at TIMESTAMPTZ DEFAULT now()
);
-- No RLS — admin only (accessed via service role from /admin routes)

CREATE INDEX idx_match_reviews_match ON match_reviews(match_id);
ALTER TABLE match_reviews ADD CONSTRAINT match_reviews_match_id_unique UNIQUE (match_id);
