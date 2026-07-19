-- 需求级附件（Notion 式需求页附图）

create table if not exists requirement_attachments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  requirement_id uuid not null references requirements(id) on delete cascade,
  title text not null,
  url text not null,
  storage_path text,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists requirement_attachments_req_idx
  on requirement_attachments (requirement_id, created_at desc);

create index if not exists requirement_attachments_project_idx
  on requirement_attachments (project_id);
