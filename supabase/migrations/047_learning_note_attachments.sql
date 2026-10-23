-- 学习笔记附件 / 截图（粘贴、拖拽、文件选择）

create table if not exists learning_note_attachments (
  id text primary key,
  project_id text not null,
  note_id text not null,
  title text not null,
  url text not null,
  storage_path text,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists learning_note_attachments_note_idx
  on learning_note_attachments (note_id, created_at desc);

create index if not exists learning_note_attachments_project_idx
  on learning_note_attachments (project_id);

alter table learning_note_attachments enable row level security;

drop policy if exists "admin_all_learning_note_attachments" on learning_note_attachments;
create policy "admin_all_learning_note_attachments" on learning_note_attachments
  for all using (true) with check (true);

comment on table learning_note_attachments is
  '学习池笔记附件（截图/文件）；存储走 studio-assets';
