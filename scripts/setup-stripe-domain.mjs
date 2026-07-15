import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Stripe from "stripe";
import dotenv from "dotenv";
import { STRIPE_API_VERSION } from "../server/billingConfig.js";

dotenv.config();

const LIVE_MODE = process.argv.includes("--live");
const WRITE_ENV = process.argv.includes("--write-env");
const ROTATE_WEBHOOK_SECRET = process.argv.includes("--rotate-webhook-secret");
const ENV_PATH = path.resolve(process.cwd(), ".env");
const DEFAULT_ORIGIN = "https://preludeconsultingllc.com";
const WEBHOOK_EVENTS = [
  "charge.dispute.created",
  "charge.refunded",
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
  "invoice.voided"
];

if (LIVE_MODE && process.argv.includes("--test")) {
  throw new Error("Choose exactly one Stripe mode: --test or --live.");
}

function getDomainArg() {
  const positional = process.argv.find((arg, index) => index > 1 && !arg.startsWith("--"));
  return positional || process.env.STRIPE_PUBLIC_DOMAIN || process.env.PUBLIC_APP_URL || DEFAULT_ORIGIN;
}

function normalizeOrigin(value) {
  const raw = String(value || "").trim().replace(/\/+$/, "");
  if (!raw) return DEFAULT_ORIGIN;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(withProtocol);
  return `${url.protocol}//${url.host}`;
}

function domainName(origin) {
  return new URL(origin).host;
}

function upsertEnvValues(values) {
  let text = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";

  for (const [key, value] of Object.entries(values)) {
    if (!value) continue;
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    text = pattern.test(text) ? text.replace(pattern, line) : `${text.replace(/\s*$/, "")}\n${line}\n`;
  }

  fs.writeFileSync(ENV_PATH, text);
}

function keyMode(apiKey) {
  const match = /^(?:sk|rk)_(test|live)_/.exec(apiKey || "");
  return match?.[1] || null;
}

function stripeKey() {
  const requestedMode = LIVE_MODE ? "live" : "test";
  const modeSpecificKey = LIVE_MODE
    ? process.env.STRIPE_LIVE_SECRET_KEY
    : process.env.STRIPE_TEST_SECRET_KEY;
  const apiKey = modeSpecificKey || process.env.STRIPE_SECRET_KEY;
  if (!apiKey) throw new Error(`No ${requestedMode}-mode Stripe key is configured.`);
  const actualMode = keyMode(apiKey);
  if (!actualMode) {
    throw new Error("Stripe keys must start with sk_test_, sk_live_, rk_test_, or rk_live_.");
  }
  if (actualMode !== requestedMode) {
    throw new Error(`Refusing to use a ${actualMode}-mode key for --${requestedMode}.`);
  }
  return { apiKey, requestedMode };
}

async function upsertWebhookEndpoint(stripe, endpointUrl) {
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const existing = endpoints.data.find((endpoint) => endpoint.url === endpointUrl);

  if (existing) {
    if (ROTATE_WEBHOOK_SECRET) {
      await stripe.webhookEndpoints.update(existing.id, {
        disabled: true,
        metadata: {
          preludeReplacedBy: "setup-stripe-domain",
          preludeManaged: "true"
        }
      });
    } else {
      const endpoint = await stripe.webhookEndpoints.update(existing.id, {
        enabled_events: WEBHOOK_EVENTS,
        metadata: {
          preludeDomain: domainName(endpointUrl),
          preludeManaged: "true"
        }
      });
      return { endpoint, signingSecret: null, created: false };
    }
  }

  const endpoint = await stripe.webhookEndpoints.create({
    url: endpointUrl,
    enabled_events: WEBHOOK_EVENTS,
    description: "Prelude production billing webhook",
    metadata: {
      preludeDomain: domainName(endpointUrl),
      preludeManaged: "true"
    }
  });

  return { endpoint, signingSecret: endpoint.secret || null, created: true };
}

async function upsertPaymentMethodDomain(stripe, origin) {
  if (!stripe.paymentMethodDomains) return null;

  const name = domainName(origin);
  const domains = await stripe.paymentMethodDomains.list({ domain_name: name, limit: 100 });
  const existing = domains.data.find((domain) => domain.domain_name === name);
  if (existing) {
    return await stripe.paymentMethodDomains.update(existing.id, { enabled: true });
  }
  return await stripe.paymentMethodDomains.create({ domain_name: name });
}

async function main() {
  const origin = normalizeOrigin(getDomainArg());
  const endpointUrl = `${origin}/api/billing/webhook`;
  const { apiKey, requestedMode } = stripeKey();
  const stripe = new Stripe(apiKey, {
    apiVersion: STRIPE_API_VERSION,
    appInfo: { name: "Prelude", version: "1.0.0" },
    maxNetworkRetries: 2
  });

  console.log(`Stripe mode: ${requestedMode}`);
  console.log(`Using domain: ${origin}`);

  const { endpoint, signingSecret, created } = await upsertWebhookEndpoint(stripe, endpointUrl);
  console.log(`${created ? "Created" : "Updated"} webhook endpoint: ${endpoint.id} -> ${endpoint.url}`);
  console.log(`Webhook events: ${WEBHOOK_EVENTS.join(", ")}`);

  const paymentMethodDomain = await upsertPaymentMethodDomain(stripe, origin);
  if (paymentMethodDomain) {
    console.log(`Payment method domain: ${paymentMethodDomain.id} (${paymentMethodDomain.domain_name}, enabled: ${paymentMethodDomain.enabled})`);
  } else {
    console.log("Payment method domain API is not available in this Stripe SDK.");
  }

  console.log("\nSet these environment values in your deployed app:");
  console.log(`PUBLIC_APP_URL=${origin}`);
  console.log(`VITE_PUBLIC_APP_URL=${origin}`);
  if (signingSecret) {
    console.log("STRIPE_WEBHOOK_SECRET=<new signing secret printed in this run>");
  } else {
    console.log("STRIPE_WEBHOOK_SECRET=<existing endpoint secret from Stripe Dashboard>");
  }

  if (WRITE_ENV) {
    const webhookSecretKey = LIVE_MODE ? "STRIPE_LIVE_WEBHOOK_SECRET" : "STRIPE_WEBHOOK_SECRET";
    upsertEnvValues({
      PUBLIC_APP_URL: origin,
      VITE_PUBLIC_APP_URL: origin,
      ...(signingSecret ? { [webhookSecretKey]: signingSecret } : {})
    });
    console.log(`\nUpdated ${ENV_PATH} with the domain settings${signingSecret ? ` and ${webhookSecretKey}` : ""}.`);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
