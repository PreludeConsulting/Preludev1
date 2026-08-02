/** Configurable one-time support bundles (client + server). */

import {
  ALLOWED_REVIEW_CREDITS,
  ESSAY_SUPPORT_PRICE_CENTS_FROM_LINKS
} from "./stripePaymentLinks.js";

export const BUNDLE_IDS = ["essay_support"];

/** Legacy one-time session packages — not sold; kept for fulfillment of past purchases. */
export const LEGACY_BUNDLE_IDS = ["flexible_sessions"];

/** Older public / draft intents map onto the current catalog. */
const BUNDLE_ID_ALIASES = {
  application_support: "essay_support",
  college_application: "essay_support"
};

/** Purchasable essay-support package sizes (only these are sold). No 9. */
export const BUNDLE_QUANTITY_OPTIONS = [...ALLOWED_REVIEW_CREDITS];

/** Alias used by Essay Support UI/tests. */
export const APPROVED_CREDIT_OPTIONS = BUNDLE_QUANTITY_OPTIONS;

/** Legacy flexible-session package sizes kept for historical fulfillment only. */
export const LEGACY_SESSION_QUANTITY_OPTIONS = [3, 4, 5, 6, 7, 8, 10];

/** Fixed package prices in USD cents — derived from Payment Link catalog. */
export const ESSAY_SUPPORT_PRICE_CENTS = Object.freeze({
  ...ESSAY_SUPPORT_PRICE_CENTS_FROM_LINKS
});

export const FLEXIBLE_SESSIONS_PRICE_CENTS = Object.freeze({
  3: 21900,
  4: 27900,
  5: 33900,
  6: 39900,
  7: 45900,
  8: 51900,
  10: 62900
});

export function stepApprovedQuantity(current, direction, allowed = BUNDLE_QUANTITY_OPTIONS) {
  const steps = Array.isArray(allowed) && allowed.length ? allowed : BUNDLE_QUANTITY_OPTIONS;
  let index = steps.indexOf(Math.floor(Number(current)));
  if (index < 0) index = 0;
  const nextIndex = index + Number(direction);
  if (nextIndex < 0 || nextIndex >= steps.length) return steps[index];
  return steps[nextIndex];
}

export function canStepApprovedQuantity(current, direction, allowed = BUNDLE_QUANTITY_OPTIONS) {
  const steps = Array.isArray(allowed) && allowed.length ? allowed : BUNDLE_QUANTITY_OPTIONS;
  let index = steps.indexOf(Math.floor(Number(current)));
  if (index < 0) index = 0;
  const nextIndex = index + Number(direction);
  return nextIndex >= 0 && nextIndex < steps.length;
}

export function essayPackageKey(quantity) {
  const qty = Math.floor(Number(quantity));
  if (!BUNDLE_QUANTITY_OPTIONS.includes(qty)) return null;
  return `essay_support_${qty}`;
}

export function resolveBundleId(bundleId) {
  const raw = String(bundleId || "").trim();
  return BUNDLE_ID_ALIASES[raw] || raw;
}

export const SUPPORT_BUNDLES = {
  essay_support: {
    id: "essay_support",
    title: "Application & Essay Support",
    shortTitle: "Essay Support",
    description:
      "Detailed feedback on personal statements, revisions, final edits, and college-specific supplemental essays.",
    shortDescription:
      "Detailed feedback on personal statements, revisions, final edits, and college-specific supplemental essays.",
    ctaLabel: "Choose Essay Support",
    paymentType: "one_time",
    paymentTypeLabel: "One-time payment",
    badge: null,
    currency: "usd",
    startingCents: ESSAY_SUPPORT_PRICE_CENTS[3],
    note: "Choose your review credits before checkout",
    quantities: {
      essayReviews: {
        id: "essayReviews",
        label: "Review credits",
        hint: "One credit = one personal statement or one college's supplements",
        min: BUNDLE_QUANTITY_OPTIONS[0],
        max: BUNDLE_QUANTITY_OPTIONS[BUNDLE_QUANTITY_OPTIONS.length - 1],
        default: 3,
        allowed: BUNDLE_QUANTITY_OPTIONS,
        priceCentsByQty: ESSAY_SUPPORT_PRICE_CENTS
      }
    },
    services: [
      { id: "personal_statement", label: "Personal statement" },
      { id: "supplemental_essays", label: "Supplemental essays" },
      { id: "revisions", label: "Revisions" },
      { id: "final_edits", label: "Final edits" }
    ]
  }
};

/** Kept for historical purchase display / fulfillment only — not sold. */
export const LEGACY_SUPPORT_BUNDLES = {
  flexible_sessions: {
    id: "flexible_sessions",
    title: "Flexible Sessions",
    shortTitle: "Flexible Sessions",
    description: "Legacy one-time session package (no longer available for purchase).",
    shortDescription: "Legacy one-time session package (no longer available for purchase).",
    ctaLabel: "Unavailable",
    purchasable: false,
    currency: "usd",
    startingCents: FLEXIBLE_SESSIONS_PRICE_CENTS[3],
    note: "Flexible sessions are included with Plus and Pro subscriptions.",
    quantities: {
      sessions: {
        id: "sessions",
        label: "Sessions",
        hint: "Legacy package",
        min: LEGACY_SESSION_QUANTITY_OPTIONS[0],
        max: LEGACY_SESSION_QUANTITY_OPTIONS[LEGACY_SESSION_QUANTITY_OPTIONS.length - 1],
        default: 3,
        allowed: LEGACY_SESSION_QUANTITY_OPTIONS,
        priceCentsByQty: FLEXIBLE_SESSIONS_PRICE_CENTS
      }
    },
    sessionUses: [
      { id: "college_consulting", label: "College consulting" },
      { id: "essay_help", label: "Essay help" },
      { id: "sat_act", label: "SAT/ACT prep" },
      { id: "academic_tutoring", label: "Academic tutoring" },
      { id: "financial_aid", label: "Financial aid guidance" }
    ]
  }
};

export function getBundleCatalog(bundleId, { allowLegacy = false } = {}) {
  const resolvedId = resolveBundleId(bundleId);
  if (SUPPORT_BUNDLES[resolvedId]) return SUPPORT_BUNDLES[resolvedId];
  if (allowLegacy && LEGACY_SUPPORT_BUNDLES[resolvedId]) return LEGACY_SUPPORT_BUNDLES[resolvedId];
  return null;
}

export function isValidBundleId(bundleId) {
  return BUNDLE_IDS.includes(resolveBundleId(bundleId));
}

export function isLegacyBundleId(bundleId) {
  return LEGACY_BUNDLE_IDS.includes(resolveBundleId(bundleId));
}

export function getDefaultBundleSelection(bundleId) {
  const resolvedId = resolveBundleId(bundleId);
  const catalog = getBundleCatalog(resolvedId);
  if (!catalog) return null;

  const quantities = {};
  for (const [key, field] of Object.entries(catalog.quantities || {})) {
    quantities[key] = field.default;
  }

  const addOns = Object.fromEntries((catalog.addOns || []).map((item) => [item.id, false]));
  const services = Object.fromEntries((catalog.services || []).map((item) => [item.id, true]));
  const sessionUses = Object.fromEntries((catalog.sessionUses || []).map((item) => [item.id, true]));

  return { bundleId: resolvedId, quantities, addOns, services, sessionUses };
}

/**
 * @param {object} input
 * @param {{ snapInvalidQuantities?: boolean }} [options]
 *   snapInvalidQuantities=true — coerce legacy/draft sizes onto the nearest package (UI).
 *   snapInvalidQuantities=false — reject unsupported sizes (checkout / server).
 */
export function normalizeBundleSelection(input = {}, options = {}) {
  const snapInvalidQuantities = options.snapInvalidQuantities === true;
  const bundleId = resolveBundleId(input.bundleId);
  const catalog = getBundleCatalog(bundleId);
  if (!catalog) {
    return { ok: false, error: "invalid_bundle", message: "That support bundle is not available." };
  }

  const quantities = {};
  for (const [key, field] of Object.entries(catalog.quantities || {})) {
    let raw = input.quantities?.[key];
    // Migrate older drafts that used `sessions` for this bundle.
    if (bundleId === "essay_support" && key === "essayReviews" && raw == null) {
      raw = input.quantities?.sessions;
    }

    const allowed = field.allowed || BUNDLE_QUANTITY_OPTIONS;
    const exact = Math.floor(Number(raw));
    const missing = raw == null || String(raw).trim() === "" || !Number.isFinite(exact);

    if (missing) {
      quantities[key] = field.default;
      continue;
    }

    if (!allowed.includes(exact)) {
      if (!snapInvalidQuantities) {
        return {
          ok: false,
          error: "validation_error",
          message: `Choose ${allowed.join(", ")} ${field.label.toLowerCase()}.`
        };
      }
      // Invalid drafts reset to catalog default (3), not nearest neighbor.
      quantities[key] = field.default;
      continue;
    }

    quantities[key] = exact;
  }

  const addOns = {};
  for (const item of catalog.addOns || []) {
    addOns[item.id] = Boolean(input.addOns?.[item.id]);
  }

  // Essay focus areas and session uses are always included — not customer toggles.
  const services = Object.fromEntries((catalog.services || []).map((item) => [item.id, true]));
  const sessionUses = Object.fromEntries((catalog.sessionUses || []).map((item) => [item.id, true]));

  return {
    ok: true,
    selection: { bundleId, quantities, addOns, services, sessionUses }
  };
}

function packageQuote(catalog, selection, quantityKey) {
  const field = catalog.quantities[quantityKey];
  const qty = selection.quantities[quantityKey];
  const totalCents = field.priceCentsByQty?.[qty];
  if (!Number.isFinite(totalCents)) {
    return null;
  }
  return {
    qty,
    subtotalCents: totalCents,
    totalCents,
    savingsCents: 0,
    discount: 0
  };
}

function essayQuote(selection) {
  const catalog = SUPPORT_BUNDLES.essay_support;
  const quote = packageQuote(catalog, selection, "essayReviews");
  if (!quote) return null;

  const selectedServices = (catalog.services || [])
    .filter((item) => selection.services[item.id])
    .map((item) => item.label);

  return {
    subtotalCents: quote.subtotalCents,
    totalCents: quote.totalCents,
    savingsCents: quote.savingsCents,
    discountPercent: 0,
    startingCents: catalog.startingCents,
    summaryLines: [
      `${quote.qty} review credit${quote.qty === 1 ? "" : "s"}`,
      ...selectedServices
    ],
    savingsLabel: null
  };
}

function flexibleQuote(selection) {
  const catalog = LEGACY_SUPPORT_BUNDLES.flexible_sessions;
  const quote = packageQuote(catalog, selection, "sessions");
  if (!quote) return null;

  const selectedUses = (catalog.sessionUses || [])
    .filter((item) => selection.sessionUses?.[item.id])
    .map((item) => item.label);

  return {
    subtotalCents: quote.subtotalCents,
    totalCents: quote.totalCents,
    savingsCents: quote.savingsCents,
    discountPercent: 0,
    startingCents: catalog.startingCents,
    summaryLines: [
      `${quote.qty} flexible session${quote.qty === 1 ? "" : "s"}`,
      ...(selectedUses.length ? [`Usable for: ${selectedUses.join(", ")}`] : [])
    ],
    savingsLabel: null
  };
}

export function quoteBundleSelection(rawSelection, options = {}) {
  // Checkout must not silently remap sizes; UI may snap legacy drafts.
  const normalized = normalizeBundleSelection(rawSelection, {
    snapInvalidQuantities: options.snapInvalidQuantities === true
  });
  if (!normalized.ok) return normalized;

  const { selection } = normalized;
  if (selection.bundleId !== "essay_support") {
    return {
      ok: false,
      error: "invalid_bundle",
      message: "That support bundle is not available for purchase."
    };
  }

  const catalog = SUPPORT_BUNDLES.essay_support;
  const quote = essayQuote(selection);

  if (!quote) {
    return {
      ok: false,
      error: "validation_error",
      message: "That package size is not available."
    };
  }

  return {
    ok: true,
    selection,
    catalog: {
      id: catalog.id,
      title: catalog.title,
      description: catalog.description,
      currency: catalog.currency,
      note: catalog.note,
      badge: catalog.badge,
      ctaLabel: catalog.ctaLabel
    },
    ...quote,
    displayTotal: formatUsd(quote.totalCents),
    displayStarting: formatUsd(quote.startingCents),
    purchaseType: "one_time_bundle"
  };
}

export function formatUsd(cents) {
  const amount = (Number(cents) || 0) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2
  }).format(amount);
}

export function serializeBundleMetadata(quote, extras = {}) {
  const compact = {
    id: quote.selection.bundleId,
    q: quote.selection.quantities,
    a: quote.selection.addOns,
    s: quote.selection.services,
    u: quote.selection.sessionUses,
    total: quote.totalCents
  };
  const configJson = JSON.stringify(compact);
  const essayQty = Math.floor(Number(quote.selection.quantities?.essayReviews));
  const isEssay = quote.selection.bundleId === "essay_support" && Number.isFinite(essayQty);
  const packageKey = isEssay ? `essay_support_${essayQty}` : null;
  return {
    purchaseType: isEssay ? "ESSAY_SUPPORT" : "one_time_bundle",
    bundleId: quote.selection.bundleId,
    bundleTitle: quote.catalog.title,
    bundleTotalCents: String(quote.totalCents),
    bundleSummary: quote.summaryLines.slice(0, 4).join(" · ").slice(0, 450),
    bundleConfig: configJson.slice(0, 490),
    ...(packageKey
      ? {
          packageKey,
          creditQuantity: String(essayQty),
          essayReviews: String(essayQty)
        }
      : {}),
    ...(extras.studentId ? { studentId: String(extras.studentId) } : {}),
    ...(extras.purchaserUserId ? { purchaserUserId: String(extras.purchaserUserId) } : {})
  };
}

export function listSupportBundles() {
  return BUNDLE_IDS.map((id) => SUPPORT_BUNDLES[id]);
}
