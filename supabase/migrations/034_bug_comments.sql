-- Bug 补充 / 评论（多人可写）

create table if not exists bug_comments (
  id text primary key,
  project_id text not null,
  bug_id text not null,
  author_name text not null,
  author_role text,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_bug_comments_bug on bug_comments(bug_id, created_at desc);
create index if not exists idx_bug_comments_project on bug_comments(project_id, created_at desc);

alter table bug_comments enable row level security;

drop policy if exists "admin_all_bug_comments" on bug_comments;
create policy "admin_all_bug_comments" on bug_comments
  for all using (true) with check (true);
