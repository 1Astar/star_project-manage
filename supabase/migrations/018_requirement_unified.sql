-- 需求（灵感）统一实体字段：状态标签、多指派、双来源、完成时间等

alter table requirements
  add column if not exists status_tags jsonb not null default '[]'::jsonb,
  add column if not exists assignees jsonb not null default '[]'::jsonb,
  add column if not exists req_source text,
  add column if not exists req_source_note text,
  add column if not exists inspiration_source text,
  add column if not exists next_step text,
  add column if not exists completed_at timestamptz,
  add column if not exists studio_idea_id text;

-- 从旧 status 枚举回填标签（仅空标签时）
update requirements
set status_tags = case status
  when 'pending' then '["待开始"]'::jsonb
  when 'in_progress' then '["开发中"]'::jsonb
  when 'integration' then '["待联调"]'::jsonb
  when 'testing' then '["待测试"]'::jsonb
  when 'acceptance' then '["待验收"]'::jsonb
  when 'done' then '["完成"]'::jsonb
  when 'blocked' then '["阻塞"]'::jsonb
  else '["待开始"]'::jsonb
end
where coalesce(jsonb_array_length(status_tags), 0) = 0;

update requirements
set completed_at = updated_at
where status = 'done' and completed_at is null;

create index if not exists requirements_studio_idea_id_idx
  on requirements (studio_idea_id)
  where studio_idea_id is not null;
