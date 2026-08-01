# Prelude Authentication Experience

Prelude auth uses one browser Supabase client from `src/lib/supabase.js` and one React provider from `src/context/AuthContext.jsx`.

## Browser flows

- Email/password login starts in `/login`, restores the Supabase session, then runs six-digit login verification unless the current trusted-device cookie is valid.
- Google OAuth starts with PKCE and returns to `/auth/callback`. The callback page captures `next`, scrubs raw callback parameters from the URL, exchanges the code once, restores the app user, and then routes through login verification or onboarding.
- Email signup routes to `/verify-email`, where the user enters the six-digit
  `{{ .Token }}` from Supabase's Confirm signup email. The page preserves only
  the signup email, verifies with `verifyOtp`, refreshes the app user and
  database onboarding state, and routes to the next incomplete step.
- Password recovery returns to `/reset-password`. The page captures recovery parameters first, cleans the URL, exchanges the recovery session, and only enables password update after Supabase confirms a recovery session. Users enter and confirm a new password with live strength and match feedback; the new password must differ from the current one (ephemeral sign-in probe on Supabase, argon2 verify on legacy) and the temporary recovery session is cleared after a successful update. See `docs/password-reset.md` for the full security contract.
- Registration supports Google OAuth and email signup, requires role selection,
  handles duplicate/unconfirmed accounts, and exposes Supabase signup-code
  resend with cooldown state.

## UX contract

- Auth pages share `Shell` in `src/components/AuthPages.jsx`.
- Route guards use `AuthLoadingState` instead of plain text loaders to avoid white flashes and dashboard flashes during session restoration.
- Callback, verification, and recovery links do not leave raw `code`, `token_hash`, `access_token`, or provider error parameters visible.
- Motion uses short fade/vertical movement and disables transitions under `prefers-reduced-motion: reduce`.
- Production-facing Supabase errors are normalized through `friendlyAuthError` and `friendlyProviderError`.

## Verification

Run:

```bash
npm run build
npm test -- tests/authExperience.test.js
```

For live QA, start Vite and visit `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/verify-login`, and `/auth/callback?error=access_denied`. Confirm desktop and mobile layouts, keyboard focus, reduced-motion behavior, and URL scrubbing.
