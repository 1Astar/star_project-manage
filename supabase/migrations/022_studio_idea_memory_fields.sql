-- Ideas 记忆层字段（MCP search / 完整导入模板）
-- 注：原 020 文件因 019 撞号顺延至此

alter table studio_ideas
  add column if not exists chat_topic text not null default '',
  add column if not exists ai_supplement text not null default '',
  add column if not exists source_chat text not null default '',
  add column if not exists source_method text not null default '',
  add column if not exists related_module text not null default '',
  add column if not exists decision_notes text not null default '',
  add column if not exists evolution_notes text not null default '',
  add column if not exists related_assets_note text not null default '';

update studio_ideas
set source_method = trigger_source
where coalesce(source_method, '') = ''
  and coalesce(trigger_source, '') <> '';

create index if not exists studio_ideas_source_method_idx on studio_ideas (source_method);
create index if not exists studio_ideas_related_module_idx on studio_ideas (related_module);
create index if not exists studio_ideas_chat_topic_idx on studio_ideas (chat_topic);
