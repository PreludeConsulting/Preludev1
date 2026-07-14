/** Configurable one-time support bundles (client + server). */

export const BUNDLE_IDS = ["essay_support", "flexible_sessions"];

/** Older public / draft intents map onto the current catalog. */
const BUNDLE_ID_ALIASES = {
  application_support: "essay_support",
  college_application: "essay_support"
};

const QUANTITY_VOLUME_TIERS = [
  { min: 5, discount: 0.15 },
  { min: 3, discount: 0.1 }
];

function clampInt(value, min, max) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function volumeDiscount(qty) {
  for (const tier of QUANTITY_VOLUME_TIERS) {
    if (qty >= tier.min) return tier.discount;
  }
  return 0;
}

function applyDiscount(subtotalCents, discount) {
  if (!discount) return subtotalCents;
  return Math.round(subtotalCents * (1 - discount));
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
    startingCents: 7500,
    note: "Choose your essay reviews before checkout",
    quantities: {
      essayReviews: {
        id: "essayReviews",
        label: "Essay reviews",
        hint: "Reviews for personal statements and supplements",
        min: 1,
        max: 12,
        default: 2,
        unitCents: 7500
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
    startingCents: 17000,
    note: "Choose your session amount before checkout",
    quantities: {
      sessions: {
        id: "sessions",
        label: "Sessions",
        hint: "Mix consulting, essays, test prep, tutoring, and aid",
        min: 1,
        max: 20,
        default: 4,
        unitCents: 8500
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
  const services = Object.fromEntries(
    (catalog.services || []).map((item, index) => [item.id, index < 4])
  );
  const sessionUses = Object.fromEntries(
    (catalog.sessionUses || []).map((item) => [item.id, true])
  );

  return { bundleId: resolvedId, quantities, addOns, services, sessionUses };
}

export function normalizeBundleSelection(input = {}) {
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
    quantities[key] = clampInt(raw, field.min, field.max);
  }

  const addOns = {};
  for (const item of catalog.addOns || []) {
    addOns[item.id] = Boolean(input.addOns?.[item.id]);
  }

  const services = {};
  for (const item of catalog.services || []) {
    services[item.id] = Boolean(input.services?.[item.id]);
  }

  const sessionUses = {};
  for (const item of catalog.sessionUses || []) {
    sessionUses[item.id] = Boolean(input.sessionUses?.[item.id]);
  }

  if (bundleId === "essay_support") {
    const selectedCount = Object.values(services).filter(Boolean).length;
    if (selectedCount < 1) {
      return {
        ok: false,
        error: "validation_error",
        message: "Select at least one essay focus area."
      };
    }
  }

  if (bundleId === "flexible_sessions") {
    const selectedUses = Object.values(sessionUses).filter(Boolean).length;
    if (selectedUses < 1) {
      return {
        ok: false,
        error: "validation_error",
        message: "Choose at least one service these sessions may be used for."
      };
    }
  }

  return {
    ok: true,
    selection: { bundleId, quantities, addOns, services, sessionUses }
  };
}

function quantityQuote(catalog, selection, quantityKey, { volumeTiers = false } = {}) {
  const qty = selection.quantities[quantityKey] || 0;
  const unit = catalog.quantities[quantityKey].unitCents;
  const subtotalCents = qty * unit;
  let discount = 0;
  if (volumeTiers) {
    if (qty >= 12) discount = 0.15;
    else if (qty >= 8) discount = 0.1;
    else if (qty >= 4) discount = 0.05;
  } else {
    discount = volumeDiscount(qty);
  }
  const totalCents = applyDiscount(subtotalCents, discount);
  const savingsCents = Math.max(0, subtotalCents - totalCents);
  return { qty, subtotalCents, totalCents, savingsCents, discount };
}

function essayQuote(selection) {
  const catalog = SUPPORT_BUNDLES.essay_support;
  const quote = quantityQuote(catalog, selection, "essayReviews");
  const selectedServices = (catalog.services || [])
    .filter((item) => selection.services[item.id])
    .map((item) => item.label);

  return {
    subtotalCents: quote.subtotalCents,
    totalCents: quote.totalCents,
    savingsCents: quote.savingsCents,
    discountPercent: Math.round(quote.discount * 100),
    startingCents: catalog.startingCents,
    summaryLines: [
      `${quote.qty} essay review${quote.qty === 1 ? "" : "s"}`,
      ...selectedServices
    ],
    savingsLabel:
      quote.savingsCents > 0 ? `Save ${formatUsd(quote.savingsCents)} with volume pricing` : null
  };
}

function flexibleQuote(selection) {
  const catalog = SUPPORT_BUNDLES.flexible_sessions;
  const quote = quantityQuote(catalog, selection, "sessions", { volumeTiers: true });
  const selectedUses = (catalog.sessionUses || [])
    .filter((item) => selection.sessionUses?.[item.id])
    .map((item) => item.label);

  return {
    subtotalCents: quote.subtotalCents,
    totalCents: quote.totalCents,
    savingsCents: quote.savingsCents,
    discountPercent: Math.round(quote.discount * 100),
    startingCents: catalog.startingCents,
    summaryLines: [
      `${quote.qty} flexible session${quote.qty === 1 ? "" : "s"}`,
      ...(selectedUses.length ? [`Usable for: ${selectedUses.join(", ")}`] : [])
    ],
    savingsLabel:
      quote.savingsCents > 0
        ? `Save ${formatUsd(quote.savingsCents)} (${Math.round(quote.discount * 100)}% off)`
        : null
  };
}

export function quoteBundleSelection(rawSelection) {
  const normalized = normalizeBundleSelection(rawSelection);
  if (!normalized.ok) return normalized;

  const { selection } = normalized;
  const catalog = SUPPORT_BUNDLES[selection.bundleId];
  const quote = selection.bundleId === "essay_support" ? essayQuote(selection) : flexibleQuote(selection);

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
