create table if not exists public.login_verification_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  failed_attempts integer not null default 0,
  created_at timestamptz not null default now(),
  requested_ip_hash text,
  user_agent_summary text
);

create index if not exists idx_login_verification_user_id
  on public.login_verification_challenges(user_id);

create index if not exists idx_login_verification_expires_at
  on public.login_verification_challenges(expires_at);

create index if not exists idx_login_verification_active_unused
  on public.login_verification_challenges(user_id, created_at desc)
  where used_at is null;

alter table public.login_verification_challenges enable row level security;

drop policy if exists "Users cannot read login verification challenges" on public.login_verification_challenges;
create policy "Users cannot read login verification challenges"
  on public.login_verification_challenges
  for select
  to authenticated
  using (false);

drop policy if exists "Users cannot insert login verification challenges" on public.login_verification_challenges;
create policy "Users cannot insert login verification challenges"
  on public.login_verification_challenges
  for insert
  to authenticated
  with check (false);

drop policy if exists "Users cannot update login verification challenges" on public.login_verification_challenges;
create policy "Users cannot update login verification challenges"
  on public.login_verification_challenges
  for update
  to authenticated
  using (false)
  with check (false);

create table if not exists public.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  device_name text,
  user_agent_summary text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists idx_trusted_devices_user_id
  on public.trusted_devices(user_id);

create index if not exists idx_trusted_devices_token_hash
  on public.trusted_devices(token_hash);

create index if not exists idx_trusted_devices_expires_at
  on public.trusted_devices(expires_at);

create index if not exists idx_trusted_devices_active
  on public.trusted_devices(user_id, expires_at)
  where revoked_at is null;

alter table public.trusted_devices enable row level security;

drop policy if exists "Users can view safe trusted device metadata" on public.trusted_devices;
create policy "Users cannot read trusted device token records directly"
  on public.trusted_devices
  for select
  to authenticated
  using (false);

drop policy if exists "Users cannot insert trusted devices directly" on public.trusted_devices;
create policy "Users cannot insert trusted devices directly"
  on public.trusted_devices
  for insert
  to authenticated
  with check (false);

drop policy if exists "Users cannot update trusted devices directly" on public.trusted_devices;
create policy "Users cannot update trusted devices directly"
  on public.trusted_devices
  for update
  to authenticated
  using (false)
  with check (false);
