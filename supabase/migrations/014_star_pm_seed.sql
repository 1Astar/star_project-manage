-- Star PM 项目种子（与 lib/db/seed-data.ts 对齐）
-- 依赖：PM 表 projects 的 Git 字段（原 005）；若未跑过 005，这里先补齐

alter table projects
  add column if not exists repo_full_name text,
  add column if not exists repo_branch text,
  add column if not exists repo_url text,
  add column if not exists demo_url text,
  add column if not exists local_run_guide text,
  add column if not exists code_path text;

insert into projects (
  id, name, slug, description, created_at,
  repo_full_name, repo_branch, repo_url, demo_url, local_run_guide, code_path
) values (
  'a1000001-0001-4001-8001-000000000003',
  'Star PM', 'star-pm', '轻量原型项目管理 + Idea Studio', '2026-06-22T00:00:00Z',
  '1Astar/star_project-manage', 'main', 'https://github.com/1Astar/star_project-manage',
  'https://star-project-manage.vercel.app', 'cd star-pm' || E'\n' || 'npm run dev', '工具/private/工具/star-pm'
) on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  repo_full_name = excluded.repo_full_name,
  repo_branch = excluded.repo_branch,
  repo_url = excluded.repo_url,
  demo_url = excluded.demo_url,
  local_run_guide = excluded.local_run_guide,
  code_path = excluded.code_path;

insert into iterations (id, project_id, name, sort_order, created_at) values
  ('a2000001-0001-4001-8001-000000000003', 'a1000001-0001-4001-8001-000000000003', '202607 V1.2 Studio 整合', 1, '2026-06-22T00:00:00Z')
on conflict (id) do nothing;

insert into requirements (id, project_id, iteration_id, title, sub_function, detail_work, acceptance_criteria, priority, status, sort_order, created_at, updated_at) values
  ('b1000001-0001-4001-8001-000000000006', 'a1000001-0001-4001-8001-000000000003', 'a2000001-0001-4001-8001-000000000003', 'Star PM 桥接 Studio 项目', 'proj-star-pm ↔ star-pm', 'PM 需求看板 + Studio 任务同页展示', '打开 /projects/proj-star-pm 可见上下双轨任务区', 'P0', 'in_progress', 1, '2026-06-22T00:00:00Z', '2026-06-22T00:00:00Z'),
  ('b1000001-0001-4001-8001-000000000007', 'a1000001-0001-4001-8001-000000000003', 'a2000001-0001-4001-8001-000000000003', '任务页整合灵感 + Notion 式表格', '关联灵感 / PM 看板 / Studio 任务', null, 'tasks 页按顺序展示三块区域，表格可展开备注', 'P0', 'in_progress', 2, '2026-06-22T00:00:00Z', '2026-06-22T00:00:00Z'),
  ('b1000001-0001-4001-8001-000000000008', 'a1000001-0001-4001-8001-000000000003', 'a2000001-0001-4001-8001-000000000003', '全项目 Git 绑定（总仓 + code_path）', 'Studio Git + Cron 同步 + PM 镜像', '默认总仓 1Astar/star_project-manage，monorepo 按 path 过滤', 'Recovery 页可配置仓库/分支/目录，Cron 同步 commit', 'P1', 'testing', 3, '2026-06-22T00:00:00Z', '2026-06-22T00:00:00Z')
on conflict (id) do nothing;

insert into acceptance_items (id, requirement_id, description, passed, note, sort_order) values
  ('c1000001-0001-4001-8001-000000000006', 'b1000001-0001-4001-8001-000000000006', 'Star PM 桥接 Studio 项目 - 双轨页面可访问', null, null, 1),
  ('c1000001-0001-4001-8001-000000000007', 'b1000001-0001-4001-8001-000000000007', '任务页整合灵感 + Notion 式表格 - 三块区域顺序正确', null, null, 1),
  ('c1000001-0001-4001-8001-000000000008', 'b1000001-0001-4001-8001-000000000008', '全项目 Git 绑定（总仓 + code_path） - Git 同步可用', null, null, 1)
on conflict (id) do nothing;

insert into role_tasks (id, requirement_id, role, assignee, estimate_hours, start_date, end_date, status, notes, progress_percent, updated_at) values
  ('d1000001-0001-4001-8001-000000000009', 'b1000001-0001-4001-8001-000000000006', 'frontend', '产品', 8, '2026-07-10', '2026-07-13', 'in_progress', '桥接 + tasks 页布局', 75, '2026-06-22T00:00:00Z'),
  ('d1000001-0001-4001-8001-000000000010', 'b1000001-0001-4001-8001-000000000007', 'frontend', '产品', 6, '2026-07-11', '2026-07-14', 'in_progress', '灵感表格 + capture 默认项目', 60, '2026-06-22T00:00:00Z'),
  ('d1000001-0001-4001-8001-000000000011', 'b1000001-0001-4001-8001-000000000008', 'backend', '产品', 4, null, null, 'testing', '013 迁移 + sync API', 90, '2026-06-22T00:00:00Z')
on conflict (id) do nothing;
