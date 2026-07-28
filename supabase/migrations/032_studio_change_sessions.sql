-- AI 变更会话：改前目标 / 改后执行 / 人工验收（与演进记录分工）

create table if not exists studio_change_sessions (
  id text primary key,
  project_id text not null references studio_projects(id) on delete cascade,
  day date not null,
  goal text not null default '',
  reason text not null default '',
  expected jsonb not null default '[]'::jsonb,
  done_items jsonb not null default '[]'::jsonb,
  pending_items jsonb not null default '[]'::jsonb,
  ai_ops jsonb not null default '[]'::jsonb,
  result text not null default '',
  human_acceptance text not null default 'unreviewed',
  module text not null default '',
  requirement_id text,
  idea_id text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists studio_change_sessions_project_day_idx
  on studio_change_sessions(project_id, day desc);

create index if not exists studio_change_sessions_created_at_idx
  on studio_change_sessions(created_at desc);
