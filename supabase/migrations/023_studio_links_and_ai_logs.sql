-- Studio 关系边 + AI 操作日志（MCP P2）

create table if not exists studio_links (
  id text primary key,
  source_type text not null,
  source_id text not null,
  target_type text not null,
  target_id text not null,
  relation_type text not null default 'related',
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists studio_links_source_idx on studio_links (source_type, source_id);
create index if not exists studio_links_target_idx on studio_links (target_type, target_id);
create unique index if not exists studio_links_edge_uidx
  on studio_links (source_type, source_id, target_type, target_id, relation_type);

create table if not exists studio_ai_action_logs (
  id text primary key,
  action text not null,
  source text not null default 'MCP',
  reason text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists studio_ai_action_logs_created_idx
  on studio_ai_action_logs (created_at desc);
create index if not exists studio_ai_action_logs_action_idx
  on studio_ai_action_logs (action);
