-- Prelude admissions platform authentication and account-management schema.
-- PostgreSQL 14+; free OSS stack with Prisma. All secrets/tokens are stored hashed only.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

CREATE TYPE "user_role" AS ENUM ('STUDENT', 'MENTOR', 'COUNSELOR', 'ADMIN');
CREATE TYPE "account_status" AS ENUM ('ACTIVE', 'LOCKED', 'SUSPENDED', 'DELETED');
CREATE TYPE "token_status" AS ENUM ('ACTIVE', 'USED', 'REVOKED', 'EXPIRED');
CREATE TYPE "session_status" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');
CREATE TYPE "application_status" AS ENUM ('RESEARCHING', 'APPLYING', 'SUBMITTED', 'ACCEPTED', 'WAITLISTED', 'REJECTED');
CREATE TYPE "essay_status" AS ENUM ('DRAFT', 'IN_REVIEW', 'REVISED', 'FINAL');
CREATE TYPE "message_status" AS ENUM ('SENT', 'READ', 'ARCHIVED');
CREATE TYPE "notification_status" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');
CREATE TYPE "security_event_severity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TABLE "users" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "first_name" VARCHAR(80) NOT NULL,
  "last_name" VARCHAR(80) NOT NULL,
  "email" CITEXT NOT NULL UNIQUE,
  "password_hash" VARCHAR(255) NOT NULL,
  "role" "user_role" NOT NULL,
  "status" "account_status" NOT NULL DEFAULT 'ACTIVE',
  "email_verified" BOOLEAN NOT NULL DEFAULT false,
  "email_verified_at" TIMESTAMPTZ(6),
  "terms_accepted_at" TIMESTAMPTZ(6) NOT NULL,
  "failed_login_count" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TIMESTAMPTZ(6),
  "last_login_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6)
);

CREATE TABLE "organizations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(180) NOT NULL,
  "slug" VARCHAR(180) NOT NULL UNIQUE,
  "domain" VARCHAR(180),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "student_profiles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "organization_id" UUID REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "graduation_year" INTEGER,
  "high_school" VARCHAR(180),
  "location" VARCHAR(160),
  "target_majors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "gpa" DECIMAL(4,2),
  "test_scores" JSONB NOT NULL DEFAULT '{}',
  "progress" JSONB NOT NULL DEFAULT '{}',
  "preferences" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "mentor_profiles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "college" VARCHAR(180),
  "major" VARCHAR(180),
  "bio" TEXT,
  "specialties" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "hourly_availability" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "counselor_profiles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "title" VARCHAR(120),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "mentor_assignments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "mentor_profile_id" UUID NOT NULL REFERENCES "mentor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "student_profile_id" UUID NOT NULL REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ended_at" TIMESTAMPTZ(6),
  "notes" TEXT,
  CONSTRAINT "uq_mentor_assignments_mentor_student" UNIQUE ("mentor_profile_id", "student_profile_id")
);

CREATE TABLE "sessions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "session_token_hash" VARCHAR(255) NOT NULL UNIQUE,
  "status" "session_status" NOT NULL DEFAULT 'ACTIVE',
  "device" VARCHAR(160),
  "browser" VARCHAR(160),
  "ip_address" INET,
  "user_agent" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMPTZ(6),
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "revoked_at" TIMESTAMPTZ(6)
);

CREATE TABLE "refresh_tokens" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "session_id" UUID NOT NULL REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "token_hash" VARCHAR(255) NOT NULL UNIQUE,
  "status" "token_status" NOT NULL DEFAULT 'ACTIVE',
  "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "revoked_at" TIMESTAMPTZ(6),
  "replaced_by_token_id" UUID REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "ip_address" INET,
  "user_agent" TEXT
);

CREATE TABLE "password_reset_tokens" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "token_hash" VARCHAR(255) NOT NULL UNIQUE,
  "status" "token_status" NOT NULL DEFAULT 'ACTIVE',
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "used_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "request_ip" INET,
  "user_agent" TEXT
);

CREATE TABLE "email_verification_tokens" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "token_hash" VARCHAR(255) NOT NULL UNIQUE,
  "status" "token_status" NOT NULL DEFAULT 'ACTIVE',
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "used_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "login_history" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "email_attempted" CITEXT,
  "success" BOOLEAN NOT NULL,
  "failure_reason" VARCHAR(160),
  "device" VARCHAR(160),
  "browser" VARCHAR(160),
  "ip_address" INET,
  "user_agent" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "security_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "event_type" VARCHAR(100) NOT NULL,
  "severity" "security_event_severity" NOT NULL DEFAULT 'INFO',
  "ip_address" INET,
  "user_agent" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "rate_limit_buckets" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" VARCHAR(255) NOT NULL,
  "route" VARCHAR(255) NOT NULL,
  "window_start" TIMESTAMPTZ(6) NOT NULL,
  "window_seconds" INTEGER NOT NULL,
  "request_count" INTEGER NOT NULL DEFAULT 0,
  "blocked_until" TIMESTAMPTZ(6),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "uq_rate_limit_buckets_key_route_window" UNIQUE ("key", "route", "window_start")
);

CREATE TABLE "notifications" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "title" VARCHAR(160) NOT NULL,
  "body" TEXT NOT NULL,
  "status" "notification_status" NOT NULL DEFAULT 'UNREAD',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "read_at" TIMESTAMPTZ(6)
);

CREATE TABLE "messages" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "sender_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "recipient_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "subject" VARCHAR(180),
  "body" TEXT NOT NULL,
  "status" "message_status" NOT NULL DEFAULT 'SENT',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "read_at" TIMESTAMPTZ(6)
);

CREATE TABLE "college_applications" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "student_profile_id" UUID NOT NULL REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "college_name" VARCHAR(180) NOT NULL,
  "deadline" DATE,
  "status" "application_status" NOT NULL DEFAULT 'RESEARCHING',
  "application_round" VARCHAR(80),
  "portal_url" VARCHAR(2048),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "essays" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "student_profile_id" UUID NOT NULL REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "college_application_id" UUID REFERENCES "college_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "title" VARCHAR(180) NOT NULL,
  "prompt" TEXT,
  "content" TEXT NOT NULL DEFAULT '',
  "status" "essay_status" NOT NULL DEFAULT 'DRAFT',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "activity_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "actor_user_id" UUID REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "action" VARCHAR(120) NOT NULL,
  "entity_type" VARCHAR(120) NOT NULL,
  "entity_id" UUID,
  "ip_address" INET,
  "user_agent" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_users_role_status" ON "users"("role", "status");
CREATE INDEX "idx_users_verified_status" ON "users"("email_verified", "status");
CREATE INDEX "idx_users_locked_until" ON "users"("locked_until");
CREATE INDEX "idx_organizations_name" ON "organizations"("name");
CREATE INDEX "idx_student_profiles_org" ON "student_profiles"("organization_id");
CREATE INDEX "idx_student_profiles_grad_year" ON "student_profiles"("graduation_year");
CREATE INDEX "idx_mentor_profiles_college" ON "mentor_profiles"("college");
CREATE INDEX "idx_counselor_profiles_org" ON "counselor_profiles"("organization_id");
CREATE INDEX "idx_mentor_assignments_student_active" ON "mentor_assignments"("student_profile_id", "active");
CREATE INDEX "idx_mentor_assignments_mentor_active" ON "mentor_assignments"("mentor_profile_id", "active");
CREATE INDEX "idx_sessions_user_status_expires" ON "sessions"("user_id", "status", "expires_at");
CREATE INDEX "idx_sessions_expires_at" ON "sessions"("expires_at");
CREATE INDEX "idx_refresh_tokens_user_status_expires" ON "refresh_tokens"("user_id", "status", "expires_at");
CREATE INDEX "idx_refresh_tokens_session_status" ON "refresh_tokens"("session_id", "status");
CREATE INDEX "idx_password_reset_tokens_user_status_expires" ON "password_reset_tokens"("user_id", "status", "expires_at");
CREATE INDEX "idx_email_verification_tokens_user_status_expires" ON "email_verification_tokens"("user_id", "status", "expires_at");
CREATE INDEX "idx_login_history_user_created" ON "login_history"("user_id", "created_at");
CREATE INDEX "idx_login_history_email_created" ON "login_history"("email_attempted", "created_at");
CREATE INDEX "idx_login_history_ip_created" ON "login_history"("ip_address", "created_at");
CREATE INDEX "idx_security_events_user_created" ON "security_events"("user_id", "created_at");
CREATE INDEX "idx_security_events_type_created" ON "security_events"("event_type", "created_at");
CREATE INDEX "idx_security_events_severity_created" ON "security_events"("severity", "created_at");
CREATE INDEX "idx_rate_limit_buckets_blocked_until" ON "rate_limit_buckets"("blocked_until");
CREATE INDEX "idx_notifications_user_status_created" ON "notifications"("user_id", "status", "created_at");
CREATE INDEX "idx_messages_sender_created" ON "messages"("sender_id", "created_at");
CREATE INDEX "idx_messages_recipient_status_created" ON "messages"("recipient_id", "status", "created_at");
CREATE INDEX "idx_college_applications_student_status" ON "college_applications"("student_profile_id", "status");
CREATE INDEX "idx_college_applications_deadline" ON "college_applications"("deadline");
CREATE INDEX "idx_essays_student_status" ON "essays"("student_profile_id", "status");
CREATE INDEX "idx_essays_application" ON "essays"("college_application_id");
CREATE INDEX "idx_activity_logs_actor_created" ON "activity_logs"("actor_user_id", "created_at");
CREATE INDEX "idx_activity_logs_entity_created" ON "activity_logs"("entity_type", "entity_id", "created_at");
CREATE INDEX "idx_activity_logs_action_created" ON "activity_logs"("action", "created_at");
CREATE INDEX "idx_security_events_metadata" ON "security_events" USING GIN ("metadata");
CREATE INDEX "idx_student_profiles_progress" ON "student_profiles" USING GIN ("progress");
CREATE INDEX "idx_college_applications_metadata" ON "college_applications" USING GIN ("metadata");
