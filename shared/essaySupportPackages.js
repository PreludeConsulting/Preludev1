/**
 * Authoritative Essay Support package catalog (server + shared checkout).
 * Stripe Price IDs come from env — never from the client.
 */

import { BUNDLE_QUANTITY_OPTIONS, ESSAY_SUPPORT_PRICE_CENTS } from "./supportBundles.js";

function readEssayPriceEnv(env, quantity) {
  const keyLegacy = `STRIPE_PRICE_ID_ESSAY_SUPPORT_${quantity}`;
  const keyAlt = `ESSAY_SUPPORT_${quantity}_PRICE_ID`;
  return String(env[keyLegacy] || env[keyAlt] || "").trim();
}

export function buildEssaySupportPackages(env = process.env) {
  return Object.freeze(
    Object.fromEntries(
      BUNDLE_QUANTITY_OPTIONS.map((credits) => {
        const packageKey = `essay_support_${credits}`;
        return [
          packageKey,
          Object.freeze({
            packageKey,
            credits,
            amountCents: ESSAY_SUPPORT_PRICE_CENTS[credits],
            stripePriceEnvKeys: [
              `STRIPE_PRICE_ID_ESSAY_SUPPORT_${credits}`,
              `ESSAY_SUPPORT_${credits}_PRICE_ID`
            ],
            stripePriceId: readEssayPriceEnv(env, credits) || null
          })
        ];
      })
    )
  );
}

export const ESSAY_SUPPORT_PACKAGE_KEYS = Object.freeze(
  BUNDLE_QUANTITY_OPTIONS.map((credits) => `essay_support_${credits}`)
);

export function getEssaySupportPackage(packageKeyOrCredits, env = process.env) {
  const packages = buildEssaySupportPackages(env);
  if (packages[packageKeyOrCredits]) return packages[packageKeyOrCredits];
  const credits = Math.floor(Number(packageKeyOrCredits));
  if (BUNDLE_QUANTITY_OPTIONS.includes(credits)) {
    return packages[`essay_support_${credits}`] || null;
  }
  return null;
}

export function listEssaySupportPackagesPublic(env = process.env) {
  return BUNDLE_QUANTITY_OPTIONS.map((credits) => {
    const pkg = getEssaySupportPackage(credits, env);
    return {
      packageKey: pkg.packageKey,
      credits: pkg.credits,
      amountCents: pkg.amountCents,
      available: Boolean(pkg.stripePriceId)
    };
  });
}

export function resolveEssaySupportCheckoutPackage(input = {}, env = process.env) {
  const rawKey = String(input.packageKey || "").trim();
  const qty = Math.floor(Number(input.quantities?.essayReviews ?? input.credits ?? input.quantity));
  const pkg =
    (rawKey && getEssaySupportPackage(rawKey, env)) ||
    (Number.isFinite(qty) ? getEssaySupportPackage(qty, env) : null);

  if (!pkg) {
    return {
      ok: false,
      error: "invalid_package",
      message: "Choose a valid Essay Support package."
    };
  }
  if (!pkg.stripePriceId) {
    return {
      ok: false,
      error: "package_unavailable",
      message: "This Essay Support package is temporarily unavailable."
    };
  }
  return { ok: true, package: pkg };
}
