-- 防止同项目同一灵感反复落入需求池
create unique index if not exists requirements_project_studio_idea_uidx
  on requirements (project_id, studio_idea_id)
  where studio_idea_id is not null;
