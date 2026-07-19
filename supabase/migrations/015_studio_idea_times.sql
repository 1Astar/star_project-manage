-- 灵感：发生时间 + 完成时间

alter table studio_ideas
  add column if not exists occurred_at timestamptz,
  add column if not exists completed_at timestamptz;

-- 存量：发生时间默认等于创建时间
update studio_ideas
set occurred_at = created_at
where occurred_at is null;

-- 已完成但无完成时间：用 updated_at 兜底
update studio_ideas
set completed_at = coalesce(updated_at, created_at)
where status = 'done' and completed_at is null;

create index if not exists studio_ideas_occurred_at_idx on studio_ideas(occurred_at desc);
