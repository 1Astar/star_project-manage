-- Extra requirement pool fields (Notion-aligned)

alter table requirements add column if not exists submitted_at date;
alter table requirements add column if not exists due_date date;
alter table requirements add column if not exists difficulty_notes text;
alter table requirements add column if not exists scenario text;
alter table requirements add column if not exists needs_discussion boolean not null default false;

-- Backfill submitted_at from created_at for existing rows
update requirements
set submitted_at = (created_at at time zone 'UTC')::date
where submitted_at is null and created_at is not null;
