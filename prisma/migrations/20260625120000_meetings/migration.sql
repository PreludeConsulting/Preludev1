-- CreateTable
CREATE TABLE "meetings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(180) NOT NULL,
    "student_user_id" UUID,
    "mentor_user_id" UUID,
    "student_slug" VARCHAR(80),
    "mentor_slug" VARCHAR(80),
    "meeting_type" VARCHAR(20) NOT NULL DEFAULT 'zoom',
    "start_time" TIMESTAMPTZ(6) NOT NULL,
    "end_time" TIMESTAMPTZ(6) NOT NULL,
    "time_zone" VARCHAR(64) NOT NULL DEFAULT 'America/New_York',
    "zoom_meeting_id" VARCHAR(64),
    "zoom_join_url" VARCHAR(2048),
    "zoom_host_url" VARCHAR(2048),
    "zoom_password" VARCHAR(64),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "notes" TEXT NOT NULL DEFAULT '',
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "idempotency_key" VARCHAR(128),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meetings_idempotency_key_key" ON "meetings"("idempotency_key");

-- CreateIndex
CREATE INDEX "idx_meetings_student_user_status" ON "meetings"("student_user_id", "status");

-- CreateIndex
CREATE INDEX "idx_meetings_mentor_user_status" ON "meetings"("mentor_user_id", "status");
