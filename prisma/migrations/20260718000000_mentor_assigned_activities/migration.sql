CREATE TYPE "mentor_activity_type" AS ENUM (
  'PERSONAL_STATEMENT', 'SUPPLEMENTAL_ESSAY', 'ADDITIONAL_ESSAY',
  'ACTIVITIES_LIST', 'RESUME', 'CUSTOM_ACTIVITY'
);
CREATE TYPE "mentor_activity_status" AS ENUM (
  'NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'NEEDS_REVISION', 'COMPLETED'
);
CREATE TYPE "activity_submission_method" AS ENUM ('DOCUMENT_LINK', 'FILE_UPLOAD');
CREATE TYPE "allowed_submission_method" AS ENUM ('DOCUMENT_LINK', 'FILE_UPLOAD', 'EITHER');

CREATE TABLE "mentor_assigned_activities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "mentor_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "activity_type" "mentor_activity_type" NOT NULL,
  "college_name" VARCHAR(180),
  "essay_prompt" TEXT,
  "word_limit" INTEGER,
  "instructions" TEXT,
  "due_date" TIMESTAMPTZ(6),
  "allowed_submission_method" "allowed_submission_method" NOT NULL DEFAULT 'EITHER',
  "status" "mentor_activity_status" NOT NULL DEFAULT 'NOT_STARTED',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(6),
  CONSTRAINT "mentor_assigned_activities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mentor_assigned_activities_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "mentor_assigned_activities_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "mentor_assigned_activities_word_limit_check" CHECK ("word_limit" IS NULL OR "word_limit" > 0)
);

CREATE TABLE "activity_submissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "activity_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "submission_method" "activity_submission_method" NOT NULL,
  "document_url" VARCHAR(2048),
  "storage_path" TEXT,
  "original_file_name" VARCHAR(255),
  "file_mime_type" VARCHAR(120),
  "file_size" INTEGER,
  "is_draft" BOOLEAN NOT NULL DEFAULT true,
  "idempotency_key" VARCHAR(120),
  "submitted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activity_submissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "activity_submissions_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "mentor_assigned_activities"("id") ON DELETE CASCADE,
  CONSTRAINT "activity_submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "activity_submissions_payload_check" CHECK (
    ("submission_method" = 'DOCUMENT_LINK' AND "document_url" IS NOT NULL AND "storage_path" IS NULL)
    OR ("submission_method" = 'FILE_UPLOAD' AND "storage_path" IS NOT NULL AND "document_url" IS NULL)
  )
);

CREATE TABLE "activity_feedback" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "activity_id" UUID NOT NULL,
  "submission_id" UUID,
  "mentor_id" UUID NOT NULL,
  "feedback_text" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activity_feedback_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "activity_feedback_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "mentor_assigned_activities"("id") ON DELETE CASCADE,
  CONSTRAINT "activity_feedback_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "activity_submissions"("id") ON DELETE SET NULL,
  CONSTRAINT "activity_feedback_mentor_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "activity_feedback_text_check" CHECK (length(trim("feedback_text")) > 0)
);

CREATE UNIQUE INDEX "activity_submissions_idempotency_key_key" ON "activity_submissions"("idempotency_key");
CREATE UNIQUE INDEX "activity_submissions_one_draft_idx" ON "activity_submissions"("activity_id", "student_id") WHERE "is_draft" = true;
CREATE INDEX "idx_mentor_activities_student_status_due" ON "mentor_assigned_activities"("student_id", "status", "due_date");
CREATE INDEX "idx_mentor_activities_mentor_status_created" ON "mentor_assigned_activities"("mentor_id", "status", "created_at");
CREATE INDEX "idx_activity_submissions_activity_created" ON "activity_submissions"("activity_id", "created_at");
CREATE INDEX "idx_activity_submissions_student_draft" ON "activity_submissions"("student_id", "is_draft", "updated_at");
CREATE INDEX "idx_activity_feedback_activity_created" ON "activity_feedback"("activity_id", "created_at");
CREATE INDEX "idx_activity_feedback_submission" ON "activity_feedback"("submission_id");
