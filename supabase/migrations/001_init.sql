-- Star PM initial schema

create type task_status as enum (
  'pending',
  'in_progress',
  'integration',
  'testing',
  'acceptance',
  'done',
  'blocked'
);

create type role_type as enum (
  'product',
  'ui',
  'hardware',
  'embedded',
  'backend',
  'frontend',
  'algorithm',
  'test'
);

create type estimate_level as enum ('module', 'requirement');

create type prototype_type as enum ('html_zip', 'external_url');

create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table iterations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table modules (
  id uuid primary key default gen_random_uuid(),
  iteration_id uuid not null references iterations(id) on delete cascade,
  parent_id uuid references modules(id) on delete cascade,
  name text not null,
  level int not null check (level in (1, 2)),
  estimate_level estimate_level not null default 'requirement',
  module_estimate_hours numeric(10,2),
  sort_order int not null default 0
);

create table requirements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  iteration_id uuid not null references iterations(id) on delete cascade,
  module_l1_id uuid references modules(id) on delete set null,
  module_l2_id uuid references modules(id) on delete set null,
  title text not null,
  sub_function text,
  detail_work text,
  acceptance_criteria text,
  priority text,
  status task_status not null default 'pending',
  blocker_reason text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table acceptance_items (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references requirements(id) on delete cascade,
  description text not null,
  passed boolean,
  note text,
  sort_order int not null default 0
);

create table role_tasks (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references requirements(id) on delete cascade,
  role role_type not null,
  assignee text,
  estimate_hours numeric(10,2),
  actual_hours numeric(10,2),
  start_date date,
  end_date date,
  status task_status not null default 'pending',
  notes text,
  blocker_reason text,
  progress_percent numeric(5,2),
  updated_at timestamptz not null default now(),
  unique (requirement_id, role)
);

create table test_records (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references requirements(id) on delete cascade,
  role_task_id uuid references role_tasks(id) on delete set null,
  passed boolean not null,
  issue_description text,
  tester_name text not null,
  created_at timestamptz not null default now()
);

create table acceptance_records (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references requirements(id) on delete cascade,
  acceptance_item_id uuid not null references acceptance_items(id) on delete cascade,
  passed boolean not null,
  note text,
  reviewer_name text not null,
  created_at timestamptz not null default now()
);

create table share_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  role text not null,
  label text not null,
  token_hash text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table prototypes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  type prototype_type not null,
  storage_path text,
  external_url text,
  requirement_id uuid references requirements(id) on delete set null,
  created_at timestamptz not null default now()
);

create table bugs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  requirement_id uuid references requirements(id) on delete set null,
  title text not null,
  description text,
  repro_steps text,
  assignee text,
  status task_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  recipient_name text,
  type text not null,
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table activity_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  field_name text not null,
  old_value text,
  new_value text,
  actor_name text not null,
  actor_role text,
  created_at timestamptz not null default now()
);

create index idx_requirements_project on requirements(project_id);
create index idx_requirements_iteration on requirements(iteration_id);
create index idx_role_tasks_requirement on role_tasks(requirement_id);
create index idx_role_tasks_status on role_tasks(status);
create index idx_notifications_recipient on notifications(recipient_name, is_read);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger requirements_updated_at
before update on requirements
for each row execute function set_updated_at();

create trigger bugs_updated_at
before update on bugs
for each row execute function set_updated_at();
