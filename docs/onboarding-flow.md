# Prelude onboarding flow

This document describes the first-time account setup path for Supabase-backed Prelude accounts.

## Canonical routing

All post-auth routing decisions flow through `src/lib/onboardingRoutes.js`:

1. `/onboarding/role` when `role_selection_complete` is false (common for Google OAuth)
2. `/onboarding/match` for students who still need Prelude Match
3. `/onboarding/match?step=result` when a mentor suggestion exists but no decision was saved
4. `/onboarding/parent` for students who have not finished the parent invite step
5. `/onboarding/payment` for students who have not completed paid checkout
6. Dashboard home for completed users

Parent invite details (API routes, email delivery, Supabase schema): see
[`docs/parent-invites.md`](./parent-invites.md).

`postAuthDestination(user)` is the single source of truth for the next required step.

## Student onboarding order

```text
register / OAuth
  → verify email
  → verify login
  → role (OAuth only)
  → Prelude Match
  → parent invite (optional)
  → plan selection + Stripe checkout
  → dashboard
```

Students cannot access `/dashboard/*` until `onboarding_progress.payment_step_completed = true`.

## Payment step behavior

- Route: `/onboarding/payment` with deep links at `/onboarding/payment/:planId`
- UI: Prelude wallet with all three paid tiers (`basic`, `plus`, `pro`)
- Navigation: back goes to `/onboarding/parent` only — no dashboard/home escape hatches
- Checkout: choosing a plan redirects to Stripe Checkout via `/api/billing/checkout`
- Completion: Stripe webhook and `/api/billing/confirm-session` set:
  - `profiles.plan_id`
  - `onboarding_progress.payment_step_completed = true`
  - `onboarding_progress.onboarding_status = 'onboarding_completed'`

Checkout return URLs:

- Success: `/checkout/success?plan=<id>&context=onboarding&session_id=...`
- Cancel: `/checkout/cancel?plan=<id>&context=onboarding`

## Navigation guards

- `RequireOnboardingAccess` prevents URL skipping and redirect loops on `/onboarding/*`
- `RequirePlanGuard` uses `canAccessDashboard(user)` so incomplete students cannot open `/dashboard/*` directly

## Shared UI + draft state

- `src/components/onboarding/OnboardingShell.jsx` provides progress, back/continue actions, and responsive layout
- `src/lib/onboardingFlow.js` stores non-destructive draft state in `localStorage` under `prelude_onboarding_draft_{userId}`
- Payment step hides the global home link so students stay in the onboarding funnel

## Plan wallet

The plan wallet (`/onboarding/payment`, legacy `/onboarding/plan`, and public `/plans`) renders in
`src/components/PlanSelectionPage.jsx`:

- Interaction rules live in a pure state machine, `src/lib/planWalletMachine.js`
  (`closed → opening → open → selectingCard → popupOpening → popupOpen → popupClosing → closing`).
  It guarantees a single popup, no card selection while hidden, no wallet close while the
  popup is open, no close interruption while a selected card is transitioning to details,
  and last-selection-wins under rapid clicks.
- The wallet has an explicit in-wallet Open/Close control; the Close state is disabled
  while details are opening or visible.
- Plan data comes exclusively from `src/lib/plans.js`; the popup shows the full feature
  list in a scrollable body with a fixed action footer (“Continue to checkout” on the
  payment step, “Select this plan” elsewhere).
- On the payment step, “Continue to checkout” calls `startOnboardingBillingCheckout`.
  The public page calls `startBillingCheckout`.
- The wallet footer shows the Prelude Consulting logo/name and the authenticated user's
  email (falls back to “Guest”).
- Deep links `/plans/:planId`, `/onboarding/plan/:planId`, and `/onboarding/payment/:planId`
  redirect to the wallet with the matching popup open (`?wallet=open&selected=<id>&details=open`).
- Styles: `src/styles/plan-wallet.css` (`pw-` prefix). Motion durations are mirrored in
  `MOTION_MS` inside the page component; `prefers-reduced-motion` collapses them.

## Database

Run `supabase/migrations/20260704000000_onboarding_payment.sql` to add:

- `onboarding_progress.payment_step_completed`
- `onboarding_progress.pending_checkout_plan_id`
- `profiles.stripe_customer_id`, `profiles.stripe_subscription_id`, `profiles.subscription_status`
- `onboarding_status = 'needs_payment'`

Existing completed students with a saved plan are grandfathered into `payment_step_completed = true`.

## Google OAuth recreation

Run `supabase/migrations/20260701000000_onboarding_oauth_fixes.sql` in Supabase if you have not deployed it yet.

That migration fixes three production blockers:

1. **Profile metadata updates before role selection** — OAuth users can backfill `email`, `full_name`, and `avatar_url` without tripping `profiles_role_guard`
2. **Expanded account deletion** — `delete_own_account()` removes onboarding, mentor, settings, and profile rows before deleting `auth.users`
3. **Fresh user seeding** — `handle_new_user()` seeds `onboarding_progress`, `user_settings`, and role-specific profile tables idempotently

Client-side cleanup on deletion:

- `clearLocalUserData(userId, email)`
- `clearSupabaseAuthStorage()`
- immediate `signOut()`

## Manual verification checklist

1. Google signup → role → match → parent → payment → Stripe checkout → dashboard
2. Back/forward across every step with answers preserved
3. Refresh on every step
4. Cancel Stripe checkout → returns to `/onboarding/payment` only
5. Successful checkout → auto-activates account and lands on dashboard
6. Returning completed user goes directly to dashboard

## Tests

```bash
npm run test
```

Focused coverage lives in:

- `tests/onboardingRoutes.test.js`
- `tests/onboardingFlow.test.js`
- `tests/onboardingPayment.test.js`
- `tests/planWalletMachine.test.js`
