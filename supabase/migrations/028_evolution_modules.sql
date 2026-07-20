-- 迭代记录：演进挂板块 / 版本；项目可配功能板块列表
alter table studio_evolution_logs
  add column if not exists module text not null default '',
  add column if not exists release_tag text;

create index if not exists studio_evolution_logs_module_idx
  on studio_evolution_logs(project_id, module);

create index if not exists studio_evolution_logs_release_tag_idx
  on studio_evolution_logs(project_id, release_tag);

alter table studio_projects
  add column if not exists feature_modules jsonb not null default '[]'::jsonb;
