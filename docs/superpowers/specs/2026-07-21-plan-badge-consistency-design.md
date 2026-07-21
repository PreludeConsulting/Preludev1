# Prelude Plan Badge Consistency Design

## Goal

Make every subscription-plan badge across Prelude express the same plan semantics in every supported locale:

- Basic: no promotional badge
- Plus: Most Popular
- Pro: Best Value

The localized equivalents are:

| Locale | Plus | Pro |
| --- | --- | --- |
| English | Most Popular | Best Value |
| Korean | 가장 인기 | 최고의 가치 |
| Chinese | 最受欢迎 | 超值之选 |
| Spanish | Más popular | Mejor valor |

One-time support-bundle labels are outside the subscription-plan badge contract. Their existing “Best Value” copy can remain because it describes a bundle quantity, not Plus or Pro.

## Architecture

Add a shared plan-badge module containing:

- The only mapping from plan IDs to badge semantics.
- The localized labels for each supported language.
- A resolver that accepts a plan ID and language and returns the correct label or `null`.

Plan records and presentation components must not contain raw promotional badge text. Components obtain the label through the shared resolver. Existing plan metadata may retain a separate visual-feature flag where required to preserve the current featured-card styling; visual emphasis is not used to infer badge meaning.

## Consumers

Replace duplicated or conflicting plan-badge logic in:

- Landing-page pricing cards.
- Public plans page and Prelude Plans wallet cards.
- Plan detail popups used by public plans, checkout, payment onboarding, and dashboard billing flows.
- Dashboard current-plan and upgrade surfaces.
- Any reusable pricing or plan-selection component discovered by the source audit.

Components should continue using their existing badge elements and CSS classes. Only badge ownership and copy resolution change.

## Localization

The shared resolver defaults safely to English for unsupported or missing locale values. Locale-specific labels live beside the semantic mapping so plan badge wording cannot diverge between the landing page, wallet, checkout, onboarding, or dashboard.

Existing translation keys for unrelated bundle badges remain unchanged. Obsolete subscription-plan badge keys are removed after all consumers migrate.

## Testing

Use red-green-refactor:

1. Add unit tests for Basic, Plus, and Pro across all supported locales and fallback behavior.
2. Add rendering tests for landing pricing, wallet cards/popups, and dashboard billing badges.
3. Add a source-contract audit that rejects hardcoded subscription-plan badge variants such as misplaced “Best Value,” “Most Value,” or “Recommended.”
4. Run focused tests, the full `npm test` suite, and the production build.

Acceptance requires exact Plus/Pro semantics everywhere, no conflicting subscription-plan badge literals, unchanged responsive markup/classes, and no functionality regressions.
