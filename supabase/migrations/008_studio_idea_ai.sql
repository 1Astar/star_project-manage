-- Idea Studio：AI 拆解字段（优先级 / 关联灵感 / 子任务 / 原始输入）

alter table studio_ideas
  add column if not exists priority text not null default 'P2',
  add column if not exists raw_input text not null default '',
  add column if not exists related_idea_id text references studio_ideas(id) on delete set null,
  add column if not exists subtasks jsonb not null default '[]'::jsonb;

create index if not exists studio_ideas_related_idea_idx on studio_ideas(related_idea_id);
create index if not exists studio_ideas_priority_idx on studio_ideas(priority);
