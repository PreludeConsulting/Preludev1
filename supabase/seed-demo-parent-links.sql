-- =============================================================================
-- Demo parent with two children (Supabase)
-- Run AFTER creating auth users for:
--   parent@prelude-demo.com (role: parent)
--   student@prelude-demo.com (role: student)
--   student2@prelude-demo.com (role: student)
-- Safe to re-run.
-- =============================================================================

do $$
declare
  parent_id uuid;
  jordan_id uuid;
  alex_id uuid;
begin
  select id into parent_id from auth.users where lower(email) = 'parent@prelude-demo.com' limit 1;
  select id into jordan_id from auth.users where lower(email) = 'student@prelude-demo.com' limit 1;
  select id into alex_id from auth.users where lower(email) = 'student2@prelude-demo.com' limit 1;

  if parent_id is null then
    raise notice 'Skip: parent@prelude-demo.com not found in auth.users';
    return;
  end if;

  if jordan_id is not null then
    update public.profiles set parent_guardian_email = 'parent@prelude-demo.com' where id = jordan_id;
    insert into public.parent_invites (student_id, parent_email, status, accepted_at)
    values (jordan_id, 'parent@prelude-demo.com', 'accepted', now())
    on conflict (student_id, parent_email) do update set status = 'accepted', accepted_at = now();
    insert into public.parent_student_links (parent_id, student_id)
    values (parent_id, jordan_id)
    on conflict (parent_id, student_id) do nothing;
  end if;

  if alex_id is not null then
    update public.profiles set parent_guardian_email = 'parent@prelude-demo.com' where id = alex_id;
    insert into public.parent_invites (student_id, parent_email, status, accepted_at)
    values (alex_id, 'parent@prelude-demo.com', 'accepted', now())
    on conflict (student_id, parent_email) do update set status = 'accepted', accepted_at = now();
    insert into public.parent_student_links (parent_id, student_id)
    values (parent_id, alex_id)
    on conflict (parent_id, student_id) do nothing;
  end if;
end $$;
