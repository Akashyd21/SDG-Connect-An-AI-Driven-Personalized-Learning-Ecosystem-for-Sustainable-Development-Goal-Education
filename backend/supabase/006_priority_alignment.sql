-- Part 1 alignment migration. Safe to run after migrations 001-005.
-- Existing legacy milestone/evidence columns are retained for compatibility;
-- the application no longer uses them for the new submission flow.

alter table public.profiles
  add column if not exists skill_level text not null default 'intermediate'
    check (skill_level in ('beginner', 'intermediate', 'advanced'));
alter table public.profiles
  add column if not exists available_hours numeric not null default 4
    check (available_hours > 0 and available_hours <= 40);

alter table public.activities
  add column if not exists problem_statement text;
alter table public.activities
  add column if not exists teaching_goals jsonb not null default '[]'::jsonb;
alter table public.activities
  add column if not exists sdg_relation text;
alter table public.activities
  add column if not exists matched_skills jsonb not null default '[]'::jsonb;
alter table public.activities
  add column if not exists matched_interests jsonb not null default '[]'::jsonb;
alter table public.activities
  add column if not exists required_tools jsonb not null default '[]'::jsonb;
alter table public.activities
  add column if not exists requirements jsonb not null default '[]'::jsonb;
alter table public.activities
  add column if not exists deliverables jsonb not null default '[]'::jsonb;
alter table public.activities
  add column if not exists submission_instructions text;
alter table public.activities
  add column if not exists evaluation_criteria jsonb not null default '[]'::jsonb;

alter table public.submissions
  add column if not exists project_summary text;
alter table public.submissions
  add column if not exists notebook_url text;
alter table public.submissions
  add column if not exists submission_status text not null default 'not_submitted'
    check (submission_status in ('not_submitted', 'submitted', 'needs_changes', 'approved', 'rejected'));

-- Keep profile creation compatible with both old and new signup payloads.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id, role, name, usn, department, phone, email, skills, interests,
    designation, skill_level, available_hours
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'student'),
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    nullif(new.raw_user_meta_data->>'usn', ''),
    coalesce(new.raw_user_meta_data->>'department', 'All Departments'),
    new.raw_user_meta_data->>'phone',
    new.email,
    coalesce(array(select jsonb_array_elements_text(new.raw_user_meta_data->'skills')), '{}'),
    coalesce(array(select jsonb_array_elements_text(new.raw_user_meta_data->'interests')), '{}'),
    new.raw_user_meta_data->>'designation',
    coalesce(new.raw_user_meta_data->>'skill_level', 'intermediate'),
    coalesce(nullif(new.raw_user_meta_data->>'available_hours', '')::numeric, 4)
  );
  return new;
end;
$$;

grant execute on function public.handle_new_user() to service_role;
