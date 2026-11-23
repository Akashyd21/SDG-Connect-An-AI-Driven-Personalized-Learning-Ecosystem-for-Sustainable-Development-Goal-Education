-- Repair the Auth -> public.profiles bridge without deleting users or profiles.
-- Run after 002_frontend_platform.sql if signup reports:
-- "Database error saving new user".

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_role text;
  profile_department text;
  profile_skills text[] := '{}';
  profile_interests text[] := '{}';
begin
  profile_role := coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'student');
  profile_department := coalesce(nullif(new.raw_user_meta_data->>'department', ''), 'All Departments');

  if jsonb_typeof(new.raw_user_meta_data->'skills') = 'array' then
    select coalesce(array_agg(value), '{}'::text[])
      into profile_skills
      from jsonb_array_elements_text(new.raw_user_meta_data->'skills') as item(value);
  end if;

  if jsonb_typeof(new.raw_user_meta_data->'interests') = 'array' then
    select coalesce(array_agg(value), '{}'::text[])
      into profile_interests
      from jsonb_array_elements_text(new.raw_user_meta_data->'interests') as item(value);
  end if;

  insert into public.profiles (
    id, role, name, usn, department, phone, email, skills, interests, designation
  ) values (
    new.id,
    profile_role,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(coalesce(new.email, 'student'), '@', 1)),
    nullif(new.raw_user_meta_data->>'usn', ''),
    profile_department,
    nullif(new.raw_user_meta_data->>'phone', ''),
    new.email,
    profile_skills,
    profile_interests,
    nullif(new.raw_user_meta_data->>'designation', '')
  )
  on conflict (id) do update set
    role = excluded.role,
    name = excluded.name,
    usn = excluded.usn,
    department = excluded.department,
    phone = excluded.phone,
    email = excluded.email,
    skills = excluded.skills,
    interests = excluded.interests,
    designation = excluded.designation;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

grant execute on function public.handle_new_user() to service_role;
