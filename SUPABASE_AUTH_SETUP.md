# Supabase Auth — Manual Setup Checklist

This project now has an **optional Supabase authentication stack** living under the
`/auth/*` routes (login, signup, forgot/reset password, and a protected sample
account page). It runs **alongside** the existing Prisma/JWT auth that powers the
current `/dashboard` — nothing was removed.

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
7. Verify the `public.profiles` table exists: **Table Editor → profiles**.
6. Verify **Row Level Security is enabled** (the `profiles` table shows an
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

- **Site URL:** `http://localhost:5173/Preludev1/`
- **Redirect URLs** (add each):
  - `http://localhost:5173/Preludev1/login`
  - `http://localhost:5173/Preludev1/register`
  - `http://localhost:5173/Preludev1/reset-password`
  - `http://localhost:5173/Preludev1/verify-email` (legacy Prisma auth only)

> The app builds these from the Vite base (`/Preludev1/`). If you change the
> base, update these accordingly.

**For production later**, add your deployed origin too, e.g.:
- `https://yourdomain.com/Preludev1/login`
- `https://yourdomain.com/Preludev1/reset-password`
- and set the production **Site URL** to your deployed URL.

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
3. Connect a provider such as **Resend, Postmark, SendGrid, Brevo, or AWS SES**.

Enter SMTP credentials **only in the Supabase dashboard** — never paste them
into frontend code or `.env.local`. Send production email from a domain-based
sender, e.g. `no-reply@yourdomain.com`.

---

## 6. Try it out

With `.env.local` filled in and the dev server restarted:

| Page | URL |
| --- | --- |
| Sign up | `http://localhost:5173/Preludev1/auth/signup` |
| Log in | `http://localhost:5173/Preludev1/auth/login` |
| Forgot password | `http://localhost:5173/Preludev1/auth/forgot-password` |
| Reset password | (opened from the email link) `…/auth/reset-password` |
| Protected sample | `http://localhost:5173/Preludev1/auth/account` (redirects to login when logged out) |

To make a user an **admin** (never selectable from the UI), run in SQL Editor:

```sql
update public.profiles set role = 'admin' where id = '<user-uuid>';
```

---

## Notes / what's intentionally NOT wired yet

- The Supabase stack is **isolated under `/auth/*`** and lazy-loaded. If the
  env vars are missing, only `/auth/*` shows a friendly "not configured" message
  — the landing pages and the existing `/dashboard` are unaffected.
- After a Supabase login, the user is sent to `/auth/account` (a Supabase-gated
  sample), **not** the existing `/dashboard`. The current dashboard still uses
  the Prisma/JWT system, so it is deliberately left untouched. Pointing the real
  dashboard at Supabase sessions is the next step of a full migration whenever
  you're ready.
