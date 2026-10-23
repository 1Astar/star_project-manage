-- 学习池：关联需求 + 优化建议（可一键生成需求）

alter table project_learning_notes
  add column if not exists linked_requirement_ids jsonb not null default '[]'::jsonb;

alter table project_learning_notes
  add column if not exists suggestions jsonb not null default '[]'::jsonb;

comment on column project_learning_notes.linked_requirement_ids is
  '关联的需求 id 列表（json string[]）';

comment on column project_learning_notes.suggestions is
  '优化建议列表：[{id,title,detail,linked_requirement_id,created_at}]';
