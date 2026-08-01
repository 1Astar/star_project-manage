-- Daily sync-git → commit↔requirement suggestions (human confirm; never auto-apply)

create table if not exists git_sync_suggestions (
  id text primary key,
  pm_project_id text,
  studio_project_id text,
  requirement_id text not null,
  requirement_title text not null,
  commit_sha text not null,
  short_sha text not null,
  commit_message text not null,
  commit_url text not null,
  committed_at timestamptz,
  score integer not null default 0,
  reasons jsonb not null default '[]'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'dismissed')),
  suggested_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (requirement_id, commit_sha)
);

create index if not exists git_sync_suggestions_status_idx
  on git_sync_suggestions (status, suggested_at desc);

create index if not exists git_sync_suggestions_pm_project_idx
  on git_sync_suggestions (pm_project_id)
  where pm_project_id is not null;

create index if not exists git_sync_suggestions_studio_project_idx
  on git_sync_suggestions (studio_project_id)
  where studio_project_id is not null;
