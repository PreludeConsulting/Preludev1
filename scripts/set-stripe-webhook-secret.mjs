import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(".env");
const text = fs.readFileSync(envPath, "utf8");

function readEnvValue(name) {
  const match = text.match(new RegExp(`^${name}=(.*)$`, "m"));
  return match?.[1]?.trim().replace(/^["']|["']$/g, "") || "";
}

const apiKey = readEnvValue("STRIPE_SECRET_KEY");
if (!apiKey) {
  throw new Error("STRIPE_SECRET_KEY is missing in .env");
}

const stripeCommand = process.platform === "win32" ? path.join(process.env.APPDATA || "", "npm", "stripe.cmd") : "stripe";
const result = spawnSync(stripeCommand, ["listen", "--print-secret", "--api-key", apiKey], {
  encoding: "utf8",
  env: { ...process.env, STRIPE_API_KEY: apiKey },
  shell: process.platform === "win32"
});

function redactStripeIdentifiers(value) {
  return value
    .replaceAll(apiKey, "[redacted]")
    .replace(/\b(?:sk|rk)_(?:test|live)_[A-Za-z0-9]+\b/g, "[redacted_stripe_key]")
    .replace(/\bacct_[A-Za-z0-9]+\b/g, "[redacted_account]");
}

if (result.error || result.status !== 0) {
  const rawMessage = result.error?.message || result.stderr || result.stdout || `Stripe CLI failed with status ${result.status}`;
  const message = redactStripeIdentifiers(rawMessage);
  throw new Error(message);
}

const signingSecret = result.stdout.trim();
if (!signingSecret.startsWith("whsec_")) {
  throw new Error("Stripe CLI did not return a webhook signing secret.");
}

const next = text.match(/^STRIPE_WEBHOOK_SECRET=.*$/m)
  ? text.replace(/^STRIPE_WEBHOOK_SECRET=.*$/m, `STRIPE_WEBHOOK_SECRET=${signingSecret}`)
  : text.replace(/\s*$/, `\nSTRIPE_WEBHOOK_SECRET=${signingSecret}\n`);

fs.writeFileSync(envPath, next);

console.log(
  JSON.stringify({
    updated: true,
    startsWithWhsec: signingSecret.startsWith("whsec_"),
    secretLength: signingSecret.length
  })
);
