-- Studio 任务：排期与工时

alter table studio_tasks
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists estimate_hours numeric(6, 1),
  add column if not exists actual_hours numeric(6, 1),
  add column if not exists completed_at timestamptz;
