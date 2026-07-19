-- 需求树层级 + 工时 + 关联边

alter table requirements
  add column if not exists parent_id uuid references requirements(id) on delete set null,
  add column if not exists type text not null default 'task',
  add column if not exists direct_hours numeric,
  add column if not exists actual_hours numeric,
  add column if not exists force_closed boolean not null default false;

comment on column requirements.type is 'epic | feature | task';

create index if not exists requirements_parent_id_idx on requirements (parent_id);
create index if not exists requirements_project_parent_idx on requirements (project_id, parent_id);

create table if not exists requirement_links (
  id uuid primary key,
  project_id uuid not null references projects(id) on delete cascade,
  source_type text not null,
  source_id text not null,
  target_type text not null,
  target_id text not null,
  relation_type text not null,
  created_at timestamptz not null default now()
);

create index if not exists requirement_links_project_idx on requirement_links (project_id);
create index if not exists requirement_links_source_idx on requirement_links (source_type, source_id);
create index if not exists requirement_links_target_idx on requirement_links (target_type, target_id);
