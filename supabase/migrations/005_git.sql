-- Git 仓库绑定与提交活动记录

alter table projects
  add column if not exists repo_full_name text,
  add column if not exists repo_branch text,
  add column if not exists repo_url text,
  add column if not exists last_commit_sha text,
  add column if not exists last_commit_message text,
  add column if not exists last_commit_at timestamptz,
  add column if not exists last_git_synced_at timestamptz,
  add column if not exists vercel_project_id text,
  add column if not exists vercel_deployment_url text,
  add column if not exists last_deploy_status text check (last_deploy_status in ('ready', 'building', 'error')),
  add column if not exists demo_url text,
  add column if not exists local_run_guide text,
  add column if not exists code_path text;

create table if not exists git_activities (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  repo_full_name text not null,
  branch text not null,
  commit_sha text not null,
  short_sha text not null,
  message text not null,
  author text not null,
  committed_at timestamptz not null,
  url text not null,
  synced_at timestamptz not null default now(),
  unique (project_id, commit_sha)
);

create index if not exists git_activities_project_id_idx on git_activities(project_id);
create index if not exists git_activities_committed_at_idx on git_activities(committed_at desc);
