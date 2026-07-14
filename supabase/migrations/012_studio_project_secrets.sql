-- 项目密钥：名称 + 加密值（应用层 AES-256-GCM，密钥见 SECRETS_ENCRYPTION_KEY）

create table if not exists studio_project_secrets (
  id text primary key,
  project_id text not null references studio_projects(id) on delete cascade,
  name text not null,
  encrypted_value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, name)
);

create index if not exists studio_project_secrets_project_idx on studio_project_secrets(project_id);
