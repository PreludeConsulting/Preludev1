-- DropIndex
DROP INDEX "idx_college_applications_metadata";

-- DropIndex
DROP INDEX "idx_prelude_match_answers";

-- DropIndex
DROP INDEX "idx_security_events_metadata";

-- DropIndex
DROP INDEX "idx_student_profiles_progress";

-- AlterTable
ALTER TABLE "college_applications" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "counselor_profiles" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "essays" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "mentor_profiles" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "prelude_match_questionnaires" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "rate_limit_buckets" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "student_profiles" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "updated_at" DROP DEFAULT;

-- RenameIndex
ALTER INDEX "uq_prelude_match_questionnaires_user" RENAME TO "prelude_match_questionnaires_user_id_key";
