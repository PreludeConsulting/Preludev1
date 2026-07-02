# Supabase steps for the approved fixes

These are the only external database steps required by this patch. No secrets
belong in these SQL files or in any `VITE_` environment variable.

1. In Supabase Dashboard, open **SQL Editor**.
2. Run `supabase/setup-auth.sql` to:
   - allow the existing `parent` application role; and
   - prevent authenticated users from changing their own authorization role.
3. Run `supabase/parent-links.sql` **or** apply migration
   `supabase/migrations/20260703000000_parent_links.sql` to install parent invite
   tables, RLS, and the guarded `accept_parent_invite` /
   `connect_student_parent_email` functions used by the parent invite flow.
4. Confirm RLS remains enabled:

   ```sql
   select relname, relrowsecurity
   from pg_class
   where oid in (
     'public.profiles'::regclass,
     'public.parent_invites'::regclass,
     'public.parent_student_links'::regclass
   );
   ```

   All three rows should report `relrowsecurity = true`.

5. In **Authentication → URL Configuration**, keep the production site origin
   as the Site URL and allow these redirect paths on that same origin:
   `/login`, `/reset-password`, and `/dashboard`.

Do not add a `service_role` key to client-side configuration. The existing
`VITE_SUPABASE_PUBLISHABLE_KEY` is the only Supabase key intended for the
browser.
