import {
  BUNDLE_IDS,
  BUNDLE_QUANTITY_OPTIONS,
  SUPPORT_BUNDLES
} from "./supportBundles.js";

/** Customer-visible monthly membership prices in USD cents. */
export const PLAN_PRICE_CENTS = Object.freeze({
  basic: 4999,
  plus: 14999,
  pro: 24999
});

export const PLAN_PRICE_ENV_BY_ID = Object.freeze({
  basic: "STRIPE_PRICE_ID_BASIC",
  plus: "STRIPE_PRICE_ID_PLUS",
  pro: "STRIPE_PRICE_ID_PRO"
});

export const BUNDLE_PRICE_ENV_BY_ID = Object.freeze(
  Object.fromEntries(
    BUNDLE_IDS.map((bundleId) => [
      bundleId,
      Object.freeze(
        Object.fromEntries(
          BUNDLE_QUANTITY_OPTIONS.map((quantity) => [
            quantity,
            `STRIPE_PRICE_ID_${bundleId.toUpperCase()}_${quantity}`
          ])
        )
      )
    ])
  )
);

export const REQUIRED_STRIPE_PRICE_ENV_KEYS = Object.freeze([
  ...Object.values(PLAN_PRICE_ENV_BY_ID),
  ...BUNDLE_IDS.flatMap((bundleId) => Object.values(BUNDLE_PRICE_ENV_BY_ID[bundleId]))
]);

export function getBundleExpectedPriceCents(bundleId, quantity) {
  const catalog = SUPPORT_BUNDLES[bundleId];
  const field = Object.values(catalog?.quantities || {})[0];
  return field?.priceCentsByQty?.[quantity] ?? null;
}

export function listStripeCatalogOfferings() {
  const plans = Object.entries(PLAN_PRICE_CENTS).map(([id, unitAmount]) => ({
    id,
    name: `Prelude ${id[0].toUpperCase()}${id.slice(1)}`,
    kind: "subscription",
    prices: [{
      quantity: null,
      unitAmount,
      envKey: PLAN_PRICE_ENV_BY_ID[id],
      lookupKey: `prelude_${id}_monthly_${unitAmount}`
    }]
  }));

  const bundles = BUNDLE_IDS.map((id) => {
    const catalog = SUPPORT_BUNDLES[id];
    return {
      id,
      name: `Prelude ${catalog.title}`,
      description: catalog.description,
      kind: "one_time",
      prices: BUNDLE_QUANTITY_OPTIONS.map((quantity) => {
        const unitAmount = getBundleExpectedPriceCents(id, quantity);
        return {
          quantity,
          unitAmount,
          envKey: BUNDLE_PRICE_ENV_BY_ID[id][quantity],
          lookupKey: `prelude_${id}_${quantity}_${unitAmount}`
        };
      })
    };
  });

  return [...plans, ...bundles];
}
