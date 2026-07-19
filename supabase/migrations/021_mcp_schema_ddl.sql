-- MCP 受控 DDL：查表结构 + 执行白名单 DDL（禁止 DROP / 任意 SQL）
-- 注：原 019_mcp_schema_ddl 与 019_requirement_tree_links 撞号，改此序号

create or replace function public.star_pm_list_studio_tables()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'table', c.relname,
        'approxRows', greatest(c.reltuples::bigint, 0)
      )
      order by c.relname
    ),
    '[]'::jsonb
  )
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname like 'studio\_%' escape '\';
$$;

create or replace function public.star_pm_describe_table(p_table text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if p_table is null or p_table !~ '^studio_[a-z0-9_]+$' then
    raise exception 'table 不在白名单：仅允许 studio_*';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'column', cols.column_name,
        'type', cols.data_type,
        'udt', cols.udt_name,
        'nullable', cols.is_nullable = 'YES',
        'default', cols.column_default
      )
      order by cols.ordinal_position
    ),
    '[]'::jsonb
  )
  into result
  from information_schema.columns cols
  where cols.table_schema = 'public'
    and cols.table_name = p_table;

  if result = '[]'::jsonb then
    raise exception '表不存在或无列：%', p_table;
  end if;

  return jsonb_build_object('table', p_table, 'columns', result);
end;
$$;

create or replace function public.star_pm_exec_ddl(p_ddl text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text;
begin
  if p_ddl is null or length(trim(p_ddl)) = 0 then
    raise exception 'ddl 不能为空';
  end if;

  normalized := lower(regexp_replace(trim(p_ddl), '\s+', ' ', 'g'));

  if normalized ~ '(^|[^a-z])(drop|truncate|delete|update|insert|grant|revoke|alter\s+role|create\s+role|copy|execute|call)([^a-z]|$)' then
    raise exception '拒绝高危或非白名单 DDL';
  end if;

  if normalized !~ '^(alter table studio_[a-z0-9_]+ add column if not exists |create table if not exists studio_[a-z0-9_]+|create( unique)? index if not exists [a-z0-9_]+ on studio_[a-z0-9_]+)' then
    raise exception '仅允许：studio_* 的 ADD COLUMN / CREATE TABLE / CREATE INDEX（IF NOT EXISTS）';
  end if;

  execute p_ddl;
  return jsonb_build_object('ok', true, 'ddl', p_ddl);
end;
$$;

revoke all on function public.star_pm_list_studio_tables() from public;
revoke all on function public.star_pm_describe_table(text) from public;
revoke all on function public.star_pm_exec_ddl(text) from public;

grant execute on function public.star_pm_list_studio_tables() to service_role;
grant execute on function public.star_pm_describe_table(text) to service_role;
grant execute on function public.star_pm_exec_ddl(text) to service_role;
