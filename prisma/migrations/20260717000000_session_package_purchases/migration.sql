-- AlterTable
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "access_type" VARCHAR(32);
ALTER TABLE "meetings" ADD COLUMN IF NOT EXISTS "session_package_id" UUID;

-- CreateTable
CREATE TABLE IF NOT EXISTS "session_package_purchases" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "student_user_id" UUID NOT NULL,
    "mentor_user_id" UUID,
    "bundle_id" VARCHAR(64) NOT NULL DEFAULT 'flexible_sessions',
    "stripe_checkout_session_id" VARCHAR(255),
    "sessions_purchased" INTEGER NOT NULL,
    "sessions_remaining" INTEGER NOT NULL,
    "status" VARCHAR(32) NOT NULL DEFAULT 'active',
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "session_package_purchases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "session_package_purchases_stripe_checkout_session_id_key"
  ON "session_package_purchases"("stripe_checkout_session_id");

CREATE INDEX IF NOT EXISTS "idx_session_packages_student_status"
  ON "session_package_purchases"("student_user_id", "status");

CREATE INDEX IF NOT EXISTS "idx_session_packages_mentor_status"
  ON "session_package_purchases"("mentor_user_id", "status");

CREATE INDEX IF NOT EXISTS "idx_meetings_session_package"
  ON "meetings"("session_package_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'meetings_session_package_id_fkey'
  ) THEN
    ALTER TABLE "meetings"
      ADD CONSTRAINT "meetings_session_package_id_fkey"
      FOREIGN KEY ("session_package_id")
      REFERENCES "session_package_purchases"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;
