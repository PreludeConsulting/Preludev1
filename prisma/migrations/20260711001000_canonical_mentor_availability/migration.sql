-- Supabase-backed mentor availability is canonical on
-- mentor_matching_profiles.availability_schedule.
ALTER TABLE "mentor_profiles" DROP COLUMN IF EXISTS "hourly_availability";
