# Prelude Plan Badge Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Plus the localized “Most Popular” badge and Pro the localized “Best Value” badge on every subscription-plan surface through one shared resolver.

**Architecture:** A new pure `planBadges` module owns plan-to-badge semantics and all supported locale labels. Existing presentation components call that resolver while retaining their current markup and CSS; visual feature emphasis becomes separate `isFeatured` metadata so it cannot redefine badge meaning.

**Tech Stack:** React 19, Vite 8, Vitest 4, JavaScript/JSX, existing LanguageContext.

## Global Constraints

- Basic has no promotional plan badge.
- Plus means “Most Popular”; Pro means “Best Value.”
- Korean, Chinese, and Spanish use the approved equivalents from the design specification.
- One-time support-bundle badges remain separate from subscription-plan badges.
- Preserve existing styling, responsive layouts, checkout behavior, onboarding flow, dashboard behavior, and API contracts.
- Preserve all unrelated dirty-worktree changes; do not stage or commit implementation files unless the user explicitly requests it.

---

### Task 1: Shared plan-badge contract

**Files:**
- Create: `src/lib/planBadges.js`
- Modify: `src/lib/plans.js`
- Modify: `tests/plans.test.js`

**Interfaces:**
- Produces: `PLAN_BADGE_TYPES`, `getPlanBadgeType(planId)`, and `getPlanBadgeLabel(planId, language = "en")`.
- Produces: `plan.isFeatured: boolean`, used only for existing visual emphasis.

- [ ] **Step 1: Write the failing shared-contract tests**

Add tests that import the new helpers and assert:

```js
expect(getPlanBadgeType("basic")).toBeNull();
expect(getPlanBadgeType("plus")).toBe("mostPopular");
expect(getPlanBadgeType("pro")).toBe("bestValue");

expect(getPlanBadgeLabel("plus", "en")).toBe("Most Popular");
expect(getPlanBadgeLabel("pro", "en")).toBe("Best Value");
expect(getPlanBadgeLabel("plus", "ko")).toBe("가장 인기");
expect(getPlanBadgeLabel("pro", "ko")).toBe("최고의 가치");
expect(getPlanBadgeLabel("plus", "zh")).toBe("最受欢迎");
expect(getPlanBadgeLabel("pro", "zh")).toBe("超值之选");
expect(getPlanBadgeLabel("plus", "es")).toBe("Más popular");
expect(getPlanBadgeLabel("pro", "es")).toBe("Mejor valor");
expect(getPlanBadgeLabel("plus", "unsupported")).toBe("Most Popular");
expect(getPlanBadgeLabel("basic", "en")).toBeNull();
```

Also assert `PLANS.pro.isFeatured === true`, `PLANS.plus.isFeatured === false`, and that no plan exposes `isRecommended`.

- [ ] **Step 2: Run the tests and verify RED**

Run: `rtk npx vitest run tests/plans.test.js`

Expected: FAIL because `planBadges.js`, its exports, and `isFeatured` do not exist.

- [ ] **Step 3: Implement the minimal pure resolver**

Create immutable semantic and locale maps:

```js
export const PLAN_BADGE_TYPES = Object.freeze({
  plus: "mostPopular",
  pro: "bestValue"
});

const PLAN_BADGE_LABELS = Object.freeze({
  en: Object.freeze({ mostPopular: "Most Popular", bestValue: "Best Value" }),
  ko: Object.freeze({ mostPopular: "가장 인기", bestValue: "최고의 가치" }),
  zh: Object.freeze({ mostPopular: "最受欢迎", bestValue: "超值之选" }),
  es: Object.freeze({ mostPopular: "Más popular", bestValue: "Mejor valor" })
});

export function getPlanBadgeType(planId) {
  return PLAN_BADGE_TYPES[String(planId ?? "").trim().toLowerCase()] ?? null;
}

export function getPlanBadgeLabel(planId, language = "en") {
  const type = getPlanBadgeType(planId);
  if (!type) return null;
  return (PLAN_BADGE_LABELS[language] ?? PLAN_BADGE_LABELS.en)[type];
}
```

Rename `isRecommended` to `isFeatured` in `PLANS`, keeping Pro featured and Basic/Plus unfeatured.

- [ ] **Step 4: Run the tests and verify GREEN**

Run: `rtk npx vitest run tests/plans.test.js`

Expected: all plan-helper tests pass.

---

### Task 2: Migrate every plan presentation surface

**Files:**
- Modify: `src/components/PricingCard.jsx`
- Modify: `src/components/Sections.jsx`
- Modify: `src/components/PlanSelectionPage.jsx`
- Modify: `src/dashboard/components/product/billing/BillingCurrentPlanCard.jsx`
- Modify: `src/lib/translations.js`
- Create: `tests/planBadgeSurfaces.test.jsx`

**Interfaces:**
- Consumes: `getPlanBadgeLabel(planId, language)` and `plan.isFeatured` from Task 1.
- Produces: localized plan badges in landing, wallet, plan-detail, checkout/onboarding, and dashboard billing render paths.

- [ ] **Step 1: Write failing rendering tests**

Use `renderToStaticMarkup` for the reusable cards and exported wallet/detail components. Assert:

```js
expect(renderPricing("plus", "en")).toContain("Most Popular");
expect(renderPricing("pro", "en")).toContain("Best Value");
expect(renderPricing("basic", "en")).not.toMatch(/Most Popular|Best Value/);

expect(renderWallet("plus", "ko")).toContain("가장 인기");
expect(renderWallet("pro", "zh")).toContain("超值之选");
expect(renderDetails("plus", "es")).toContain("Más popular");
expect(renderBilling("pro", "en")).toContain("Best Value");
```

Retain assertions for the existing plan card, popup, and dashboard class names to prove styling hooks remain unchanged.

- [ ] **Step 2: Run the rendering tests and verify RED**

Run: `rtk npx vitest run tests/planBadgeSurfaces.test.jsx`

Expected: FAIL because Plus lacks a badge and Pro still renders conflicting hardcoded labels.

- [ ] **Step 3: Migrate landing pricing**

Change `PricingCard` to accept `language = "en"`, calculate:

```js
const badgeLabel = getPlanBadgeLabel(plan.id, language);
```

Render `badgeLabel` when present and use `plan.isFeatured` only for `pricing-card--featured`. In `Sections.jsx`, read `language` from `useLanguage()` and pass it to every `PricingCard`. Remove the obsolete `mostPopularLabel` prop.

- [ ] **Step 4: Migrate wallet, checkout, and onboarding render paths**

In `PlanSelectionPage.jsx`, resolve badge labels for `WalletPlanCard`, `PlanDetailsPanel`, and `PlanPopup` from their plan ID and a `language` prop defaulting to English. Obtain the active language once in the page/wallet owner and thread it to those reusable pieces. Replace every `plan.isRecommended`/hardcoded `Best value` branch with the shared label.

- [ ] **Step 5: Migrate dashboard billing**

In `BillingCurrentPlanCard.jsx`, use `useLanguage()` and `getPlanBadgeLabel(plan.id, language)`. Preserve `billing-current-plan__badge--popular`, its icon, and the active-plan badge; render the promotional badge only when the resolver returns a label.

- [ ] **Step 6: Remove obsolete subscription badge translation keys**

Remove `sections.plans.mostPopular` and any unused `sections.plans.bestValue` values in every locale. Keep `sections.bundles.bestValue` and `sections.bundles.popularOptions` unchanged.

- [ ] **Step 7: Run focused rendering and existing plan-flow tests**

Run:

```bash
rtk npx vitest run tests/plans.test.js tests/planBadgeSurfaces.test.jsx tests/planWalletMotion.test.js tests/frontpageBundlePricing.test.js
```

Expected: all tests pass, including unchanged one-time bundle copy.

---

### Task 3: Enforce the single source and verify the site

**Files:**
- Create: `tests/planBadgeSourceContract.test.js`
- Modify only if the audit finds a real plan consumer: the corresponding `src/**` file.

**Interfaces:**
- Consumes: the shared badge resolver and migrated surfaces from Tasks 1–2.
- Produces: a regression guard against future hardcoded subscription-plan badge drift.

- [ ] **Step 1: Write the source-contract test**

Recursively inspect JavaScript/JSX files under `src`. Exclude only:

```js
const ALLOWED_COPY_OWNERS = new Set([
  "src/lib/planBadges.js",
  "src/lib/translations.js"
]);
```

Allow the bundle translation owner because bundle badges are a separate contract. Fail if another source file contains exact promotional plan literals or uses `isRecommended`:

```js
expect(violations).toEqual([]);
```

The violation patterns must include `Most Popular`, `Most popular`, `Best Value`, `Best value`, `Most Value`, and subscription-plan badge branches containing `Recommended`.

- [ ] **Step 2: Run the audit and verify RED if any consumer remains**

Run: `rtk npx vitest run tests/planBadgeSourceContract.test.js`

Expected before final cleanup: FAIL listing any missed hardcoded plan surface; otherwise temporarily reintroduce one conflicting literal to prove the test fails, then revert it.

- [ ] **Step 3: Migrate every reported subscription-plan consumer**

For each genuine plan surface reported, import `getPlanBadgeLabel`, resolve from plan ID and current language, and preserve the component’s existing badge classes and layout. Do not migrate unrelated uses of “recommended,” reward “value,” mentor badges, or one-time bundle labels.

- [ ] **Step 4: Run focused and full verification**

Run:

```bash
rtk npx vitest run tests/plans.test.js tests/planBadgeSurfaces.test.jsx tests/planBadgeSourceContract.test.js tests/planWalletMotion.test.js tests/frontpageBundlePricing.test.js
rtk npm test
rtk npm run build
rtk git diff --check
rtk git status --short server/data
```

Expected: all focused tests pass; the full frontend/server/API suite passes; the production build succeeds; diff check is clean; server fixtures remain unchanged.

- [ ] **Step 5: Perform the final textual audit**

Run:

```bash
rtk rg -n "Most Popular|Most popular|Best Value|Best value|Most Value|isRecommended" src
```

Expected: subscription-plan badge labels appear only in `src/lib/planBadges.js`; bundle “Best Value” copy may remain in the explicitly separate translation catalog.
