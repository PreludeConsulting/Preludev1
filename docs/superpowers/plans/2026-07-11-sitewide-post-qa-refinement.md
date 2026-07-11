# Prelude Sitewide Post-QA Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a cohesive, accessible, responsive, production-quality Prelude experience across every major public, authentication, onboarding, student, mentor, and parent route.

**Architecture:** Refine the existing product in place: first measure rendered and code-level inconsistencies, then strengthen shared tokens and existing primitives, migrate only affected consumers, and verify every changed behavior. Preserve existing routing, authentication, persistence, billing, role, motion, and branding contracts.

**Tech Stack:** React 18, React Router 6, Vite 8, Vitest, Happy DOM, Supabase, CSS custom properties, Motion, anime.js.

## Global Constraints

- Keep Prelude's existing color palette and recognizable layouts.
- Do not remove features, rewrite stable architecture, or change backend contracts without a verified defect.
- Prefer shared fixes over route-specific CSS patches.
- Respect reduced motion and retain visible keyboard focus.
- Validate near 1440, 1024, 768, and 390 CSS pixels.
- Keep all critical flows working while environment-blocked states remain explicit.

---

### Task 1: Baseline route, state, and quality audit

**Files:**
- Modify: `docs/qa/sitewide-refinement-checklist.md`
- Inspect: `src/main.jsx`, `src/dashboard/DashboardRouter.jsx`, public/auth/onboarding/dashboard route components

**Interfaces:**
- Consumes: Route definitions, demo identities, development auth bypass, prior QA artifacts.
- Produces: Severity-ranked route/state matrix and reproducible findings used by Tasks 2–6.

- [ ] Inventory every reachable route and major state by role.
- [ ] Run the configured baseline frontend tests and production build; record pre-existing failures separately.
- [ ] Start the local application using supported development mocks/bypass.
- [ ] Inspect public and auth routes at 1440, 1024, 768, and 390 widths.
- [ ] Inspect student, mentor, and parent routes and major modal/popover states.
- [ ] Record console warnings, overflow, broken actions, accessibility failures, copy inconsistencies, and shared visual drift.
- [ ] Assign baseline severity and preserve the prior 51/100 comparison.

### Task 2: Shared foundation and interaction contract

**Files:**
- Modify: `src/index.css`, `src/components/interaction/interaction.css`, `src/dashboard/dashboard.css`
- Modify only as evidence requires: `src/components/ui/button.jsx`, `src/components/ui/DropdownMenu.jsx`, `src/components/ui/PopoverPortal.jsx`, `src/dashboard/components/ui/*`
- Test: `tests/designSystemContract.test.js`, existing interaction/focus tests

**Interfaces:**
- Consumes: Existing root spacing, radius, shadow, control, focus, and motion tokens.
- Produces: Stable shared token aliases and consistent control/card/dialog/alert behavior.

- [ ] Write failing contract tests for verified repeated inconsistencies.
- [ ] Confirm failures represent missing shared behavior rather than snapshot churn.
- [ ] Consolidate only the token and primitive rules required by findings.
- [ ] Normalize hover, pressed, focus-visible, disabled, loading, error, and success behavior.
- [ ] Verify reduced-motion overrides and minimum interaction targets.
- [ ] Run focused tests and `git diff --check`.

### Task 3: Public, authentication, plans, contact, and onboarding refinement

**Files:**
- Modify as findings require: `src/components/*`, `src/components/auth/*`, `src/components/onboarding/*`
- Modify: `src/styles/auth.css`, `src/styles/contact.css`, `src/styles/onboarding-flow.css`, `src/styles/plan-wallet.css`, `src/landing-ui.css`
- Test: route, auth, onboarding, plan, contact, focus, and responsive contract tests

**Interfaces:**
- Consumes: Task 2 shared foundations.
- Produces: Cohesive public-to-product journey with stable responsive and state behavior.

- [ ] Add failing tests for each verified functional, semantic, or content defect.
- [ ] Fix public navigation, search, landing hierarchy, plans, mentor, contact, and booking findings.
- [ ] Fix auth form, verification, reset, loading, success, and error-state findings without changing auth contracts.
- [ ] Fix onboarding and PreludeMatch layout, navigation, feedback, and reduced-motion findings.
- [ ] Verify every public/auth/onboarding route at all four widths and by keyboard.

### Task 4: Student dashboard refinement

**Files:**
- Modify as findings require: `src/dashboard/pages/student/*`, `src/dashboard/pages/shared/*`, `src/dashboard/components/product/*`, `src/dashboard/components/chat/*`, `src/dashboard/dashboard.css`
- Test: student route, calendar, college, messaging, rewards, settings, billing, and modal tests

**Interfaces:**
- Consumes: Shared foundations and existing dashboard data contexts.
- Produces: Consistent student overview, calendar, colleges, AI, workspace, mentor, messaging, progress, rewards, settings, and billing experience.

- [ ] Add failing tests for verified student-flow defects.
- [ ] Fix hierarchy, primary actions, empty/loading/error states, responsive overflow, dialogs, menus, and copy.
- [ ] Remove demonstrated duplicate requests/rerenders and unused production warnings.
- [ ] Verify route navigation, forms, keyboard behavior, responsive layouts, and console output.

### Task 5: Mentor and parent dashboard refinement

**Files:**
- Modify as findings require: `src/dashboard/pages/mentor/*`, `src/dashboard/pages/parent/*`, shared product/settings/chat components, `src/dashboard/dashboard.css`
- Test: mentor, parent, child-view, calendar, availability, messaging, billing, settings, and modal tests

**Interfaces:**
- Consumes: Task 2 foundations and shared dashboard patterns validated in Task 4.
- Produces: Clear role-specific navigation and cohesive mentor/parent workflows without weakening role boundaries.

- [ ] Add failing tests for verified mentor and parent defects.
- [ ] Fix navigation clarity, student/child context, primary actions, state feedback, responsive behavior, and copy.
- [ ] Verify nested student/child routes, forms, modals, keyboard behavior, and console output.

### Task 6: Performance, accessibility, and code-quality closure

**Files:**
- Modify as evidence requires: route entry points, large asset consumers, long-list components, shared accessibility utilities
- Test: accessibility, focus trap, route loading, and performance contract tests

**Interfaces:**
- Consumes: All implemented route and component changes.
- Produces: No critical accessibility/performance regressions and documented external blockers.

- [ ] Audit route bundle composition and introduce lazy loading only for measurable heavy-route wins.
- [ ] Check image sizing/loading, long-list bounds, duplicate requests, and production console statements.
- [ ] Verify headings, labels, live regions, icon names, focus trapping/restoration, contrast, zoom safety, and reduced motion.
- [ ] Run focused tests after every correction.

### Task 7: Full re-QA, scoring, and documentation

**Files:**
- Modify: `docs/qa/sitewide-refinement-checklist.md`
- Modify: `docs/qa/2026-07-11-sitewide-refinement-report.md`

**Interfaces:**
- Consumes: Completed implementation and baseline findings.
- Produces: Final route evidence, score comparison, changed-file inventory, and deployment/configuration blockers.

- [ ] Re-run every major route and state at all four widths.
- [ ] Re-run keyboard, modal, popover, form, navigation, and console checks.
- [ ] Run all focused tests, full frontend tests, server tests, configured lint/type checks, production build, and `git diff --check`.
- [ ] Classify unrelated baseline test failures separately from regressions.
- [ ] Calculate the final health score using the documented severity rubric and compare it with 51/100.
- [ ] Complete the checklist and final report with meaningful improvements, files changed, shared-system changes, validation evidence, and external requirements.
