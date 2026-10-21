-- Bug 结构化复现 + 模块/发现版本/环境/优先级（与严重程度分开）
-- 本期不做：测试计划实体、独立开发环境配置

alter table public.bugs
  add column if not exists precondition text,
  add column if not exists expected_result text,
  add column if not exists actual_result text,
  add column if not exists module_path text,
  add column if not exists found_version text,
  add column if not exists environments text[] not null default '{}',
  add column if not exists priority text;

comment on column public.bugs.precondition is '前置条件';
comment on column public.bugs.repro_steps is '复现步骤';
comment on column public.bugs.expected_result is '预期结果';
comment on column public.bugs.actual_result is '实际结果';
comment on column public.bugs.module_path is '功能模块，对齐项目 featureModules / 板块路径';
comment on column public.bugs.found_version is '发现版本（自由文本，可填 Release/客户端版本）';
comment on column public.bugs.environments is '环境标签，如 Android/iOS/macOS/Windows/Web';
comment on column public.bugs.priority is '优先级 P0|P1|P2|P3；与 severity（严重程度）分开';
comment on column public.bugs.severity is '严重程度 1致命…4轻微；与 priority 分开';
