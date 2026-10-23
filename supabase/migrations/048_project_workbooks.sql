-- 项目内嵌工作簿（FortuneSheet JSON 存盘）

create table if not exists project_workbooks (
  id text primary key,
  project_id text not null,
  title text not null,
  sheet_data jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_workbooks_project_idx
  on project_workbooks (project_id, updated_at desc);

alter table project_workbooks enable row level security;

drop policy if exists "admin_all_project_workbooks" on project_workbooks;
create policy "admin_all_project_workbooks" on project_workbooks
  for all using (true) with check (true);

comment on table project_workbooks is
  '项目内飞书级基础表格工作簿；sheet_data 为 FortuneSheet Sheet[] JSON';
