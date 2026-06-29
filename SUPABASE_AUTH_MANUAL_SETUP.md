# Supabase Auth — Manual Setup (do these in order)

These are the **only** steps that must be done by hand in the Supabase Dashboard.
All code-side work is already done. The Supabase stack lives under `/auth/*` and
is isolated from the existing Prisma/JWT `/dashboard`.

> Cursor cannot click through the Supabase Dashboard (no browser automation was
> available), so the dashboard steps below are yours to complete.

---

## 1. Run the SQL

1. Open the Supabase Dashboard → **SQL Editor**.
2. Paste the entire contents of [`supabase/setup-auth.sql`](./supabase/setup-auth.sql).
3. Click **Run**.

## 2. Verify the `profiles` table exists

- **Table Editor → `profiles`** should show the columns
  `id, full_name, role, school, grade_level, created_at`, or run:
  ```sql
  select * from public.profiles;
  ```

## 3. Verify Row Level Security is enabled

```sql
select relrowsecurity from pg_class where oid = 'public.profiles'::regclass;
-- expect: true
```

## 4. Confirm local environment variables (already set for you)

`.env.local` (git-ignored) already contains your project URL and **publishable**
key. No action needed unless the values change. Confirm they are present:

```env
VITE_SUPABASE_URL=https://xvktmnxtjukmbarlzssm.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
```

> Never put a `service_role` key, secret key, or SMTP password in `.env.local`,
> any `VITE_` variable, or any committed file.

## 5. Configure the Site URL

Authentication → **URL Configuration → Site URL**:

```
https://preludeconsultingllc.com
```

## 6. Add both Redirect URLs

Authentication → **URL Configuration → Redirect URLs** (add each):

```
https://preludeconsultingllc.com/**
https://preludev1.pages.dev/**
http://localhost:5173/**
```

The app sends confirmation links to `/verify-email`, password reset links to
`/reset-password`, and Google OAuth callbacks to `/auth/callback`.

## 7. Inactive-recipient workaround (local testing)

If signup fails with **"You attempted to send email to an inactive recipient"**,
Supabase tried to email a bounced/suppressed address on the shared dev mailer.

1. Open the Supabase Dashboard.
2. Authentication → **Providers → Email**.
3. Temporarily **disable Confirm email** (local testing only).
4. Authentication → **Users** → delete any failed test user.
5. Sign up again (you'll get a session immediately).
6. **Re-enable Confirm email before production.**

You can also just use a **different, active email address** and skip disabling
confirmation.

## 8. Production email = Custom SMTP (dashboard only)

The built-in mailer is rate-limited and for testing only. For production:

1. Authentication → **SMTP Settings**.
2. Enable **Custom SMTP**.
3. Use:
   - Sender name: `Prelude`
   - Sender email: `no-reply@preludeconsultingllc.com`
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: Resend API key beginning with `re_`
4. Enter SMTP credentials **only in the dashboard** — never in `.env.local`,
   frontend code, or committed files.

## 9. Test signup and login locally

1. Start the app: `npm run dev`.
2. Open **`http://localhost:5173/register`** and create an account
   (with email confirmation disabled per step 7, or a confirmable address).
3. Confirm the email link, then log in at `http://localhost:5173/login`.
4. You'll continue through onboarding or land on `/dashboard`.
5. Refresh the page — you should stay signed in.
6. Click **Log out** — you should return to `/auth/login`.

To make a user an admin (developer-only — never selectable in the UI):

```sql
update public.profiles set role = 'admin' where id = '<user-uuid>';
```

## 10. About `/dashboard`

The main Prelude routes use Supabase when `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` are configured.
