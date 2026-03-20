-- Subscription columns on user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'free'
    CHECK (subscription_status IN ('free', 'active', 'cancelled')),
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription
  ON user_profiles(subscription_status)
  WHERE subscription_status = 'active';

-- Retry counter for matching failures
ALTER TABLE user_resumes ADD COLUMN IF NOT EXISTS match_retry_count INTEGER DEFAULT 0;

-- Timing metrics
ALTER TABLE user_resumes ADD COLUMN IF NOT EXISTS parse_duration_seconds INTEGER;
ALTER TABLE user_resumes ADD COLUMN IF NOT EXISTS match_duration_seconds INTEGER;

-- Update processing_status constraint to support new statuses
ALTER TABLE user_resumes DROP CONSTRAINT IF EXISTS user_resumes_processing_status_check;
ALTER TABLE user_resumes ADD CONSTRAINT user_resumes_processing_status_check
  CHECK (processing_status IN ('pending', 'parsing', 'parsed', 'matching', 'matching_stage1', 'matching_stage2', 'completed', 'failed'));
