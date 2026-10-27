-- Bug：解决版本 / 更新人 / 关联执行用例 / 自定义列值

alter table public.bugs
  add column if not exists resolved_version text;

alter table public.bugs
  add column if not exists updated_by text;

alter table public.bugs
  add column if not exists execution_case text;

alter table public.bugs
  add column if not exists custom_fields jsonb not null default '{}'::jsonb;

comment on column public.bugs.resolved_version is '解决版本（自由文本）';
comment on column public.bugs.updated_by is '最近更新人显示名';
comment on column public.bugs.execution_case is '关联执行用例（自由文本；本期无用例库）';
comment on column public.bugs.custom_fields is '自定义列值：key → 标量';
