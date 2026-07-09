-- Requirement comments (project-scoped discussion)

create table requirement_comments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  requirement_id uuid not null references requirements(id) on delete cascade,
  author_name text not null,
  author_role text,
  body text not null,
  created_at timestamptz not null default now()
);

create index idx_requirement_comments_project on requirement_comments(project_id, created_at desc);
create index idx_requirement_comments_requirement on requirement_comments(requirement_id, created_at desc);

alter table requirement_comments enable row level security;

create policy "admin_all_requirement_comments" on requirement_comments
  for all using (auth.role() = 'authenticated');
