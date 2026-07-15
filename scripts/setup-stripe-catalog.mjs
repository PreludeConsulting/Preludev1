import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Stripe from "stripe";
import dotenv from "dotenv";
import { STRIPE_API_VERSION } from "../server/billingConfig.js";
import { listStripeCatalogOfferings } from "../shared/billingCatalog.js";
import { getPlan } from "../src/lib/plans.js";

dotenv.config();

const LIVE_MODE = process.argv.includes("--live");
const WRITE_ENV = process.argv.includes("--write-env");
const DRY_RUN = process.argv.includes("--dry-run");
const ENV_PATH = path.resolve(process.cwd(), ".env");
const CURRENCY = "usd";

if (LIVE_MODE && process.argv.includes("--test")) {
  throw new Error("Choose exactly one Stripe mode: --test or --live.");
}
if (DRY_RUN && WRITE_ENV) {
  throw new Error("--dry-run cannot be combined with --write-env.");
}

function keyMode(apiKey) {
  const match = /^(?:sk|rk)_(test|live)_/.exec(apiKey || "");
  return match?.[1] || null;
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

async function listAll(listPage) {
  const rows = [];
  let startingAfter;
  do {
    const page = await listPage(startingAfter);
    rows.push(...page.data);
    startingAfter = page.has_more ? page.data.at(-1)?.id : null;
  } while (startingAfter);
  return rows;
}

function productDescription(offering) {
  if (offering.kind === "subscription") {
    const plan = getPlan(offering.id);
    return plan.description || plan.tagline;
  }
  return offering.description;
}

async function findOrCreateProduct(stripe, offering, products) {
  const existing = products.find((product) =>
    product.metadata?.preludeOfferingId === offering.id ||
    product.metadata?.preludePlanId === offering.id ||
    product.name === offering.name
  );

  if (existing) {
    if (!DRY_RUN && (!existing.active || existing.metadata?.preludeOfferingId !== offering.id)) {
      const updated = await stripe.products.update(existing.id, {
        active: true,
        metadata: { preludeOfferingId: offering.id }
      });
      Object.assign(existing, updated);
    }
    return existing;
  }

  if (DRY_RUN) return null;
  const product = await stripe.products.create({
    name: offering.name,
    description: productDescription(offering),
    metadata: { preludeOfferingId: offering.id }
  });
  products.push(product);
  return product;
}

function priceMatches(price, offering, priceSpec) {
  const cadenceMatches = offering.kind === "subscription"
    ? price.type === "recurring" && price.recurring?.interval === "month" && price.recurring?.interval_count === 1
    : price.type === "one_time" && !price.recurring;
  return price.unit_amount === priceSpec.unitAmount &&
    price.currency === CURRENCY &&
    cadenceMatches;
}

async function findOrCreatePrice(stripe, product, offering, priceSpec) {
  if (!product) return null;
  const prices = await listAll((startingAfter) => stripe.prices.list({
    product: product.id,
    limit: 100,
    ...(startingAfter ? { starting_after: startingAfter } : {})
  }));
  const existing = prices.find((price) => priceMatches(price, offering, priceSpec));
  if (existing) {
    if (!existing.active && !DRY_RUN) {
      return stripe.prices.update(existing.id, { active: true });
    }
    return existing;
  }

  if (DRY_RUN) return null;
  return stripe.prices.create({
    product: product.id,
    unit_amount: priceSpec.unitAmount,
    currency: CURRENCY,
    ...(offering.kind === "subscription" ? { recurring: { interval: "month" } } : {}),
    lookup_key: priceSpec.lookupKey,
    metadata: {
      preludeOfferingId: offering.id,
      ...(priceSpec.quantity == null ? {} : { preludeQuantity: String(priceSpec.quantity) }),
      preludePriceCents: String(priceSpec.unitAmount)
    }
  });
}

async function main() {
  const requestedMode = LIVE_MODE ? "live" : "test";
  const modeSpecificKey = LIVE_MODE
    ? process.env.STRIPE_LIVE_SECRET_KEY
    : process.env.STRIPE_TEST_SECRET_KEY;
  const apiKey = modeSpecificKey || process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error(`No ${requestedMode}-mode Stripe key is set. Configure STRIPE_${requestedMode.toUpperCase()}_SECRET_KEY or a matching STRIPE_SECRET_KEY.`);
  }
  const actualMode = keyMode(apiKey);
  if (!actualMode) {
    throw new Error("STRIPE_SECRET_KEY must start with sk_test_, sk_live_, rk_test_, or rk_live_.");
  }
  if (actualMode !== requestedMode) {
    throw new Error(`Refusing to use a ${actualMode}-mode key for --${requestedMode}.`);
  }

  const stripe = new Stripe(apiKey, {
    apiVersion: STRIPE_API_VERSION,
    appInfo: { name: "Prelude", version: "1.0.0" },
    maxNetworkRetries: 2
  });
  console.log(`Stripe mode: ${requestedMode}`);
  if (DRY_RUN) console.log("Dry run: missing Products and Prices will be reported, not created.");

  const products = await listAll((startingAfter) => stripe.products.list({
    limit: 100,
    ...(startingAfter ? { starting_after: startingAfter } : {})
  }));
  const envValues = {};

  for (const offering of listStripeCatalogOfferings()) {
    const product = await findOrCreateProduct(stripe, offering, products);
    console.log(`\n${offering.name}: product ${product?.id || "MISSING"}`);
    for (const priceSpec of offering.prices) {
      const price = await findOrCreatePrice(stripe, product, offering, priceSpec);
      const label = priceSpec.quantity == null ? "monthly" : `${priceSpec.quantity} one-time`;
      console.log(`  ${label}: ${price?.id || "MISSING"} ($${(priceSpec.unitAmount / 100).toFixed(2)} USD)`);
      if (price) envValues[priceSpec.envKey] = price.id;
    }
  }

  console.log("\nEnvironment values:");
  console.log("BILLING_PROVIDER=stripe");
  for (const [key, value] of Object.entries(envValues)) console.log(`${key}=${value}`);
  console.log("\nOutdated Prices were left active; confirm no deployment references them before archiving in Stripe.");

  if (WRITE_ENV) {
    upsertEnvValues(envValues);
    console.log(`Updated ${ENV_PATH} with Price IDs only. Existing Stripe secrets were not changed.`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
