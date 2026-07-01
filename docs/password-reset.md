# Password reset

Prelude implements a secure, anti-enumeration password recovery flow for both **Supabase Auth** (production) and the **legacy Prisma/JWT** stack (local development).

## User journey

1. **Request** — `/forgot-password` collects the account email and (in production) a Turnstile CAPTCHA.
2. **Generic response** — The UI always shows: *“If an account exists with this email, a password reset link has been sent.”* No hint is given when the email is unknown.
3. **Email** — Known accounts receive a Resend-delivered HTML email with a **Reset password** button and a plain-text fallback link.
4. **Reset** — `/reset-password` verifies the one-time recovery token, shows new/confirm password fields with live strength feedback, and redirects to `/login?reset=success` after a successful update.

## Security properties

| Property | Supabase (production) | Legacy Prisma |
|----------|----------------------|---------------|
| Email enumeration | Generic message; no email sent when `generateLink` fails for unknown users | Generic message; email only sent when `users` row exists |
| Token storage | Supabase Auth OTP (`token_hash` in link) | SHA-256 hash in `password_reset_tokens` |
| Expiry | Supabase project OTP setting (configure **15–60 min** in dashboard) | **30 minutes** (`LEGACY_RESET_TOKEN_MINUTES`) |
| Single use | Supabase invalidates OTP after exchange/update | Token `status` set to `USED`; prior `ACTIVE` tokens revoked on new request |
| Rate limit | **5 requests / hour / IP** on `POST /api/auth/request-password-reset` | **5 requests / hour / IP** on `POST /api/auth/request-reset` |
| Password rules (reset) | ≥ 8 chars, upper, lower, **number or special character** | ≥ 12 chars + full complexity (see `shared/passwordValidation.js`) |
| Same-password guard | Ephemeral sign-in probe + Supabase `updateUser` error mapping | `argon2.verify` before hash update |
| Session cleanup | `logOut()` after successful reset | All sessions/refresh tokens revoked; cookies cleared |

## API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/auth/request-password-reset` | Supabase: generate recovery link + send Resend email |
| `POST` | `/api/auth/request-reset` | Legacy: create `password_reset_tokens` row + send email |
| `POST` | `/api/auth/reset-password` | Legacy: validate token, hash password, invalidate token |

## Key files

| Area | Path |
|------|------|
| Forgot password UI | `src/components/AuthPages.jsx` (`ForgotPasswordPage`) |
| Reset password UI | `src/components/auth/ResetPasswordPage.jsx` |
| Supabase client auth | `src/lib/supabaseAuth.js` (`resetPassword`, `initializePasswordRecovery`, `completePasswordReset`) |
| Recovery URL builder | `shared/authRecoveryLink.js` |
| Password rules | `shared/passwordValidation.js`, `shared/passwordSameness.js` |
| Shared copy/constants | `shared/passwordResetConstants.js` |
| Supabase reset API | `server/supabasePasswordResetApi.js`, `server/lib/supabasePasswordReset.js` |
| Legacy reset API | `server/authApi.js` |
| Email delivery | `server/lib/authEmail.js` |
| IP rate limiting | `server/lib/ipRateLimit.js` |

## Email links (Supabase)

Prelude **does not** use Supabase’s raw `action_link` in emails. `buildPasswordResetEmailUrl` always emits a direct app link:

```
https://<PUBLIC_APP_URL>/reset-password?token_hash=<hash>&type=recovery
```

If Supabase still redirects a recovery session to `/?token_hash=...&type=recovery`, `public/auth-recovery-redirect.js` (loaded before React) and `AuthLandingRedirect` forward the user to `/reset-password` with the same query string.

## Required environment variables (production)

```env
PUBLIC_APP_URL=https://your-domain.com
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...
AUTH_EMAIL_FROM=Prelude <no-reply@your-domain.com>
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_TURNSTILE_SITE_KEY=...
```

Also configure Supabase **Redirect URLs** and set **OTP expiry** (Authentication → Email → Password recovery) to 15–60 minutes.

## Error handling

| Scenario | User-facing behavior |
|----------|---------------------|
| Unknown email | Generic success message (no email sent) |
| Expired/invalid link | Reset page “Reset link expired” state + request new link CTA |
| Passwords do not match | Inline confirm-field error |
| Weak password | Requirement checklist + submit disabled |
| Same as current password | Inline password error (Supabase + legacy) |
| Rate limited | “Too many attempts…” (429) |

## Tests

```bash
npm test -- tests/passwordValidation.test.js tests/passwordSameness.test.js tests/ipRateLimit.test.js tests/authEmail.test.js tests/authRecoveryLink.test.js
node --test tests/server/supabasePasswordReset.node.test.js tests/server/authApi.node.test.js
```

## Manual QA

1. Visit `/forgot-password`, submit a known email → check inbox (or dev server log when Resend is not configured).
2. Open the link → confirm URL params are scrubbed and the reset form appears.
3. Submit mismatched passwords, weak passwords, and the current password — confirm inline errors.
4. Submit a valid new password → redirected to `/login?reset=success`.
5. Re-use the same email link → expired/invalid state.
6. Submit an unknown email on forgot-password → same generic message, no email.
