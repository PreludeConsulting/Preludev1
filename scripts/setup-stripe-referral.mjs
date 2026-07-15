import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Stripe from "stripe";
import dotenv from "dotenv";
import { STRIPE_API_VERSION } from "../server/billingConfig.js";

dotenv.config();

const LIVE_MODE = process.argv.includes("--live");
const WRITE_ENV = process.argv.includes("--write-env");
const ENV_PATH = path.resolve(process.cwd(), ".env");
const DEFAULT_COUPON_ID = "prelude_referral_20_once";
const COUPON_NAME = "Prelude referral 20% (one month)";

if (LIVE_MODE && process.argv.includes("--test")) {
  throw new Error("Choose exactly one Stripe mode: --test or --live.");
}

function keyMode(apiKey) {
  const match = /^(?:sk|rk)_(test|live)_/.exec(apiKey || "");
  return match?.[1] || null;
}

function upsertEnvValue(key, value) {
  let text = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  text = pattern.test(text) ? text.replace(pattern, line) : `${text.replace(/\s*$/, "")}\n${line}\n`;
  fs.writeFileSync(ENV_PATH, text);
}

function stripeKey() {
  const requestedMode = LIVE_MODE ? "live" : "test";
  const modeSpecificKey = LIVE_MODE
    ? process.env.STRIPE_LIVE_SECRET_KEY
    : process.env.STRIPE_TEST_SECRET_KEY;
  const apiKey = modeSpecificKey || process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error(`No ${requestedMode}-mode Stripe key is configured.`);
  }
  const actualMode = keyMode(apiKey);
  if (!actualMode) {
    throw new Error("Stripe keys must start with sk_test_, sk_live_, rk_test_, or rk_live_.");
  }
  if (actualMode !== requestedMode) {
    throw new Error(`Refusing to use a ${actualMode}-mode key for --${requestedMode}.`);
  }
  return { apiKey, requestedMode };
}

function validateCoupon(coupon, couponId) {
  if (coupon.deleted) {
    throw new Error(`Coupon ${couponId} was deleted and cannot be reused.`);
  }
  if (coupon.percent_off !== 20 || coupon.duration !== "once") {
    throw new Error(
      `Coupon ${couponId} exists with incompatible terms. Expected 20% off with duration=once.`
    );
  }
}

async function findOrCreateCoupon(stripe, couponId) {
  try {
    const coupon = await stripe.coupons.retrieve(couponId);
    validateCoupon(coupon, couponId);
    if (coupon.name !== COUPON_NAME || coupon.metadata?.preludeReferral !== "true") {
      return stripe.coupons.update(couponId, {
        name: COUPON_NAME,
        metadata: { preludeReferral: "true" }
      });
    }
    return coupon;
  } catch (error) {
    if (error?.code !== "resource_missing") throw error;
    return stripe.coupons.create({
      id: couponId,
      name: COUPON_NAME,
      percent_off: 20,
      duration: "once",
      metadata: { preludeReferral: "true" }
    });
  }
}

async function main() {
  const { apiKey, requestedMode } = stripeKey();
  const couponId = String(process.env.STRIPE_REFERRAL_COUPON_ID || DEFAULT_COUPON_ID).trim();
  const stripe = new Stripe(apiKey, {
    apiVersion: STRIPE_API_VERSION,
    appInfo: { name: "Prelude", version: "1.0.0" },
    maxNetworkRetries: 2
  });

  const coupon = await findOrCreateCoupon(stripe, couponId);
  validateCoupon(coupon, couponId);

  console.log(`Stripe mode: ${requestedMode}`);
  console.log(`Referral coupon: ${coupon.id} (20% off, once)`);
  console.log(`STRIPE_REFERRAL_COUPON_ID=${coupon.id}`);

  if (WRITE_ENV) {
    upsertEnvValue("STRIPE_REFERRAL_COUPON_ID", coupon.id);
    console.log(`Updated ${ENV_PATH} with the non-secret coupon ID.`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
