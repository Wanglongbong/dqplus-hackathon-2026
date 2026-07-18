CREATE TABLE IF NOT EXISTS deal_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id VARCHAR(128) UNIQUE,
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  alias VARCHAR(80) NOT NULL UNIQUE,
  company_name VARCHAR(255),
  sector VARCHAR(80) NOT NULL,
  stage VARCHAR(40) NOT NULL,
  location VARCHAR(120) NOT NULL,
  funding_ask_usd NUMERIC(18,2),
  traction_summary TEXT NOT NULL,
  product_summary TEXT NOT NULL,
  evidence_count INTEGER NOT NULL DEFAULT 0 CHECK (evidence_count >= 0),
  confidence NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
  source_checked_at TIMESTAMPTZ,
  is_stale BOOLEAN NOT NULL DEFAULT false,
  offline_meet_count INTEGER NOT NULL DEFAULT 0 CHECK (offline_meet_count >= 0),
  last_met_at TIMESTAMPTZ,
  status VARCHAR(24) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deal_profiles_public_idx
  ON deal_profiles(status, is_stale, confidence DESC);

CREATE TABLE IF NOT EXISTS entity_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_profile_id UUID NOT NULL REFERENCES deal_profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  source_type VARCHAR(32) NOT NULL CHECK (source_type IN ('founder_submission', 'official_website', 'accelerator', 'portfolio', 'official_press', 'rss')),
  content_hash VARCHAR(64),
  last_checked_at TIMESTAMPTZ,
  next_refresh_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_status VARCHAR(24) NOT NULL DEFAULT 'pending' CHECK (last_status IN ('pending', 'fresh', 'unchanged', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_profile_id, url)
);

CREATE INDEX IF NOT EXISTS entity_sources_due_idx ON entity_sources(next_refresh_at, last_status);

CREATE TABLE IF NOT EXISTS pulse_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(32) NOT NULL CHECK (event_type IN ('meeting', 'evidence', 'offline', 'session')),
  public_text VARCHAR(255) NOT NULL,
  public_meta VARCHAR(255),
  deal_profile_id UUID REFERENCES deal_profiles(id) ON DELETE SET NULL,
  is_public BOOLEAN NOT NULL DEFAULT true,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pulse_events_public_idx ON pulse_events(is_public, occurred_at DESC);

CREATE TABLE IF NOT EXISTS coffee_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status VARCHAR(32) NOT NULL DEFAULT 'inviting' CHECK (status IN ('draft', 'inviting', 'threshold_met', 'awaiting_payment', 'paid', 'confirmed', 'completed', 'expired', 'cancelled')),
  fee_vnd INTEGER NOT NULL DEFAULT 1490000 CHECK (fee_vnd >= 0),
  minimum_acceptances INTEGER NOT NULL DEFAULT 3 CHECK (minimum_acceptances BETWEEN 1 AND 5),
  invitation_expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '48 hours',
  threshold_expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days',
  selected_slot_id UUID,
  venue_id UUID,
  confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coffee_sessions_investor_idx ON coffee_sessions(investor_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS session_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES coffee_sessions(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 90 CHECK (duration_minutes = 90),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, starts_at)
);

ALTER TABLE coffee_sessions
  ADD CONSTRAINT coffee_sessions_selected_slot_fk
  FOREIGN KEY (selected_slot_id) REFERENCES session_slots(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  district VARCHAR(120) NOT NULL,
  address TEXT,
  google_place_id VARCHAR(255),
  rating NUMERIC(3,2),
  suitability_score NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (suitability_score >= 0 AND suitability_score <= 100),
  capacity INTEGER,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE coffee_sessions
  ADD CONSTRAINT coffee_sessions_venue_fk
  FOREIGN KEY (venue_id) REFERENCES venues(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES coffee_sessions(id) ON DELETE CASCADE,
  deal_profile_id UUID REFERENCES deal_profiles(id) ON DELETE SET NULL,
  participant_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  role VARCHAR(16) NOT NULL CHECK (role IN ('investor', 'startup', 'host')),
  status VARCHAR(24) NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined', 'waitlist', 'attended', 'no_show')),
  available_slot_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  responded_at TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ,
  checked_in_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, deal_profile_id)
);

CREATE INDEX IF NOT EXISTS session_participants_user_idx ON session_participants(participant_user_id, status);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES coffee_sessions(id) ON DELETE RESTRICT,
  investor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  provider VARCHAR(20) NOT NULL DEFAULT 'payos' CHECK (provider IN ('payos', 'mock')),
  provider_order_code BIGINT NOT NULL UNIQUE,
  provider_payment_link_id VARCHAR(255),
  amount_vnd INTEGER NOT NULL CHECK (amount_vnd > 0),
  status VARCHAR(24) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded', 'credited')),
  checkout_url TEXT,
  paid_at TIMESTAMPTZ,
  webhook_event_key VARCHAR(255) UNIQUE,
  raw_webhook JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_session_idx ON payments(session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS offline_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES coffee_sessions(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_deal_profile_id UUID REFERENCES deal_profiles(id) ON DELETE SET NULL,
  useful BOOLEAN,
  private_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, author_user_id, subject_deal_profile_id)
);

CREATE INDEX IF NOT EXISTS offline_feedback_session_idx ON offline_feedback(session_id);
