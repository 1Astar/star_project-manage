-- Requirement pool fields + project members roster

alter table requirements add column if not exists in_pool boolean not null default false;
alter table requirements add column if not exists category text;
alter table requirements add column if not exists stage_type text;
alter table requirements add column if not exists optimization_notes text;
alter table requirements add column if not exists known_issues text;

create table if not exists project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  role role_type,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (project_id, name)
);

create index if not exists idx_project_members_project on project_members(project_id);
create index if not exists idx_requirements_in_pool on requirements(project_id, in_pool);

alter table project_members enable row level security;
