-- Company Discovery Migration
-- Adds founder info, product description, and hot score to companies

ALTER TABLE companies ADD COLUMN IF NOT EXISTS founder_name TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS founder_linkedin TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS founder_email TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS product_description TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS hot_score INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_companies_hot_score ON companies(hot_score DESC) WHERE is_active = true;

-- Function to recalculate hot_score for all active companies
CREATE OR REPLACE FUNCTION recalculate_hot_scores() RETURNS void AS $$
BEGIN
  UPDATE companies SET hot_score = (
    -- Has active jobs: +30
    CASE WHEN EXISTS (
      SELECT 1 FROM jobs WHERE jobs.company_id = companies.id AND jobs.is_active = true
    ) THEN 30 ELSE 0 END
    -- Recent funding (last 90 days): +25
    + CASE WHEN last_funding_date IS NOT NULL AND last_funding_date > now() - interval '90 days' THEN 25 ELSE 0 END
    -- Has founder contact: +15
    + CASE WHEN founder_linkedin IS NOT NULL OR founder_email IS NOT NULL THEN 15 ELSE 0 END
    -- Has product description: +10
    + CASE WHEN product_description IS NOT NULL AND length(product_description) > 10 THEN 10 ELSE 0 END
    -- Funding amount weight: +0-10
    + CASE
        WHEN funding_amount_cents IS NOT NULL AND funding_amount_cents > 10000000000 THEN 10  -- >$100M
        WHEN funding_amount_cents IS NOT NULL AND funding_amount_cents > 1000000000 THEN 8    -- >$10M
        WHEN funding_amount_cents IS NOT NULL AND funding_amount_cents > 100000000 THEN 5     -- >$1M
        WHEN funding_amount_cents IS NOT NULL AND funding_amount_cents > 0 THEN 3
        ELSE 0
      END
    -- Has website: +10
    + CASE WHEN website IS NOT NULL AND length(website) > 5 THEN 10 ELSE 0 END
  )
  WHERE is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Run it once
SELECT recalculate_hot_scores();
