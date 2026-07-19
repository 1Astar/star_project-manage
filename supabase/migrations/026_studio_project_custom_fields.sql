-- Studio 项目库自定义字段（全局列定义 + 每项目值）

alter table studio_projects
  add column if not exists custom_fields jsonb not null default '{}'::jsonb;

create table if not exists studio_project_column_defs (
  id text primary key,
  key text not null unique,
  label text not null,
  column_type text not null,
  options jsonb not null default '[]'::jsonb,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists studio_project_column_defs_sort_idx
  on studio_project_column_defs (is_active, sort_order);
