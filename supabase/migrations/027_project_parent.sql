-- Project parent/child (one level only)
-- Studio 项目库 + PM projects 表

alter table studio_projects
  add column if not exists parent_id text references studio_projects(id) on delete set null;

create index if not exists idx_studio_projects_parent on studio_projects(parent_id);

alter table projects
  add column if not exists parent_id uuid references projects(id) on delete set null;

create index if not exists idx_projects_parent on projects(parent_id);

-- 生产已知映射：元井水泵挂到 AI 控制器下（行不存在则跳过）
update studio_projects
set parent_id = 'proj-ai-controller'
where id = 'proj-c84ff6fa'
  and parent_id is null
  and exists (select 1 from studio_projects where id = 'proj-ai-controller');
