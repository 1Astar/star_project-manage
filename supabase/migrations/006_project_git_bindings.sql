-- 真实项目 Git 绑定（在 005_git.sql 之后执行）
-- 按实际 slug 修改 WHERE 条件；以下为 Star PM 本仓库示例

update projects
set
  repo_full_name = '1Astar/star_project-manage',
  repo_branch = '0623',
  repo_url = 'https://github.com/1Astar/star_project-manage',
  demo_url = 'https://star-project-manage.vercel.app',
  local_run_guide = 'cd star-pm' || E'\n' || 'npm run dev',
  code_path = '工具/star-pm'
where slug = 'star-pm';

-- 若尚无 star-pm 项目，可先插入（按需取消注释并改 slug/id）：
-- insert into projects (
--   id, name, slug, description, created_at,
--   repo_full_name, repo_branch, repo_url, demo_url, local_run_guide, code_path
-- ) values (
--   'a1000001-0001-4001-8001-000000000003',
--   'Star PM', 'star-pm', '轻量原型项目管理工具', now(),
--   '1Astar/star_project-manage', '0623', 'https://github.com/1Astar/star_project-manage',
--   'https://star-project-manage.vercel.app', 'cd star-pm' || E'\n' || 'npm run dev', '工具/star-pm'
-- ) on conflict (slug) do update set
--   repo_full_name = excluded.repo_full_name,
--   repo_branch = excluded.repo_branch,
--   repo_url = excluded.repo_url,
--   demo_url = excluded.demo_url,
--   local_run_guide = excluded.local_run_guide,
--   code_path = excluded.code_path;
