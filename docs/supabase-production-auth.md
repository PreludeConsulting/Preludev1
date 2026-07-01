# Supabase production auth runbook

Prelude production auth uses Supabase Auth in the browser plus Cloudflare Pages Functions for the custom six-digit post-login verification email. Do not add Supabase service-role keys, Resend keys, SMTP passwords, or login-code secrets to any `VITE_` variable.

## Production architecture

- Browser auth client: `src/lib/supabase.js`
- Auth flows and OAuth callback handling: `src/lib/supabaseAuth.js`
- Auth session provider and verification gate: `src/context/AuthContext.jsx`
- Six-digit verification client: `src/lib/loginVerification.js`
- Cloudflare Pages Functions backend: `functions/api/auth/*`
- Shared Cloudflare login-code implementation: `functions/_lib/loginVerification.js`
- Local/Vite development middleware: `server/supabaseLoginVerificationApi.js`
- Required Supabase tables and RLS: `supabase/migrations/20260629000000_login_verification_trusted_devices.sql`

## Cloudflare Pages variables

Set these in Cloudflare Pages for production:

```env
PUBLIC_APP_URL=https://preludeconsultingllc.com
VITE_PUBLIC_APP_URL=https://preludeconsultingllc.com
VITE_SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
LOGIN_CODE_SECRET=...
RESEND_API_KEY=re_...
AUTH_EMAIL_FROM=Prelude <no-reply@preludeconsultingllc.com>
VITE_TURNSTILE_SITE_KEY=0x...
```

`VITE_SUPABASE_URL` and `SUPABASE_URL` intentionally duplicate the same Supabase project URL for different runtimes: the `VITE_` value is public browser config, and the non-`VITE_` value is server-side Cloudflare Function config.

Generate `LOGIN_CODE_SECRET` with a password manager or:

```bash
openssl rand -base64 48
```

## Supabase dashboard settings

Authentication URL configuration:

- Site URL: `https://preludeconsultingllc.com`
- Redirect URLs:
  - `https://preludeconsultingllc.com/**`
  - `https://preludev1.pages.dev/**`
  - `http://localhost:5173/**`

Google provider:

- Enable Google under Authentication providers.
- In Google Cloud OAuth, include Supabase's callback URL shown in the provider panel.
- Prelude sends users to `/auth/callback?next=...`; Supabase must allow the app URLs above.

Built-in Supabase auth email:

- Configure Supabase Auth SMTP with Resend for optional fallback delivery.
- Prelude sends **signup verification links through Resend directly** via `POST /api/auth/send-signup-verification` (Supabase admin `generateLink` + Prelude HTML email). Links point to `https://your-domain/verify-email?token_hash=...&type=signup`.
- Prelude sends **password reset links through Resend directly** via `POST /api/auth/request-password-reset` (Supabase admin `generateLink` + Prelude HTML email). Email links point to `https://your-domain/reset-password?token_hash=...&type=recovery` (not Supabase `action_link`) so scanners are less likely to consume the token and users always land on the reset page.
- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: Resend API key
- Sender: `Prelude <no-reply@preludeconsultingllc.com>`

Turnstile:

- In Cloudflare Turnstile, the site key goes into `VITE_TURNSTILE_SITE_KEY`.
- In Supabase Authentication attack protection, the Turnstile secret goes into the Supabase CAPTCHA secret field.
- The site key and secret are different values.

## Required Supabase SQL

Run the app schema setup first, then run the login verification migration:

```sql
-- Supabase SQL Editor:
-- paste and run supabase/setup-auth.sql
-- paste and run supabase/setup-dashboard.sql
-- paste and run supabase/setup-storage.sql
-- paste and run supabase/migrations/20260629000000_login_verification_trusted_devices.sql
```

Verify these tables exist and have RLS enabled:

```sql
select to_regclass('public.login_verification_challenges') as login_verification_challenges;
select to_regclass('public.trusted_devices') as trusted_devices;
select to_regclass('public.login_assurances') as login_assurances;
```

If production shows `login_verification_storage_missing`, the Cloudflare Function is reachable, but the login verification migration has not been applied to that Supabase project.

## Production smoke test

1. Register a new account and confirm the Supabase email.
2. Log in with email and password.
3. Confirm `/verify-login` sends a six-digit Prelude code through Resend.
4. Enter the code and verify dashboard access.
5. Log out and log back in on the same browser; trusted device should skip the code for 30 days.
6. Test Google login and confirm it lands on `/auth/callback` before verification/dashboard routing.
7. Test forgot password and reset password from the email link.

