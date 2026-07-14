/** Configurable one-time support bundles (client + server). */

export const BUNDLE_IDS = ["essay_support", "flexible_sessions"];

/** Older public / draft intents map onto the current catalog. */
const BUNDLE_ID_ALIASES = {
  application_support: "essay_support",
  college_application: "essay_support"
};

/** Allowed package sizes for both bundle types (1–2 removed; 9 not offered). */
export const BUNDLE_QUANTITY_OPTIONS = [3, 4, 5, 6, 7, 8, 10];

/** Fixed package prices in USD cents — source of truth for FE + BE checkout. */
export const ESSAY_SUPPORT_PRICE_CENTS = Object.freeze({
  3: 14900,
  4: 18900,
  5: 22900,
  6: 26500,
  7: 29900,
  8: 32900,
  10: 39900
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

function clampToAllowedQuantity(value, allowed, fallback) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  if (allowed.includes(n)) return n;
  // Snap drafts/legacy values onto the nearest allowed package size.
  return allowed.reduce((best, option) =>
    Math.abs(option - n) < Math.abs(best - n) ? option : best
  );
}

export function resolveBundleId(bundleId) {
  const raw = String(bundleId || "").trim();
  return BUNDLE_ID_ALIASES[raw] || raw;
}

export const SUPPORT_BUNDLES = {
  essay_support: {
    id: "essay_support",
    title: "Essay Support",
    shortTitle: "Essay Support",
    description: "Guided feedback for personal statements and supplemental essays.",
    shortDescription: "Guided feedback for personal statements and supplemental essays.",
    ctaLabel: "Customize Essay Support",
    badge: "Best Value",
    currency: "usd",
    startingCents: ESSAY_SUPPORT_PRICE_CENTS[3],
    note: "Choose your essay reviews before checkout",
    quantities: {
      essayReviews: {
        id: "essayReviews",
        label: "Essay reviews",
        hint: "Reviews for personal statements and supplements",
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
  },
  flexible_sessions: {
    id: "flexible_sessions",
    title: "Flexible Sessions",
    shortTitle: "Flexible Sessions",
    description: "Buy sessions and use them wherever your student needs help.",
    shortDescription: "Buy sessions and use them across admissions, tutoring, and prep.",
    ctaLabel: "Choose Sessions",
    badge: null,
    currency: "usd",
    startingCents: FLEXIBLE_SESSIONS_PRICE_CENTS[3],
    note: "Choose your session amount before checkout",
    quantities: {
      sessions: {
        id: "sessions",
        label: "Sessions",
        hint: "Mix consulting, essays, test prep, tutoring, and aid",
        min: BUNDLE_QUANTITY_OPTIONS[0],
        max: BUNDLE_QUANTITY_OPTIONS[BUNDLE_QUANTITY_OPTIONS.length - 1],
        default: 3,
        allowed: BUNDLE_QUANTITY_OPTIONS,
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

export function isValidBundleId(bundleId) {
  return BUNDLE_IDS.includes(resolveBundleId(bundleId));
}

export function getDefaultBundleSelection(bundleId) {
  const resolvedId = resolveBundleId(bundleId);
  const catalog = SUPPORT_BUNDLES[resolvedId];
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
  const catalog = SUPPORT_BUNDLES[bundleId];
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
      quantities[key] = clampToAllowedQuantity(exact, allowed, field.default);
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
      `${quote.qty} essay review${quote.qty === 1 ? "" : "s"}`,
      ...selectedServices
    ],
    savingsLabel: null
  };
}

function flexibleQuote(selection) {
  const catalog = SUPPORT_BUNDLES.flexible_sessions;
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
  const catalog = SUPPORT_BUNDLES[selection.bundleId];
  const quote =
    selection.bundleId === "essay_support" ? essayQuote(selection) : flexibleQuote(selection);

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

export function serializeBundleMetadata(quote) {
  const compact = {
    id: quote.selection.bundleId,
    q: quote.selection.quantities,
    a: quote.selection.addOns,
    s: quote.selection.services,
    u: quote.selection.sessionUses,
    total: quote.totalCents
  };
  const configJson = JSON.stringify(compact);
  return {
    purchaseType: "one_time_bundle",
    bundleId: quote.selection.bundleId,
    bundleTitle: quote.catalog.title,
    bundleTotalCents: String(quote.totalCents),
    bundleSummary: quote.summaryLines.slice(0, 4).join(" · ").slice(0, 450),
    bundleConfig: configJson.slice(0, 490)
  };
}

export function listSupportBundles() {
  return BUNDLE_IDS.map((id) => SUPPORT_BUNDLES[id]);
}
