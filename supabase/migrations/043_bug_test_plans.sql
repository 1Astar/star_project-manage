-- Bug 测试计划实体（轻量）：项目下可建计划，Bug 可关联；不含用例库 / 执行记录

create table if not exists public.bug_test_plans (
  id text primary key,
  project_id text not null,
  title text not null,
  description text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bug_test_plans_project_idx
  on public.bug_test_plans (project_id, status, updated_at desc);

alter table public.bugs
  add column if not exists test_plan_id text;

create index if not exists bugs_test_plan_idx
  on public.bugs (test_plan_id)
  where test_plan_id is not null;

comment on table public.bug_test_plans is '测试计划（如 TP-文件备份）；Bug 通过 test_plan_id 关联';
comment on column public.bugs.test_plan_id is '关联的测试计划 id（bug_test_plans.id）';

alter table public.bug_test_plans enable row level security;

drop policy if exists "admin_all_bug_test_plans" on public.bug_test_plans;
create policy "admin_all_bug_test_plans" on public.bug_test_plans
  for all using (true) with check (true);
