create table if not exists public.rate_limit_buckets (
  id uuid primary key default gen_random_uuid(),
  key varchar(255) not null,
  route varchar(255) not null,
  window_start timestamptz not null,
  window_seconds integer not null,
  request_count integer not null default 0,
  blocked_until timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint uq_rate_limit_buckets_key_route_window unique (key, route, window_start)
);

create index if not exists idx_rate_limit_buckets_blocked_until
  on public.rate_limit_buckets (blocked_until);

alter table public.rate_limit_buckets enable row level security;

create or replace function public.check_api_rate_limit(
  p_key text,
  p_route text,
  p_window_seconds integer,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_request_count integer;
  v_reset_at timestamptz;
begin
  if p_key is null or length(trim(p_key)) = 0 then
    raise exception 'p_key is required';
  end if;
  if p_route is null or length(trim(p_route)) = 0 then
    raise exception 'p_route is required';
  end if;
  if p_window_seconds is null or p_window_seconds < 1 then
    raise exception 'p_window_seconds must be positive';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from p_now) / p_window_seconds) * p_window_seconds
  );
  v_reset_at := v_window_start + make_interval(secs => p_window_seconds);

  insert into public.rate_limit_buckets (
    key,
    route,
    window_start,
    window_seconds,
    request_count,
    updated_at
  )
  values (
    left(p_key, 255),
    left(p_route, 255),
    v_window_start,
    p_window_seconds,
    1,
    now()
  )
  on conflict (key, route, window_start)
  do update set
    request_count = public.rate_limit_buckets.request_count + 1,
    window_seconds = excluded.window_seconds,
    updated_at = now()
  returning request_count into v_request_count;

  return jsonb_build_object(
    'request_count', v_request_count,
    'reset_at', v_reset_at
  );
end;
$$;

revoke all on function public.check_api_rate_limit(text, text, integer, timestamptz) from public;
grant execute on function public.check_api_rate_limit(text, text, integer, timestamptz) to service_role;
