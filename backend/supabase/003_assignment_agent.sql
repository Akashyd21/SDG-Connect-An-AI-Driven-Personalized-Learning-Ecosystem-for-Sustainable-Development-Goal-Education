-- Assignment-agent metadata and deadlines.
-- Run after 001_activity_recommendations.sql and 002_frontend_platform.sql.

alter table public.activities
  add column if not exists submission_type text not null default 'field'
  check (submission_type in ('coding', 'field'));

alter table public.activities
  add column if not exists deadline date;

alter table public.ongoing_tasks
  add column if not exists deadline date;

-- PostgreSQL cannot replace a function when its OUT/return columns change.
drop function if exists public.match_activities(
  vector, smallint[], text, text, numeric, integer
);

create or replace function public.match_activities(
  query_embedding vector(1024), wanted_sdgs smallint[], wanted_department text,
  wanted_difficulty text, max_hours numeric, result_limit integer
)
returns table (
  id uuid, title text, description text, sdgs smallint[], steps jsonb,
  difficulty text, hours numeric, why_it_fits text, department text,
  source text, approval_status text, submission_type text, deadline date, score float
)
language sql stable
as $$
  select a.id, a.title, a.description, a.sdgs, a.steps, a.difficulty, a.hours,
    a.why_it_fits, a.department, a.source, a.approval_status,
    a.submission_type, a.deadline,
    (1 - (a.embedding <=> query_embedding))::float as score
  from public.activities a
  where a.approval_status = 'approved'
    and a.hours <= max_hours
    and (a.department = wanted_department or a.department = 'All Departments')
    and a.sdgs && wanted_sdgs
  order by
    case when a.department = wanted_department then 0 else 1 end,
    case when a.difficulty = wanted_difficulty then 0 else 1 end,
    a.embedding <=> query_embedding
  limit result_limit;
$$;
