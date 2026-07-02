# Supabase Auth — Manual Setup Checklist

This project uses **Supabase Auth** for production login, registration, email
confirmation, password reset, Google OAuth, session restoration, and dashboard
access. The custom six-digit post-login verification code is sent by the
Prelude backend through Resend after Supabase creates the authenticated session.

For the current production runbook, including Cloudflare Pages variables,
Google OAuth redirects, Resend SMTP, Turnstile, and the login-verification SQL
migration, see [`docs/supabase-production-auth.md`](./docs/supabase-production-auth.md).

A few steps **cannot** be done from code and must be completed by you in the
Supabase Dashboard. (Cursor can't click through the Supabase dashboard unless
browser automation is explicitly enabled, and it was not.) Do the steps below.

---

## 0. Create / open your Supabase project

1. Go to <https://supabase.com/dashboard> and open (or create) your project.

---

## 1. Run the SQL setup

1. Open **Supabase Dashboard**.
2. Go to **SQL Editor**.
3. Paste the entire contents of [`supabase/setup-auth.sql`](./supabase/setup-auth.sql).
4. Click **Run**.
5. Paste and run [`supabase/setup-dashboard.sql`](./supabase/setup-dashboard.sql) for per-user dashboard tables (preferences, events, messages, notifications, resources, mentor matches, onboarding progress).
6. Paste and run [`supabase/setup-storage.sql`](./supabase/setup-storage.sql) for profile avatar uploads (Storage bucket + RLS).
7. Paste and run [`supabase/migrations/20260629000000_login_verification_trusted_devices.sql`](./supabase/migrations/20260629000000_login_verification_trusted_devices.sql) for six-digit login verification challenges, trusted devices, and login assurance cookies.

**If profile or onboarding saves fail** with `Could not find the table public.onboarding_progress in the schema cache`, run the focused migration:

8. Paste and run [`supabase/migrations/20260616000000_onboarding_progress.sql`](./supabase/migrations/20260616000000_onboarding_progress.sql) — creates `onboarding_progress`, backfills existing users, and reloads the API schema cache.

**If PreludeMatch returns no mentors** for students even though mentor profiles exist, run:

9. Paste and run [`supabase/migrations/20260702000000_mentor_matching_student_visibility.sql`](./supabase/migrations/20260702000000_mentor_matching_student_visibility.sql) — lets authenticated students read mentor matching profiles once `display_name`, `college`, and `major` are set (even before the mentor questionnaire is marked `completed`). See [`docs/mentor-selection-flow.md`](./docs/mentor-selection-flow.md).

**If forgot-password does not send an email** in production, confirm Cloudflare Pages has `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, and `AUTH_EMAIL_FROM` set. Prelude sends reset links through Resend via `POST /api/auth/request-password-reset` (see [`docs/supabase-production-auth.md`](./docs/supabase-production-auth.md)).

If login reaches `/verify-login` and then fails with `login_verification_storage_missing`, run the login-verification migration from step 7 in the Supabase project connected to production.

10. Verify tables exist: **Table Editor → onboarding_progress**, **profiles**, **login_verification_challenges**, **trusted_devices**, and **login_assurances**.
11. Verify **Row Level Security is enabled** (the `profiles` table shows an
   "RLS enabled" badge). You can also run:
   ```sql
   select relrowsecurity from pg_class where oid = 'public.profiles'::regclass; -- true
   ```

This creates `public.profiles`, links it to `auth.users`, enables RLS, adds
owner read/update policies, blocks self-promotion to `admin`, and installs a
secure trigger that auto-creates a profile row (reading `full_name` and `role`
from signup metadata, defaulting to `student`).

---

## 2. Environment variables (`.env.local`)

A `.env.local` file was created for you with **blank placeholders**. It is
git-ignored, so your keys never get committed.

**Where to find the values:** Supabase Dashboard → **Project Settings → API**:

- **Project URL** → paste into `VITE_SUPABASE_URL`
- **Project API keys → `anon` / publishable key** → paste into `VITE_SUPABASE_PUBLISHABLE_KEY`

Paste them here (no quotes, no spaces around `=`):

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR-anon-or-publishable-key
```

> Your real values go in the git-ignored `.env.local` (already set up for you),
> not in this committed file.

> Use ONLY the publishable / `anon` key here. **Never** put the `service_role`
> key, any secret key, or an SMTP password in frontend code or in any `VITE_`
> variable — those are exposed to the browser.

After editing `.env.local`, **stop and restart** `npm run dev` (Vite only reads
env files at startup).

---

## 3. Redirect URLs

Go to **Authentication → URL Configuration** and add the app URLs so email
confirmation and password reset links return to the right place.

- **Site URL:** `https://preludeconsultingllc.com`
- **Redirect URLs** (add each):
  - `https://preludeconsultingllc.com/**`
  - `https://preludev1.pages.dev/**`
  - `http://localhost:5173/**`

The app builds confirmation links for `/verify-email`, password reset links for
`/reset-password`, and Google OAuth callbacks for `/auth/callback` from
`VITE_PUBLIC_APP_URL || window.location.origin`.

---

## 4. Development workaround for the "inactive recipient" error

If signup fails with:

> **Failed to sign up: You attempted to send email to an inactive recipient**

…it usually means Supabase tried to send a confirmation email to an address
that has **bounced or been suppressed** (common with the shared default email
service). For local testing:

1. Open **Supabase Dashboard**.
2. Go to **Authentication**.
3. Open **Providers**.
4. Open **Email**.
5. Temporarily turn **off** the **Confirm email** option (local testing only).
6. Go to **Authentication → Users**.
7. **Delete** the failed test user if one exists.
8. **Sign up again** — you'll get a session immediately (no confirmation email).
9. Turn **Confirm email back on before production launch.**

You can also simply **use a different, active email address** for testing.

---

## 5. SMTP configuration for production

Supabase's built-in email service is rate-limited and meant only for basic
testing. For production, use your own SMTP provider:

1. Go to **Authentication → SMTP Settings**.
2. Enable **Custom SMTP**.
3. Use:
   - Sender name: `Prelude`
   - Sender email: `no-reply@preludeconsultingllc.com`
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: Resend API key beginning with `re_`

Enter SMTP credentials **only in the Supabase dashboard** — never paste them
into frontend code or `.env.local`.

---

## 6. Try it out

With `.env.local` filled in and the dev server restarted:

| Page | URL |
| --- | --- |
| Sign up | `http://localhost:5173/register` |
| Log in | `http://localhost:5173/login` |
| Forgot password | `http://localhost:5173/forgot-password` |
| Reset password | (opened from the email link) `…/reset-password` |
| Google callback | `http://localhost:5173/auth/callback` |
| Dashboard | `http://localhost:5173/dashboard` (redirects to login when logged out) |

To make a user an **admin** (never selectable from the UI), run in SQL Editor:

```sql
update public.profiles set role = 'admin' where id = '<user-uuid>';
```

---

## Notes

- The dashboard is protected by the shared Supabase-backed auth provider.
- The six-digit login code is server-generated, hashed before storage, expires
  after 10 minutes, and is sent by the backend through Resend.
- Trusted devices are stored as hashed tokens in Supabase and HTTP-only cookies
  in the browser; the raw trusted-device secret is never stored in localStorage.
