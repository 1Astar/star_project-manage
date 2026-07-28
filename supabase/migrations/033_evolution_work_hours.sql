-- 演进记录：聊天时间戳工时（开始 / 结束）

alter table studio_evolution_logs
  add column if not exists work_started_at timestamptz,
  add column if not exists work_finished_at timestamptz;
