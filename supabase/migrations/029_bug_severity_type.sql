-- Bug：严重程度 + 类型（禅道式）
alter table public.bugs
  add column if not exists severity integer not null default 3,
  add column if not exists bug_type text not null default 'code';

comment on column public.bugs.severity is '1 highest .. 4 lowest';
comment on column public.bugs.bug_type is 'code|ui|performance|security|design|config|install|other';
