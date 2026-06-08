-- Stripe-ready billing scaffold. Basic is the default plan tier for new accounts.
CREATE TYPE "subscription_plan" AS ENUM ('BASIC', 'PLUS', 'PRO');

ALTER TABLE "users"
  ADD COLUMN "plan" "subscription_plan" NOT NULL DEFAULT 'BASIC',
  ADD COLUMN "stripe_customer_id" VARCHAR(255),
  ADD COLUMN "stripe_subscription_id" VARCHAR(255),
  ADD COLUMN "subscription_status" VARCHAR(40),
  ADD COLUMN "subscription_current_period_end" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX "users_stripe_customer_id_key" ON "users"("stripe_customer_id");
CREATE UNIQUE INDEX "users_stripe_subscription_id_key" ON "users"("stripe_subscription_id");
CREATE INDEX "idx_users_plan_status" ON "users"("plan", "status");
CREATE INDEX "idx_users_subscription_status" ON "users"("subscription_status");
CREATE INDEX "idx_users_subscription_period_end" ON "users"("subscription_current_period_end");

CREATE TABLE "stripe_webhook_events" (
  "id" VARCHAR(255) PRIMARY KEY,
  "event_type" VARCHAR(120) NOT NULL,
  "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payload" JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX "idx_stripe_webhook_events_type_processed" ON "stripe_webhook_events"("event_type", "processed_at");
