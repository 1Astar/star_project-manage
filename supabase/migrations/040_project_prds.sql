-- 项目 PRD：正文服务端存储 + 审阅评论 + 分享 token；原型可备注关联 PRD

create table if not exists project_prds (
  id text primary key,
  project_id text not null,
  title text not null,
  module_path text,
  html_content text not null default '',
  share_token text unique,
  linked_prototypes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_prds_project_idx
  on project_prds (project_id, updated_at desc);

create index if not exists project_prds_module_idx
  on project_prds (project_id, module_path);

create table if not exists prd_review_comments (
  id text primary key,
  prd_id text not null references project_prds(id) on delete cascade,
  project_id text not null,
  anchor_text text not null default '',
  anchor_selector text,
  body text not null default '',
  author text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prd_review_comments_prd_idx
  on prd_review_comments (prd_id, created_at);

alter table prototypes add column if not exists prd_id text;
alter table prototypes add column if not exists prd_note text;

alter table project_prds enable row level security;
alter table prd_review_comments enable row level security;

drop policy if exists "admin_all_project_prds" on project_prds;
create policy "admin_all_project_prds" on project_prds
  for all using (true) with check (true);

drop policy if exists "admin_all_prd_review_comments" on prd_review_comments;
create policy "admin_all_prd_review_comments" on prd_review_comments
  for all using (true) with check (true);
