-- Dynamic RAG generation: knowledge documents only, not pre-created activities.
-- Run after 001_activity_recommendations.sql, 002_frontend_platform.sql,
-- and 003_assignment_agent.sql.

create table if not exists public.rag_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  sdgs smallint[] not null default '{}',
  department text not null default 'All Departments',
  embedding vector(1024),
  source text not null default 'institutional_knowledge',
  created_at timestamptz not null default now()
);

create index if not exists rag_documents_embedding_idx
  on public.rag_documents using ivfflat (embedding vector_cosine_ops) with (lists = 50);

alter table public.rag_documents enable row level security;

drop policy if exists "approved users can read rag documents" on public.rag_documents;
create policy "approved users can read rag documents"
  on public.rag_documents for select using (true);

create or replace function public.match_rag_documents(
  query_embedding vector(1024), wanted_sdgs smallint[], wanted_department text,
  result_limit integer default 6
)
returns table (
  id uuid, title text, content text, sdgs smallint[], department text,
  source text, score float
)
language sql stable
as $$
  select d.id, d.title, d.content, d.sdgs, d.department, d.source,
    case when d.embedding is null then 0::float
      else (1 - (d.embedding <=> query_embedding))::float end as score
  from public.rag_documents d
  where (d.department = wanted_department or d.department = 'All Departments')
    and (cardinality(d.sdgs) = 0 or d.sdgs && wanted_sdgs)
  order by
    case when d.department = wanted_department then 0 else 1 end,
    case when d.embedding is null then 1 else 0 end,
    d.embedding <=> query_embedding
  limit result_limit;
$$;

-- These are grounding rules, not activities. Their embeddings can be populated
-- later by an ingestion job using the same BAAI/bge-large-en-v1.5 model.
insert into public.rag_documents (title, content, sdgs, department)
select * from (values
  (
    'SDG task design rules',
    'Create a measurable student activity tied to selected SDG targets. Include a deliverable, realistic steps, evidence requirements, and one impact metric.',
    array[]::smallint[], 'All Departments'
  ),
  (
    'Department adaptation rules',
    'Adapt examples, tools, deliverables, and difficulty to the student department and skills. Do not assign generic work when a department-specific version is possible.',
    array[]::smallint[], 'All Departments'
  ),
  (
    'Coding submission rules',
    'Software, data, AI, IoT, and programming tasks require a GitHub repository, screenshot, and summary.',
    array[]::smallint[], 'Computer Science'
  ),
  (
    'Field submission rules',
    'Physical or community tasks require an activity name, summary, proof photo, and geotagged location.',
    array[]::smallint[], 'All Departments'
  )
) as seed(title, content, sdgs, department)
where not exists (select 1 from public.rag_documents existing where existing.title = seed.title);
