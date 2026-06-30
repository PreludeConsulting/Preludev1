# Prelude onboarding flow

This document describes the first-time account setup path for Supabase-backed Prelude accounts.

## Canonical routing

All post-auth routing decisions flow through `src/lib/onboardingRoutes.js`:

1. `/onboarding/role` when `role_selection_complete` is false (common for Google OAuth)
2. `/onboarding/plan` for students without a saved plan
3. `/onboarding/mentor` for mentors without a completed questionnaire
4. `/onboarding/match` for students who still need Prelude Match
5. `/onboarding/match?step=result` when a mentor suggestion exists but no decision was saved
6. `/onboarding/parent` for students who have not finished the parent invite step
7. Dashboard home for completed users

`postAuthDestination(user)` is the single source of truth for the next required step.

## Navigation guards

- `RequireOnboardingAccess` prevents URL skipping and redirect loops on `/onboarding/*`
- `RequirePlanGuard` uses `canAccessDashboard(user)` so incomplete students cannot open `/dashboard/*` directly

## Shared UI + draft state

- `src/components/onboarding/OnboardingShell.jsx` provides progress, back/continue actions, and responsive layout
- `src/lib/onboardingFlow.js` stores non-destructive draft state in `localStorage` under `prelude_onboarding_draft_{userId}`
- Plan selection also writes the confirmed plan to `profiles.plan_id` and `prelude_plan_{userId}`

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

1. Google signup → role → wallet plan → match → parent → dashboard
2. Back/forward across every step with answers and selected plan preserved
3. Refresh on every step
4. Delete account → Google signup again with the same Gmail → fresh onboarding with no stale data
5. Returning completed user goes directly to dashboard

## Tests

```bash
npm run test
```

Focused coverage lives in:

- `tests/onboardingRoutes.test.js`
- `tests/onboardingFlow.test.js`
