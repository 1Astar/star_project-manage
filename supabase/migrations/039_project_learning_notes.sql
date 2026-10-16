-- 项目学习池：个人学习笔记（为什么 / 原理 / 协议 / 技术背景 / 竞品 / 产品思考）

create table if not exists project_learning_notes (
  id text primary key,
  project_id text not null,
  title text not null,
  why_text text not null default '',
  principle text not null default '',
  protocol text not null default '',
  tech_background text not null default '',
  competitors text not null default '',
  product_thinking text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_learning_notes_project_idx
  on project_learning_notes (project_id, updated_at desc);

alter table project_learning_notes enable row level security;

drop policy if exists "admin_all_project_learning_notes" on project_learning_notes;
create policy "admin_all_project_learning_notes" on project_learning_notes
  for all using (true) with check (true);
