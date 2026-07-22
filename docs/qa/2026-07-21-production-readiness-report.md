# Prelude production-readiness report — 2026-07-21

## Release status

The application code, automated test suites, local Chromium/WebKit browser checks, production build, and dependency audit pass. Production infrastructure still requires deployment-owner actions listed under “External verification.”

## Product and navigation

- The central plan catalog owns plan names, descriptions, prices, features, billing highlights, session entitlements, and related benefits. `planBadges.js` is the sole badge-label dictionary: Plus is **Most Popular** and Pro is **Best Value** in every supported locale.
- `shared/appRouteRegistry.js` is the executable map for public routes, landing sections, dashboard role bases, and global actions. Top/logo/About behavior is hash-free; deliberate landing sections retain shareable hashes.
- Landing search, navbar, cross-route sections, legacy routes, dashboard fallbacks, dialogs, empty states, icon labels, and mobile overflow behavior have regression coverage.
- Disabled placeholder attachment and emoji controls were removed. Production-visible development notes were removed from mentor browsing.

## Motion and rendering

- Motion policy exposes full, lite, and reduced tiers based on capability and preference signals rather than user-agent checks.
- Persistent animation work is gated by viewport and document visibility. Timers, observers, Motion subscriptions, RAF work, and Anime timelines have deterministic cleanup and pause/resume behavior.
- Hero, focus, carousel, chat, marquee, cost banner, Aura cursor, loading progress, and decorative effects use transform/opacity paths or static final states in constrained tiers.
- Persistent `will-change`, fixed backgrounds, layout-based progress animation, production per-frame diagnostic mutations, and overlapping landing scroll RAF work were removed.

## Backend and authorization

- Protected Supabase-backed APIs resolve the authenticated user and role server-side. Mentor availability writes reject non-mentors, meeting operations enforce participant ownership, and session credits are resolved from trusted purchase records.
- Production JSON fallback stores fail closed when a durable database is unavailable.
- Login assurance is bound to the bearer session in production; trusted-origin, JWT, redirect, and billing-host configuration fail closed.
- AI requests enforce message/body limits, keep client profile text outside system instructions, and use database-backed profile facts as authoritative.
- The guarded admissions dispatcher handles safety, conversation, school facts, structured admissions, comparisons, and general retrieval in deliberate precedence. Guarantee requests bypass retrieval.

## Security and database policy review

Migration `supabase/migrations/20260721000000_production_security_hardening.sql`:

- adds explicit entitlement/payment mutation guards and column grants;
- restricts promo-code administration to trusted server execution;
- requires mentor approval and authorized student/mentor/parent relationships;
- protects private chat attachments and session-package records with RLS;
- repairs account-deletion policy behavior.

The web deployment adds CSP, HSTS, frame, MIME-sniffing, referrer, and permissions headers. CORS/trusted origins, JWT secrets, production durable stores, Stripe webhook signature/idempotency behavior, file path authorization, and dependency vulnerability contracts are covered by automated tests.

This was a code and configuration security review, not a third-party penetration test or compliance certification.

## Automated verification

| Gate | Result |
| --- | --- |
| `npm run lint` | Pass, zero warnings |
| `npm run typecheck` | Pass for release-critical JS contracts |
| `npm test` | Pass: 518 Vitest + 228 Node server tests + API-route checks |
| `npm run test:e2e` | Pass: 31, skipped: 2 project-inapplicable mobile geometry cases |
| `npm run build` | Pass |
| `npm audit --audit-level=moderate` | Pass: zero vulnerabilities |
| `git diff --check` | Pass |

The TypeScript gate intentionally covers release-critical JavaScript contracts in `tsconfig.json`; it is not represented as a whole-repository strict conversion. ESLint covers application, API, worker, shared, scripts, and tests, including core correctness and React Hooks rules.

Playwright exercised `/`, `/plans`, `/mentors`, `/contact`, `/register`, `/forgot-password`, `/verify-email`, and the not-found route in desktop Chromium, desktop WebKit, and mobile Chromium. It verified render health, console/page errors, dead anchors, pricing badge semantics, clean landing-top URLs, and mobile horizontal overflow. Unit and integration suites cover authentication, onboarding, dashboard roles, billing, settings, messaging, matching, permissions, API routing, RLS contracts, and hostile-input/security cases.

## External verification

- The security migration could not be applied to a live Supabase project locally because Docker and production database credentials were unavailable. Apply it in a reviewed staging project, approve existing legitimate mentor profiles, run the Supabase policy tests against that project, then promote it.
- WebKit passed locally, but this is not a native Safari-device certification. A native Safari smoke test still requires access to the target macOS/Safari environment.
- Native Windows Chrome/Edge and display-scaling tests were not run, per the product owner’s explicit instruction not to test Windows in this pass. Capability-based lite-mode contracts and Chromium animation tests passed locally.
- Live email, OAuth, Stripe, storage, and production AI-provider transactions require the deployment’s third-party credentials and webhook endpoints. Automated contracts fail closed when those values are absent.
