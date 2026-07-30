-- Essay Support review-credit ledger (auditable purchases / assignments / cancellations).
CREATE TABLE IF NOT EXISTS review_credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  transaction_type VARCHAR(40) NOT NULL,
  package_key VARCHAR(64),
  stripe_checkout_session_id VARCHAR(255),
  stripe_payment_intent_id VARCHAR(255),
  activity_id UUID,
  package_purchase_id TEXT,
  idempotency_key VARCHAR(160) NOT NULL UNIQUE,
  reason TEXT,
  created_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_credit_ledger_student_created
  ON review_credit_ledger (student_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_review_credit_ledger_activity
  ON review_credit_ledger (activity_id);

-- Multiple supplemental prompts grouped under one mentor-assigned activity (1 credit).
CREATE TABLE IF NOT EXISTS activity_essay_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES mentor_assigned_activities(id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  optional_word_limit INTEGER,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_essay_prompts_activity_order
  ON activity_essay_prompts (activity_id, display_order);

CREATE TABLE IF NOT EXISTS activity_prompt_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID NOT NULL REFERENCES activity_essay_prompts(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES mentor_assigned_activities(id) ON DELETE CASCADE,
  student_user_id UUID NOT NULL,
  response_text TEXT NOT NULL DEFAULT '',
  submission_status VARCHAR(32) NOT NULL DEFAULT 'draft',
  saved_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (prompt_id, student_user_id)
);

CREATE INDEX IF NOT EXISTS idx_activity_prompt_responses_activity
  ON activity_prompt_responses (activity_id, student_user_id);
