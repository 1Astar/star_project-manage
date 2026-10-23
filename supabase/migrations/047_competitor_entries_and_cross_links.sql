-- 竞品条目 + 学习/Bug 可选交叉链接字段

create table if not exists competitor_entries (
  id text primary key,
  project_id text not null,
  title text not null,
  summary text not null default '',
  url text null,
  module_path text null,
  linked_learning_note_ids jsonb not null default '[]'::jsonb,
  linked_requirement_ids jsonb not null default '[]'::jsonb,
  linked_bug_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists competitor_entries_project_idx
  on competitor_entries (project_id, updated_at desc);

alter table competitor_entries enable row level security;

drop policy if exists "admin_all_competitor_entries" on competitor_entries;
create policy "admin_all_competitor_entries" on competitor_entries
  for all using (true) with check (true);

alter table project_learning_notes
  add column if not exists linked_competitor_ids jsonb not null default '[]'::jsonb;

alter table project_learning_notes
  add column if not exists linked_bug_ids jsonb not null default '[]'::jsonb;

alter table bugs
  add column if not exists linked_learning_note_ids jsonb not null default '[]'::jsonb;

alter table bugs
  add column if not exists linked_competitor_ids jsonb not null default '[]'::jsonb;

comment on table competitor_entries is
  '项目内竞品条目，可被学习/需求/Bug 交叉引用';
comment on column project_learning_notes.linked_competitor_ids is
  '关联竞品条目 id 列表';
comment on column project_learning_notes.linked_bug_ids is
  '关联 Bug id 列表';
comment on column bugs.linked_learning_note_ids is
  '关联学习知识点 id 列表';
comment on column bugs.linked_competitor_ids is
  '关联竞品条目 id 列表';
