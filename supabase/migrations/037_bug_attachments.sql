-- Bug 截图 / 附件（对话导入、详情页上传）

create table if not exists bug_attachments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  bug_id uuid not null references bugs(id) on delete cascade,
  title text not null,
  url text not null,
  storage_path text,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists bug_attachments_bug_idx
  on bug_attachments (bug_id, created_at desc);

create index if not exists bug_attachments_project_idx
  on bug_attachments (project_id);
