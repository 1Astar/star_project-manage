-- 需求池字段（打开 /pool 会 ensure「需求池」迭代并写库；缺列会服务端崩溃）

alter table projects
  add column if not exists pool_tag_options jsonb not null default '["硬件","软件","体验"]'::jsonb;

alter table requirements
  add column if not exists in_pool boolean not null default false,
  add column if not exists category text,
  add column if not exists stage_type text,
  add column if not exists optimization_notes text,
  add column if not exists known_issues text,
  add column if not exists submitted_at date,
  add column if not exists due_date date,
  add column if not exists difficulty_notes text,
  add column if not exists scenario text,
  add column if not exists needs_discussion boolean not null default false,
  add column if not exists prd_link text,
  add column if not exists prototype_link text,
  add column if not exists product_estimate_hours numeric(10,2),
  add column if not exists tags jsonb not null default '[]'::jsonb,
  add column if not exists custom_fields jsonb not null default '{}'::jsonb;

create table if not exists pool_column_defs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  key text not null,
  label text not null,
  column_type text not null,
  options jsonb not null default '[]'::jsonb,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists pool_column_defs_project_key_idx
  on pool_column_defs (project_id, key);

create table if not exists project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  role text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists project_members_project_idx on project_members (project_id);
create index if not exists requirements_in_pool_idx on requirements (project_id, in_pool);
