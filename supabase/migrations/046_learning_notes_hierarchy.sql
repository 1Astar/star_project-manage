-- 学习池三级树：板块(section) → 主题(topic) → 子知识点(point)

alter table project_learning_notes
  add column if not exists kind text not null default 'topic';

alter table project_learning_notes
  add column if not exists parent_id text null;

alter table project_learning_notes
  add column if not exists sort_order integer not null default 0;

comment on column project_learning_notes.kind is
  'section=板块 / topic=主题 / point=子知识点';

comment on column project_learning_notes.parent_id is
  '父节点 id；板块为空；主题挂板块；子挂主题';

comment on column project_learning_notes.sort_order is
  '同级排序，小在前';

create index if not exists project_learning_notes_parent_idx
  on project_learning_notes (project_id, parent_id, sort_order);

-- 旧数据：无 kind 时 default topic；无父视为「未分板块」下的主题
update project_learning_notes
set kind = 'topic'
where kind is null or kind = '';
