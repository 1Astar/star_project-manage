-- Studio 项目 Git：分支 + 同步时间 + 提交活动

alter table studio_projects
  add column if not exists github_branch text not null default 'main',
  add column if not exists last_commit_sha text,
  add column if not exists last_git_synced_at timestamptz;

create table if not exists studio_git_activities (
  id text primary key,
  project_id text not null references studio_projects(id) on delete cascade,
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

create index if not exists studio_git_activities_project_idx on studio_git_activities(project_id);

-- 资料附件（图片等）Supabase Storage 路径
alter table studio_assets
  add column if not exists storage_path text,
  add column if not exists mime_type text;

insert into storage.buckets (id, name, public)
values ('studio-assets', 'studio-assets', true)
on conflict (id) do nothing;
