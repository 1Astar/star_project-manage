-- Bug 关联规划迭代（期）+ 报告人 + 关注人

alter table public.bugs
  add column if not exists iteration_id text;

alter table public.bugs
  add column if not exists reporter_name text;

alter table public.bugs
  add column if not exists watchers text[] not null default '{}';

create index if not exists bugs_iteration_idx
  on public.bugs (iteration_id)
  where iteration_id is not null;

comment on column public.bugs.iteration_id is '关联规划迭代（期）iterations.id';
comment on column public.bugs.reporter_name is '报告人显示名（创建时写入当前用户）';
comment on column public.bugs.watchers is '关注人姓名列表；状态变更/评论时按 recipient_name 通知';
