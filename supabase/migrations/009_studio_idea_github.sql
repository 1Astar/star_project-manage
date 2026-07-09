-- Idea Inbox：GitHub Issue 中转 + 项目恢复卡 Git 字段

alter table studio_ideas
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists github_issue_number integer,
  add column if not exists github_issue_url text,
  add column if not exists github_labels text[] not null default '{}',
  add column if not exists suggested_next_step text not null default '';

create unique index if not exists studio_ideas_github_issue_idx
  on studio_ideas (github_issue_number)
  where github_issue_number is not null;

alter table studio_projects
  add column if not exists github_repo text,
  add column if not exists vercel_url text,
  add column if not exists last_commit_message text,
  add column if not exists last_commit_at timestamptz;
