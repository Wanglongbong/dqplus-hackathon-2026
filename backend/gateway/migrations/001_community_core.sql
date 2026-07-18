CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(255) NOT NULL,
  country VARCHAR(255),
  stage VARCHAR(255),
  num_of_employees INTEGER,
  industry VARCHAR(255),
  target_region VARCHAR(255),
  arr NUMERIC(18,2),
  where_you_operate VARCHAR(255),
  website TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  description_product TEXT,
  checks VARCHAR(255),
  email VARCHAR(255),
  phone_number VARCHAR(255),
  avg_initial_investment NUMERIC(18,2),
  annual_investment_count INTEGER,
  avg_holding_period NUMERIC(5,2),
  year_founded INTEGER,
  funding_ask_usd NUMERIC(18,2),
  check_size_min_usd NUMERIC(18,2),
  check_size_max_usd NUMERIC(18,2),
  traction_summary TEXT,
  investment_thesis TEXT,
  portfolio_highlights TEXT,
  linkedin_url VARCHAR(255),
  verification_status VARCHAR(32) NOT NULL DEFAULT 'unverified',
  verification_method VARCHAR(64),
  verified_at TIMESTAMPTZ,
  profile_status VARCHAR(32) NOT NULL DEFAULT 'draft',
  extraction_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  visibility VARCHAR(32) NOT NULL DEFAULT 'community',
  consent_version VARCHAR(32),
  consented_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS funding_ask_usd NUMERIC(18,2);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS check_size_min_usd NUMERIC(18,2);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS check_size_max_usd NUMERIC(18,2);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS traction_summary TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS investment_thesis TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS portfolio_highlights TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_status VARCHAR(32) NOT NULL DEFAULT 'unverified';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_method VARCHAR(64);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_status VARCHAR(32) NOT NULL DEFAULT 'draft';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS extraction_status VARCHAR(32) NOT NULL DEFAULT 'pending';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS visibility VARCHAR(32) NOT NULL DEFAULT 'community';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS consent_version VARCHAR(32);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS consented_at TIMESTAMPTZ;
ALTER TABLE profiles ALTER COLUMN description_product TYPE TEXT;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  dob DATE,
  profile_id UUID UNIQUE REFERENCES profiles(id) ON DELETE SET NULL,
  role VARCHAR(32) NOT NULL CHECK (role IN ('founder', 'investor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_profile_id_unique
  ON users(profile_id) WHERE profile_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS connection_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  intent VARCHAR(32) NOT NULL CHECK (intent IN ('fundraising', 'investment', 'pilot', 'partnership')),
  message TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn', 'expired')),
  saved_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '14 days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (sender_user_id <> receiver_user_id)
);

CREATE INDEX IF NOT EXISTS connection_requests_sender_idx ON connection_requests(sender_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS connection_requests_receiver_idx ON connection_requests(receiver_user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS connection_requests_pending_pair_unique
  ON connection_requests(
    LEAST(sender_user_id, receiver_user_id),
    GREATEST(sender_user_id, receiver_user_id)
  ) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(32) NOT NULL CHECK (type IN ('fundraising', 'investment', 'pilot', 'partnership')),
  title VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS opportunities_active_idx ON opportunities(status, expires_at);

CREATE TABLE IF NOT EXISTS match_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  candidate_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(32) NOT NULL CHECK (action IN ('saved', 'not_relevant')),
  reason VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (requester_user_id, candidate_user_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  connection_request_id UUID REFERENCES connection_requests(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  reason VARCHAR(255) NOT NULL,
  details TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status, created_at);
