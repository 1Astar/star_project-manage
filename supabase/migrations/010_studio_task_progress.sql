-- 项目需求任务：进度备注 + Git 完成检测

alter table studio_tasks
  add column if not exists progress_note text not null default '',
  add column if not exists completion_source text,
  add column if not exists git_commit_sha text,
  add column if not exists git_commit_message text,
  add column if not exists source_idea_id text references studio_ideas(id) on delete set null;

create index if not exists studio_tasks_source_idea_idx on studio_tasks(source_idea_id);
