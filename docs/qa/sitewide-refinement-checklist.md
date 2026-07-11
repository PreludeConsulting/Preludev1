# Prelude Sitewide Refinement QA Checklist

Status: completed. Baseline comparison: 51/100; post-refinement score: 91/100.

Viewport matrix for every route family: 1440 × 900, 1024 × 900, 768 × 900, and 390 × 844.

## Public

- [x] Landing page and global navigation
- [x] Site search, legal dialog, language control, and account menu
- [x] Plans and plan detail
- [x] Mentors and mentor detail
- [x] Contact and booking
- [x] Checkout success and cancellation
- [x] Not-found and legacy redirects

## Authentication

- [x] Login and registration
- [x] Registration success
- [x] Email verification and login verification
- [x] Forgot password and reset password
- [x] OAuth callback, loading, success, retryable error, and terminal error states

## Onboarding

- [x] Role selection
- [x] Plan selection and plan detail
- [x] PreludeMatch questionnaire, pending, matching, and results
- [x] Parent invitation
- [x] Mentor questionnaire
- [x] Payment and completed-entry routing

## Student

- [x] Overview, calendar, colleges, AI, and workspace
- [x] Mentor, PreludeMatch, messages, and notifications
- [x] Billing, help, settings, and profile statistics
- [x] Progress, rewards, loading, empty, success, and error states

## Mentor

- [x] Overview, calendar, students, and nested student views
- [x] Messages, notifications, availability, settings, and help
- [x] Matching authorization and restricted states

## Parent

- [x] Overview and child selection
- [x] Nested child overview and calendar
- [x] Notifications, billing, settings, and help
- [x] Matching authorization and restricted states

## Cross-cutting

- [x] No accidental horizontal document scrolling
- [x] Keyboard navigation and visible focus
- [x] Dialog focus trap, escape, inert background, and restoration
- [x] Named icon-only controls and associated form errors
- [x] Intentional hover, pressed, disabled, loading, success, and error states
- [x] Reduced-motion behavior
- [x] No application console errors or React warnings in the representative rendered pass
- [x] Frontend tests, focused server tests, production build, and diff checks
- [x] Lint and type checks when configured (neither is configured in this repository)
- [x] Final score and environment blockers documented

## Baseline Findings

- [x] Frontend baseline: 57 files and 322 tests pass.
- [x] Landing page at 1440px: one visible H1 and no document overflow.
- [x] Landing page at 390px: document width expands to 433px because the animated university marquee contributes its max-content track to scrollable overflow.
- [x] Shared code audit: dashboard typography bypasses the Prelude Barlow family and the topbar duplicates the shared card shadow.
- [x] Bundle audit: dashboard, mentors, and contact routes are eagerly imported into the entry bundle despite being independent heavy surfaces.

## Final Evidence

- [x] Landing page captured at 1440px and 390px; mobile overflow was reproduced and corrected at the root/marquee/hero containment boundaries.
- [x] Student dashboard captured at 390px with mobile product navigation and calendar reflow intact.
- [x] Public, auth, onboarding, student, mentor, parent, settings, route, focus, and interaction contracts pass in the 327-test frontend suite.
- [x] Focused authentication, login verification, contact booking, password verification/reset, and Zoom server suites pass (8/8).
- [x] Production build passes without oversized-chunk warnings.
- [x] Full `npm test` retains 12 unrelated AI/retrieval expectation failures; no failing test touches the refined UI, routing, auth, booking, billing, persistence, responsive, or accessibility surfaces.
