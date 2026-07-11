# Prelude Sitewide Post-QA Refinement Design

## Objective

Raise Prelude from a functional product to a cohesive, production-quality experience across every reachable public, authentication, onboarding, and role-specific dashboard route. Preserve all working features, established brand colors, architecture, data flows, and role semantics. Prefer shared permanent fixes over page-specific patches.

## Product Direction

Use conservative design-system consolidation with targeted layout improvements. Existing screens should remain recognizable. Visible structural changes are justified only by rendered evidence of weak hierarchy, avoidable friction, clipping, overflow, awkward wrapping, excessive empty space, inaccessible behavior, or inconsistent state presentation.

The landing site, authentication surfaces, onboarding, PreludeMatch, and dashboards should feel like one product without flattening their distinct purposes. Prelude's existing lavender, navy, purple, aqua, warm paper, and white surfaces remain the palette. Color changes are limited to contrast corrections.

## Scope

The audit and refinement covers:

- Landing page, navigation, site search, pricing, mentors, contact, and booking
- Login, registration, email verification, login verification, password recovery, password reset, OAuth callback, and auth error states
- Public and onboarding plan selection, plan details, checkout success, and checkout cancellation
- Role selection, student onboarding, mentor onboarding, parent invitation, payment, PreludeMatch questionnaire, matching, and result states
- Student overview, calendar, colleges, AI, workspace, mentors, PreludeMatch, messaging, notifications, billing, help, settings, profile statistics, progress, and rewards
- Mentor overview, calendar, students, student detail views, messaging, notifications, availability, settings, help, and matching administration where authorized
- Parent overview, child views, notifications, billing, settings, help, and matching administration where authorized
- Empty, loading, success, validation, retryable error, terminal error, locked, disabled, and permission-restricted states
- Desktop, tablet, and mobile viewports near 1440, 1024, 768, and 390 CSS pixels

Admin-only product functionality is not redesigned, but reachable administrative surfaces receive the same regression, accessibility, and responsive checks.

## Design-System Contract

### Foundations

Use the existing root tokens in `src/index.css` as the source of truth. Consolidate repeated values into the existing spacing, radius, shadow, control-height, border, focus, motion-duration, and easing families. Dashboard-specific aliases may remain when they express a real contextual distinction, but should resolve to shared values where the visual result is intended to match.

The preferred scale is:

- Spacing: existing `--space-1` through `--space-16`
- Controls: `--control-height`, shared inline padding, and consistent compact variants
- Corners: small controls, standard controls, cards, large cards, overlays, and pills
- Elevation: subtle, card, and elevated overlays
- Focus: visible high-contrast outline with consistent offset
- Motion: fast, base, and slow durations with the established standard easing

### Shared Components

Consolidate repeated behavior through existing shared components before creating new ones. Priority families are buttons, fields, cards, banners and alerts, dialogs, dropdowns and popovers, navigation, loading indicators, empty states, status messages, and page headers.

Create a new shared primitive only when at least three real consumers require the same semantic behavior and existing components cannot express it cleanly. Do not migrate stable components merely to satisfy abstract purity.

### Typography and Content

Maintain Barlow and Barlow Condensed where already part of Prelude's identity. Resolve accidental dashboard font drift where it weakens cohesion, while preserving dense application readability. Standardize page-title, section-title, card-title, body, label, helper, metadata, and button roles.

Copy should be concise, professional, and action-oriented. Use consistent names for PreludeMatch, Prelude AI, mentor, parent or guardian, plan, coins, rewards, verification code, and dashboard areas. Errors explain what happened and the next safe action. Empty states identify the value of the area and its primary next step. Remove placeholder, demo-only, contradictory, duplicated, or unfinished user-facing text unless it is explicitly part of an identified demo account.

## Interaction Contract

Interactive controls provide intentional default, hover, focus-visible, pressed, disabled, loading, success, and error states. Primary actions remain visually dominant; secondary and destructive actions are clearly differentiated. Controls must not move layout when labels or loading indicators change.

Transitions use transform and opacity where possible, avoid expensive layout animation, and respect `prefers-reduced-motion`. Existing anime.js and Motion ownership remains intact; refinement tunes their shared timings rather than replacing them.

Dialogs trap focus, identify themselves semantically, lock background interaction, close through documented controls, and restore focus to the invoking control. Dropdowns, menus, comboboxes, and popovers support keyboard operation, escape dismissal, outside-click behavior where appropriate, viewport collision handling, and accessible names.

## Responsive Contract

Each audited route is checked near 1440, 1024, 768, and 390 CSS pixels. Layouts may reflow, stack, collapse, or become intentionally scrollable, but must not clip content or create accidental document-level horizontal scrolling.

Tables and data-dense views use responsive card presentation, constrained internal scrolling with clear affordances, or prioritized columns. Dialogs and popovers stay inside the viewport. Tap targets remain at least 44 CSS pixels where practical. Fixed and sticky elements must not obscure content or compete with the mobile keyboard.

## Accessibility Contract

- A logical heading hierarchy and one clear page-level heading per screen
- Programmatic labels for form fields and accessible names for icon-only controls
- Visible keyboard focus without blanket suppression
- Semantic error association and live announcements without duplicated messages
- Dialog, menu, listbox, tab, and combobox semantics matching actual behavior
- Keyboard access to every meaningful action, including escape and arrow-key behavior where expected
- Focus trapping and restoration for modal surfaces
- Text and control contrast meeting WCAG AA for applicable sizes
- Readable base text and zoom-safe layouts
- Reduced-motion behavior that preserves comprehension

## Performance and Code Quality

Use route-level lazy loading for genuinely heavy, infrequently visited surfaces when it produces a measurable bundle or interaction benefit without destabilizing routing. Optimize oversized image delivery and defer non-critical media. Paginate or virtualize long lists only when current size and rendering evidence justify it.

Remove duplicated requests, avoid state effects that retrigger fetches unnecessarily, memoize only demonstrated expensive work, and remove unused code or development logging that reaches production. Console warnings and React warnings observed during normal flows are defects.

Do not introduce a new design framework, rewrite stable feature architecture, or create speculative abstractions.

## Audit and Implementation Sequence

1. Establish the route and state matrix, environment prerequisites, role access, and baseline health score evidence.
2. Capture rendered baselines and functional observations at the four target widths.
3. Inventory repeated visual and behavioral patterns in code and map them to shared foundations.
4. Fix critical and high-severity functional, accessibility, navigation, responsive, and console defects.
5. Consolidate shared tokens and components, then migrate only affected consumers.
6. Refine page hierarchy, interaction states, copy, empty states, and layout shifts.
7. Add targeted regression tests for every behavior changed.
8. Run route-by-route desktop and mobile QA again, fixing introduced regressions.
9. Run configured tests, linting, type checking, production build, and final console/accessibility checks.
10. Score the final product using the same severity-weighted rubric as the earlier 51/100 report and separate code defects from unavailable credentials, services, or data.

## Health Scoring

The baseline is the reported 51/100 score. The final report will preserve that comparison and list the scoring rubric used. Findings are classified as critical, high, medium, low, or cosmetic. A route or state blocked by unavailable Supabase, Resend, Stripe, Turnstile, Zoom, browser tooling, or test data is recorded as environment-blocked rather than silently counted as passing.

No critical issue may remain in the implemented scope. High-severity issues must be fixed unless they require external credentials or infrastructure; any such blocker must include exact configuration and reproduction evidence.

## Verification Evidence

The final evidence set includes:

- Route and major-state checklist for public, auth, onboarding, student, mentor, parent, and authorized admin surfaces
- Screenshots or equivalent rendered evidence at 1440, 1024, 768, and 390 pixels
- Keyboard navigation, focus visibility, modal trapping and restoration, error association, and icon-label checks
- Link, button, form, dialog, menu, popover, tab, and navigation checks
- Browser console check with no application errors or React warnings in verified flows
- Focused tests for changed behavior plus the full configured test suite
- Configured lint and type-check commands; if absent, the report states that explicitly rather than claiming success
- Successful production build
- Fresh post-implementation QA score compared with 51/100

## Non-Goals

- Rebranding Prelude or replacing its color palette
- Rebuilding the application in a new framework
- Changing authentication, billing, persistence, or routing contracts without a verified defect
- Removing features to simplify QA or implementation
- Broad database redesign unrelated to a verified refinement issue
- Cosmetic abstraction that does not improve consistency, accessibility, maintainability, or user comprehension

## Completion Criteria

The pass is complete when every reachable major route and state has recorded verification evidence, all critical in-scope findings are fixed, no regression remains in changed flows, production build succeeds, configured quality checks have been run, and the final report documents improvements, files changed, shared-system work, tests, score comparison, and external configuration blockers.
