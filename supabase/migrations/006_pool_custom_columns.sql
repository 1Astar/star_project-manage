-- Pool custom columns + requirement metadata

create table if not exists pool_column_defs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  key text not null,
  label text not null,
  column_type text not null check (
    column_type in ('text', 'number', 'date', 'checkbox', 'select', 'url')
  ),
  options jsonb not null default '[]'::jsonb,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (project_id, key)
);

create index if not exists idx_pool_column_defs_project on pool_column_defs(project_id);

alter table requirements add column if not exists prd_link text;
alter table requirements add column if not exists prototype_link text;
alter table requirements add column if not exists product_estimate_hours numeric(10,2);
alter table requirements add column if not exists tags text[] not null default '{}';
alter table requirements add column if not exists custom_fields jsonb not null default '{}'::jsonb;

alter table projects add column if not exists pool_tag_options text[] not null default array['硬件', '软件', '体验'];

alter table pool_column_defs enable row level security;
