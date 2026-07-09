-- Idea Studio：灵感 / 项目 / 演进 / 任务 / 资料

create table if not exists studio_projects (
  id text primary key,
  title text not null,
  positioning text not null default '',
  target_user text not null default '',
  status text not null default 'active',
  priority text not null default 'P2',
  current_stage text not null default '',
  next_action text not null default '',
  demo_url text,
  local_run_guide text,
  code_path text,
  related_page_url text,
  portfolio_value text not null default '',
  body jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists studio_ideas (
  id text primary key,
  title text not null,
  one_line_idea text not null default '',
  why_it_matters text not null default '',
  trigger_source text not null default '',
  emotion_level text not null default 'normal',
  type text not null default 'product',
  related_project_id text references studio_projects(id) on delete set null,
  status text not null default 'inbox',
  created_at timestamptz not null default now()
);

create table if not exists studio_evolution_logs (
  id text primary key,
  title text not null,
  project_id text not null references studio_projects(id) on delete cascade,
  log_type text not null,
  before_text text not null default '',
  after_text text not null default '',
  reason text not null default '',
  decision text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists studio_tasks (
  id text primary key,
  title text not null,
  project_id text not null references studio_projects(id) on delete cascade,
  status text not null default 'todo',
  priority text not null default 'P2',
  workload text not null default '',
  blocker text,
  due_date date,
  created_at timestamptz not null default now()
);

create table if not exists studio_assets (
  id text primary key,
  title text not null,
  project_id text not null references studio_projects(id) on delete cascade,
  asset_type text not null default 'inspiration',
  url text not null default '',
  note text not null default '',
  takeaway text not null default '',
  risk text,
  created_at timestamptz not null default now()
);

create index if not exists studio_ideas_status_idx on studio_ideas(status);
create index if not exists studio_ideas_created_at_idx on studio_ideas(created_at desc);
create index if not exists studio_evolution_logs_project_idx on studio_evolution_logs(project_id);
create index if not exists studio_evolution_logs_created_at_idx on studio_evolution_logs(created_at desc);
create index if not exists studio_tasks_project_idx on studio_tasks(project_id);
create index if not exists studio_assets_project_idx on studio_assets(project_id);
