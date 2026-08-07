-- Repair onboarding INSERT under entitlement hardening.
-- Clients may omit onboarding_status; DB forces needs_plan + safe defaults.
-- Does not re-grant protected columns. Safe to re-run.

alter table public.onboarding_progress
  alter column onboarding_status set default 'needs_plan';

create or replace function public.enforce_onboarding_entitlement_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Service role and explicit entitlement writers (billing, match submit, promo) may proceed.
  if auth.uid() is null
    or coalesce(current_setting('prelude.allow_entitlement_write', true), '') = 'true'
    or coalesce(current_setting('prelude.allow_onboarding_entitlement', true), '') = 'true'
    or coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Force server-authoritative initial state; ignore any client attempt to advance.
    new.onboarding_status := 'needs_plan';
    new.payment_step_completed := false;
    new.mentor_matching_complete := false;
    new.prelude_match_completed := false;
    new.parent_invite_step_completed := false;
    new.admin_review_required := false;
    new.matched_mentor_count := 0;
    new.matched_mentor_ids := '[]'::jsonb;
    new.selected_mentor_id := null;
    new.mentor_selection_method := null;
    new.mentor_assignment_status := null;
    new.suggested_mentor_id := null;
    new.match_decision := null;
    new.declined_mentor_ids := '[]'::jsonb;
    new.mentor_selection_timestamp := null;
    return new;
  end if;

  if new.payment_step_completed is distinct from old.payment_step_completed
    or new.mentor_matching_complete is distinct from old.mentor_matching_complete
    or new.prelude_match_completed is distinct from old.prelude_match_completed
    or new.parent_invite_step_completed is distinct from old.parent_invite_step_completed
    or new.admin_review_required is distinct from old.admin_review_required
    or new.matched_mentor_count is distinct from old.matched_mentor_count
    or new.matched_mentor_ids is distinct from old.matched_mentor_ids
    or new.onboarding_status is distinct from old.onboarding_status
    or new.selected_mentor_id is distinct from old.selected_mentor_id
    or new.mentor_selection_method is distinct from old.mentor_selection_method
    or new.mentor_assignment_status is distinct from old.mentor_assignment_status
    or new.suggested_mentor_id is distinct from old.suggested_mentor_id
    or new.match_decision is distinct from old.match_decision
    or new.declined_mentor_ids is distinct from old.declined_mentor_ids
    or new.mentor_selection_timestamp is distinct from old.mentor_selection_timestamp then
    raise exception 'Onboarding entitlements are managed by Prelude.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists onboarding_entitlement_guard on public.onboarding_progress;
create trigger onboarding_entitlement_guard
  before insert or update on public.onboarding_progress
  for each row execute function public.enforce_onboarding_entitlement_guard();

notify pgrst, 'reload schema';
