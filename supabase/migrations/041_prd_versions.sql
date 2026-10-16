-- PRD 文档小版本快照（1.0 / 1.0.1…），挂在 project_prds 行上

alter table project_prds
  add column if not exists versions jsonb not null default '[]'::jsonb;
