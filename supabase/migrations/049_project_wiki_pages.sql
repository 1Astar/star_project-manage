-- Notion 风层层子页：挂模块主页或总览实体

create table if not exists project_wiki_pages (
  id text primary key,
  project_id text not null,
  parent_id text null references project_wiki_pages (id) on delete cascade,
  title text not null default '',
  body text not null default '',
  sort_order integer not null default 0,
  host_kind text not null,
  host_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_wiki_pages_host_kind_check check (
    host_kind in ('module', 'requirement', 'bug', 'learning', 'prd', 'competitor')
  )
);

create index if not exists project_wiki_pages_project_host_idx
  on project_wiki_pages (project_id, host_kind, host_key, parent_id, sort_order);

create index if not exists project_wiki_pages_parent_idx
  on project_wiki_pages (parent_id);

alter table project_wiki_pages enable row level security;

drop policy if exists "admin_all_project_wiki_pages" on project_wiki_pages;
create policy "admin_all_project_wiki_pages" on project_wiki_pages
  for all using (true) with check (true);

comment on table project_wiki_pages is
  'Notion 风 Wiki 页树；根挂模块名或实体 id，子页 parent_id 任意嵌套';
