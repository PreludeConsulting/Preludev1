-- Stores each authenticated user's current PreludeMatch Questionnaire submission.
-- Uses the existing free/open-source PostgreSQL + Prisma stack; no paid add-on required.
CREATE TABLE "prelude_match_questionnaires" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "student_profile_id" UUID REFERENCES "student_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "answers" JSONB NOT NULL,
  "completion_percent" INTEGER NOT NULL DEFAULT 0,
  "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "uq_prelude_match_questionnaires_user" UNIQUE ("user_id"),
  CONSTRAINT "ck_prelude_match_completion_percent" CHECK ("completion_percent" >= 0 AND "completion_percent" <= 100),
  CONSTRAINT "ck_prelude_match_answers_array" CHECK (jsonb_typeof("answers") = 'array')
);

CREATE INDEX "idx_prelude_match_student_submitted" ON "prelude_match_questionnaires"("student_profile_id", "submitted_at");
CREATE INDEX "idx_prelude_match_submitted_at" ON "prelude_match_questionnaires"("submitted_at");
CREATE INDEX "idx_prelude_match_answers" ON "prelude_match_questionnaires" USING GIN ("answers");
