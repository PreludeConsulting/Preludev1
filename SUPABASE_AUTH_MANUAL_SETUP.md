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
http://localhost:5173/Preludev1/
```

## 6. Add both Redirect URLs

Authentication → **URL Configuration → Redirect URLs** (add each):

```
http://localhost:5173/Preludev1/login
http://localhost:5173/Preludev1/reset-password
```

**Production later:** after deploying, also add your live origin, e.g.
`https://yourdomain.com/Preludev1/auth/login` and
`https://yourdomain.com/Preludev1/auth/reset-password`, and set the production
**Site URL** to your deployed URL.

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
3. Use a provider: **Resend, Postmark, SendGrid, Brevo, or AWS SES**.
4. Send from a domain sender, e.g. `no-reply@yourdomain.com`.
5. Enter SMTP credentials **only in the dashboard** — never in `.env.local`,
   frontend code, or committed files.

## 9. Test signup and login locally

1. Start the app: `npm run dev`.
2. Open **`http://localhost:5173/Preludev1/auth/signup`** and create an account
   (with email confirmation disabled per step 7, or a confirmable address).
3. Log in at `http://localhost:5173/Preludev1/auth/login`.
4. You'll land on `http://localhost:5173/Preludev1/auth/account`.
5. Refresh the page — you should stay signed in.
6. Click **Log out** — you should return to `/auth/login`.

To make a user an admin (developer-only — never selectable in the UI):

```sql
update public.profiles set role = 'admin' where id = '<user-uuid>';
```

## 10. About `/auth/account`

`/auth/account` is **only a protected Supabase sample page** that proves the
session + RLS profile read work. It is not the product dashboard.

## 11. About `/dashboard`

The existing `/dashboard` still uses the **Prisma/JWT** auth system and has
**intentionally not been migrated** to Supabase in this task. The two systems
run side by side; the Supabase stack stays isolated under `/auth/*` until a
deliberate migration later.
