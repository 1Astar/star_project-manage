-- Project interviews: 访谈记录 + 产品判断 + 待验证假设；可挂多条需求

create table if not exists project_interviews (
  id text primary key,
  project_id text not null,
  title text not null,
  interviewee text,
  interviewed_at timestamptz,
  record_notes text not null default '',
  product_judgment text not null default '',
  hypotheses jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_interviews_project_idx
  on project_interviews (project_id, updated_at desc);

create table if not exists interview_requirement_links (
  id text primary key,
  project_id text not null,
  interview_id text not null,
  requirement_id text not null,
  created_at timestamptz not null default now(),
  unique (interview_id, requirement_id)
);

create index if not exists interview_req_links_requirement_idx
  on interview_requirement_links (requirement_id);

create index if not exists interview_req_links_interview_idx
  on interview_requirement_links (interview_id);

alter table project_interviews enable row level security;
alter table interview_requirement_links enable row level security;

drop policy if exists "admin_all_project_interviews" on project_interviews;
create policy "admin_all_project_interviews" on project_interviews
  for all using (true) with check (true);

drop policy if exists "admin_all_interview_requirement_links" on interview_requirement_links;
create policy "admin_all_interview_requirement_links" on interview_requirement_links
  for all using (true) with check (true);
