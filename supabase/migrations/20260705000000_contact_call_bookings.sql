create table if not exists public.contact_call_bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  student_year text,
  topic text,
  selected_date date not null,
  selected_time text not null check (selected_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  appointment_start_at timestamptz not null,
  reminder_send_after_at timestamptz not null,
  support_email text not null default 'preludesupport@preludeconsultingllc.com',
  support_phone text,
  contact_instructions text,
  support_email_sent_at timestamptz,
  confirmation_email_sent_at timestamptz,
  reminder_sent_at timestamptz,
  support_resend_id text,
  confirmation_resend_id text,
  reminder_resend_id text,
  status text not null default 'requested' check (
    status in ('requested', 'emails_sent', 'email_failed', 'reminder_sent', 'canceled')
  )
);

create index if not exists contact_call_bookings_customer_email_idx
  on public.contact_call_bookings (customer_email);

create index if not exists contact_call_bookings_due_reminders_idx
  on public.contact_call_bookings (reminder_send_after_at, appointment_start_at)
  where reminder_sent_at is null;

alter table public.contact_call_bookings enable row level security;

create or replace function public.set_contact_call_bookings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_contact_call_bookings_updated_at on public.contact_call_bookings;

create trigger set_contact_call_bookings_updated_at
before update on public.contact_call_bookings
for each row
execute function public.set_contact_call_bookings_updated_at();
