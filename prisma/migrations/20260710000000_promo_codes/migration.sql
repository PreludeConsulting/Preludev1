-- CreateTable
CREATE TABLE "promo_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_code" VARCHAR(64) NOT NULL,
    "code_hash" VARCHAR(64) NOT NULL,
    "description" TEXT,
    "campaign_name" VARCHAR(120),
    "applicable_plan" VARCHAR(20) NOT NULL DEFAULT 'basic',
    "discount_type" VARCHAR(20) NOT NULL DEFAULT 'complimentary',
    "discount_value" DECIMAL(10,2),
    "starts_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "max_redemptions" INTEGER,
    "max_redemptions_per_user" INTEGER NOT NULL DEFAULT 1,
    "current_redemption_count" INTEGER NOT NULL DEFAULT 0,
    "single_use" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "eligible_email_domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "eligible_emails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "new_users_only" BOOLEAN NOT NULL DEFAULT true,
    "access_duration_days" INTEGER,
    "renewal_behavior" VARCHAR(40) NOT NULL DEFAULT 'requires_payment',
    "internal_notes" TEXT,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "promo_redemptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "promo_code_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "redeemed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "plan_id" VARCHAR(20) NOT NULL,
    "promotion_starts_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "promotion_ends_at" TIMESTAMPTZ(6),
    "payment_waived" BOOLEAN NOT NULL DEFAULT true,
    "campaign_name" VARCHAR(120),

    CONSTRAINT "promo_redemptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "promo_validation_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code_hash" VARCHAR(64),
    "email" CITEXT,
    "ip_hash" VARCHAR(64),
    "success" BOOLEAN NOT NULL,
    "error_code" VARCHAR(40),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_validation_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "promo_codes_code_hash_key" ON "promo_codes"("code_hash");
CREATE INDEX "idx_promo_codes_campaign" ON "promo_codes"("campaign_name");
CREATE INDEX "idx_promo_codes_active_expires" ON "promo_codes"("active", "expires_at");
CREATE UNIQUE INDEX "uq_promo_redemptions_code_user" ON "promo_redemptions"("promo_code_id", "user_id");
CREATE INDEX "idx_promo_redemptions_user_redeemed" ON "promo_redemptions"("user_id", "redeemed_at");
CREATE INDEX "idx_promo_redemptions_code_redeemed" ON "promo_redemptions"("promo_code_id", "redeemed_at");
CREATE INDEX "idx_promo_validation_attempts_created" ON "promo_validation_attempts"("created_at");

ALTER TABLE "promo_redemptions" ADD CONSTRAINT "promo_redemptions_promo_code_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
