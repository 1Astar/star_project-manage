-- P1: GitHub Release/Tag 缓存
create table if not exists studio_releases (
  id text primary key,
  project_id text not null references studio_projects(id) on delete cascade,
  tag text not null,
  name text not null default '',
  published_at timestamptz,
  body text not null default '',
  html_url text not null default '',
  is_prerelease boolean not null default false,
  source text not null default 'release',
  synced_at timestamptz not null default now(),
  unique (project_id, tag)
);

create index if not exists studio_releases_project_idx on studio_releases(project_id);

-- P2: 迭代时间切片 + 绑定版本
alter table iterations
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists release_tag text;
