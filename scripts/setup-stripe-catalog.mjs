import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Stripe from "stripe";
import dotenv from "dotenv";
import { STRIPE_API_VERSION } from "../server/billingConfig.js";
import { getPricingPlans } from "../src/lib/plans.js";

dotenv.config();

const WRITE_ENV = process.argv.includes("--write-env");
const ENV_PATH = path.resolve(process.cwd(), ".env");
const CURRENCY = process.env.STRIPE_CURRENCY || "usd";

function centsFromPriceLabel(price) {
  const numeric = Number(String(price).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(numeric)) throw new Error(`Could not parse plan price: ${price}`);
  return Math.round(numeric * 100);
}

function envKeyForPlan(planId) {
  return `STRIPE_PRICE_ID_${planId.toUpperCase()}`;
}

function lookupKeyForPlan(planId) {
  return `prelude_${planId}_monthly`;
}

function upsertEnvValues(values) {
  let text = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  const next = { BILLING_PROVIDER: "stripe", ...values };

  for (const [key, value] of Object.entries(next)) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    text = pattern.test(text) ? text.replace(pattern, line) : `${text.replace(/\s*$/, "")}\n${line}\n`;
  }

  fs.writeFileSync(ENV_PATH, text);
}

async function findOrCreateProduct(stripe, plan) {
  const products = await stripe.products.list({ active: true, limit: 100 });
  const existing = products.data.find((product) => product.metadata?.preludePlanId === plan.id);
  if (existing) return existing;

  return stripe.products.create({
    name: `Prelude ${plan.name}`,
    description: plan.description || plan.tagline,
    metadata: {
      preludePlanId: plan.id
    }
  });
}

async function findOrCreatePrice(stripe, product, plan) {
  const lookupKey = lookupKeyForPlan(plan.id);
  const prices = await stripe.prices.list({ active: true, lookup_keys: [lookupKey], limit: 1 });
  if (prices.data[0]) return prices.data[0];

  return stripe.prices.create({
    product: product.id,
    unit_amount: centsFromPriceLabel(plan.price),
    currency: CURRENCY,
    recurring: { interval: "month" },
    lookup_key: lookupKey,
    metadata: {
      preludePlanId: plan.id
    }
  });
}

async function main() {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    console.error("STRIPE_SECRET_KEY is not set. Add a test or live Stripe secret/restricted key to .env first.");
    process.exit(1);
  }
  if (!/^(sk|rk)_(test|live)_/.test(apiKey)) {
    console.error("STRIPE_SECRET_KEY must start with sk_test_, sk_live_, rk_test_, or rk_live_.");
    process.exit(1);
  }

  const stripe = new Stripe(apiKey, {
    apiVersion: STRIPE_API_VERSION,
    appInfo: { name: "Prelude", version: "1.0.0" },
    maxNetworkRetries: 2
  });

  const account = await stripe.accounts.retrieve();
  console.log(`Connected to Stripe account: ${account.id}${account.settings?.dashboard?.display_name ? ` (${account.settings.dashboard.display_name})` : ""}`);

  const envValues = {};
  for (const plan of getPricingPlans()) {
    const product = await findOrCreateProduct(stripe, plan);
    const price = await findOrCreatePrice(stripe, product, plan);
    envValues[envKeyForPlan(plan.id)] = price.id;
    console.log(`${plan.name}: product ${product.id}, monthly price ${price.id} (${lookupKeyForPlan(plan.id)})`);
  }

  console.log("\nAdd these values to .env:");
  console.log("BILLING_PROVIDER=stripe");
  for (const [key, value] of Object.entries(envValues)) {
    console.log(`${key}=${value}`);
  }

  if (WRITE_ENV) {
    upsertEnvValues(envValues);
    console.log(`\nUpdated ${ENV_PATH} with billing provider and Stripe price IDs.`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
