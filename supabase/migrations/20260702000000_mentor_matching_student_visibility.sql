-- Let students see mentor profiles with enough data for PreludeMatch,
-- even when the mentor questionnaire flag is not yet marked completed.

drop policy if exists "Completed mentor matching profiles viewable by authenticated users" on public.mentor_matching_profiles;
drop policy if exists "Mentor matching profiles viewable for PreludeMatch" on public.mentor_matching_profiles;

create policy "Mentor matching profiles viewable for PreludeMatch"
  on public.mentor_matching_profiles for select to authenticated
  using (
    auth.uid() = mentor_user_id
    or completed = true
    or (
      coalesce(trim(display_name), '') <> ''
      and coalesce(trim(college), '') <> ''
      and coalesce(trim(major), '') <> ''
    )
  );

notify pgrst, 'reload schema';
