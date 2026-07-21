-- 全局 UI / 工作台偏好（跨设备同步）
create table if not exists studio_app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
