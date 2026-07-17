-- Session package inventory for flexible-session purchases (mirrors Prisma migration).
CREATE TABLE IF NOT EXISTS session_package_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID NOT NULL,
  mentor_user_id UUID,
  bundle_id VARCHAR(64) NOT NULL DEFAULT 'flexible_sessions',
  stripe_checkout_session_id VARCHAR(255) UNIQUE,
  sessions_purchased INTEGER NOT NULL,
  sessions_remaining INTEGER NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_packages_student_status
  ON session_package_purchases (student_user_id, status);

CREATE INDEX IF NOT EXISTS idx_session_packages_mentor_status
  ON session_package_purchases (mentor_user_id, status);

ALTER TABLE IF EXISTS meetings ADD COLUMN IF NOT EXISTS access_type VARCHAR(32);
ALTER TABLE IF EXISTS meetings ADD COLUMN IF NOT EXISTS session_package_id UUID;
