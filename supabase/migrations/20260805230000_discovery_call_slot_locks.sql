-- =============================================================================
-- Discovery Call slot locks
--
-- A successful /contact booking request reserves that Eastern-time window so
-- other visitors cannot request the same date + start time. Canceled rows are
-- excluded from the unique index so support can free a window later.
-- =============================================================================

create table if not exists public.discovery_call_requests (
  id uuid primary key default gen_random_uuid(),
  selected_date date not null,
  selected_time text not null
    check (selected_time ~ '^\d{2}:\d{2}$'),
  customer_name text not null,
  customer_email text not null,
  student_year text,
  topic text,
  status text not null default 'requested'
    check (status in ('requested', 'confirmed', 'canceled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists discovery_call_requests_active_slot_uidx
  on public.discovery_call_requests (selected_date, selected_time)
  where status in ('requested', 'confirmed');

create index if not exists discovery_call_requests_active_date_idx
  on public.discovery_call_requests (selected_date)
  where status in ('requested', 'confirmed');

alter table public.discovery_call_requests enable row level security;

-- Service-role API only. Visitor PII must not be readable through the anon key.
revoke all on table public.discovery_call_requests from public;
revoke all on table public.discovery_call_requests from anon, authenticated;
grant select, insert, update, delete on table public.discovery_call_requests to service_role;

notify pgrst, 'reload schema';
