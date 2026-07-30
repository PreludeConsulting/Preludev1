-- Authoritative Plus/Pro session credits scoped to each successfully paid Stripe billing period.
CREATE TABLE IF NOT EXISTS subscription_session_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID NOT NULL,
  plan_id VARCHAR(20) NOT NULL,
  allowance INTEGER NOT NULL CHECK (allowance > 0),
  remaining INTEGER NOT NULL CHECK (remaining >= 0),
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  stripe_subscription_id VARCHAR(255),
  stripe_invoice_id VARCHAR(255),
  stripe_event_id VARCHAR(255),
  idempotency_key VARCHAR(200) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT subscription_session_periods_remaining_lte_allowance
    CHECK (remaining <= allowance)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_session_periods_invoice
  ON subscription_session_periods (stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_subscription_session_periods_student_status
  ON subscription_session_periods (student_user_id, status, period_end DESC);

CREATE TABLE IF NOT EXISTS subscription_session_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES subscription_session_periods(id) ON DELETE CASCADE,
  student_user_id UUID NOT NULL,
  meeting_id UUID,
  amount INTEGER NOT NULL DEFAULT -1,
  idempotency_key VARCHAR(200) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscription_session_reservations_period
  ON subscription_session_reservations (period_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscription_session_reservations_meeting
  ON subscription_session_reservations (meeting_id)
  WHERE meeting_id IS NOT NULL;

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS subscription_session_period_id UUID;

CREATE INDEX IF NOT EXISTS idx_meetings_subscription_session_period
  ON meetings (subscription_session_period_id)
  WHERE subscription_session_period_id IS NOT NULL;
