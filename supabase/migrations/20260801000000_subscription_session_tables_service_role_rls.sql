-- =============================================================================
-- Harden subscription session credit tables (service-role only)
--
-- Verified access paths:
--   - Cloudflare Stripe webhook (functions/_lib/stripeBilling.js) via service_role REST
--   - Node billing/sessionCredits.js via Prisma/SQL (database owner; bypasses RLS)
--   - No frontend Supabase client reads/writes these tables
--   - No SECURITY DEFINER RPCs reference these tables
--
-- Authorization model (Option A):
--   Enable RLS with NO client policies. Revoke anon/authenticated privileges.
--   Preserve service_role (and table owner) access for trusted backends.
--   Enabling RLS without policies is safe here because clients have no grants
--   and no legitimate direct Data API access was found.
-- =============================================================================

begin;

-- Defense in depth: even if table privileges are re-granted later, RLS blocks
-- anon/authenticated row access until an explicit policy is added.
alter table public.subscription_session_periods enable row level security;
alter table public.subscription_session_reservations enable row level security;

-- Reaffirm least-privilege grants (idempotent with prior reconciliation).
revoke all on table public.subscription_session_periods from public, anon, authenticated;
revoke all on table public.subscription_session_reservations from public, anon, authenticated;

grant all on table public.subscription_session_periods to service_role;
grant all on table public.subscription_session_reservations to service_role;

-- Ensure no leftover permissive policies exist from prior experiments.
drop policy if exists "subscription_session_periods_select_own" on public.subscription_session_periods;
drop policy if exists "subscription_session_periods_insert_own" on public.subscription_session_periods;
drop policy if exists "subscription_session_periods_update_own" on public.subscription_session_periods;
drop policy if exists "subscription_session_periods_delete_own" on public.subscription_session_periods;
drop policy if exists "subscription_session_periods_authenticated_all" on public.subscription_session_periods;

drop policy if exists "subscription_session_reservations_select_own" on public.subscription_session_reservations;
drop policy if exists "subscription_session_reservations_insert_own" on public.subscription_session_reservations;
drop policy if exists "subscription_session_reservations_update_own" on public.subscription_session_reservations;
drop policy if exists "subscription_session_reservations_delete_own" on public.subscription_session_reservations;
drop policy if exists "subscription_session_reservations_authenticated_all" on public.subscription_session_reservations;

notify pgrst, 'reload schema';

commit;
