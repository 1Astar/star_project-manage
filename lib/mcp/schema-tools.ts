import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  canWriteMigrationsLocally,
  writeMigrationFile,
} from "@/lib/mcp/migration-write";

const TABLE_RE = /^studio_[a-z][a-z0-9_]*$/;
const IDENT_RE = /^[a-z][a-z0-9_]*$/;

export const DDL_COLUMN_TYPES = [
  "text",
  "boolean",
  "integer",
  "bigint",
  "numeric",
  "timestamptz",
  "date",
  "jsonb",
  "uuid",
] as const;

export type DdlColumnType = (typeof DDL_COLUMN_TYPES)[number];

function sb() {
  const client = createServiceClient();
  if (!client) {
    throw new Error("Supabase 未配置：需要 NEXT_PUBLIC_SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY");
  }
  return client;
}

function assertTable(name: string) {
  if (!TABLE_RE.test(name)) {
    throw new Error(`表名不合法或非白名单：仅允许 studio_*（小写），收到：${name}`);
  }
}

function assertIdent(name: string, label: string) {
  if (!IDENT_RE.test(name)) {
    throw new Error(`${label} 不合法：须小写字母开头，仅含 a-z0-9_，收到：${name}`);
  }
}

/** 白名单已校验的小写标识符，不加引号（便于 RPC 正则校验） */
function ident(name: string) {
  return name;
}

async function execDdl(ddl: string, migrationSlug: string) {
  if (!isSupabaseConfigured()) {
    throw new Error("未启用 Supabase，无法执行 DDL");
  }
  const { data, error } = await sb().rpc("star_pm_exec_ddl", { p_ddl: ddl });
  if (error) throw new Error(error.message);

  let migrationPath: string | null = null;
  let migrationNote: string;
  if (canWriteMigrationsLocally()) {
    const written = await writeMigrationFile(migrationSlug, `${ddl};\n`);
    migrationPath = written.path;
    migrationNote = `已写入本地 migration：${written.path}`;
  } else {
    migrationNote =
      "当前为远程 MCP，未落盘。请在本地 mcp:stdio 执行同类变更，或手动把下方 SQL 写入 supabase/migrations/。";
  }

  return {
    ok: true as const,
    ddl,
    rpc: data,
    migrationPath,
    migrationNote,
  };
}

export async function listStudioTables() {
  if (!isSupabaseConfigured()) {
    throw new Error("未启用 Supabase");
  }
  const { data, error } = await sb().rpc("star_pm_list_studio_tables");
  if (error) throw new Error(error.message);
  return { tables: data ?? [] };
}

export async function describeStudioTable(table: string) {
  assertTable(table);
  if (!isSupabaseConfigured()) {
    throw new Error("未启用 Supabase");
  }
  const { data, error } = await sb().rpc("star_pm_describe_table", { p_table: table });
  if (error) throw new Error(error.message);
  return data;
}

export type AddColumnInput = {
  table: string;
  column: string;
  type: DdlColumnType;
  nullable?: boolean;
  defaultSql?: string | null;
  confirm: boolean;
};

export async function addColumn(input: AddColumnInput) {
  if (!input.confirm) {
    throw new Error("写库需 confirm: true");
  }
  assertTable(input.table);
  assertIdent(input.column, "列名");
  if (!DDL_COLUMN_TYPES.includes(input.type)) {
    throw new Error(`不支持的类型：${input.type}`);
  }

  const nullSql = input.nullable === false ? " not null" : "";
  let defaultSql = "";
  if (input.defaultSql != null && input.defaultSql !== "") {
    const raw = input.defaultSql.trim();
    if (!/^([0-9]+(\.[0-9]+)?|true|false|null|'[^']*'|::[a-z0-9_ ]+|now\(\)|'\{\}'::jsonb|'\[\]'::jsonb)$/i.test(raw) &&
        !/^'[^']*'::(text|jsonb|timestamptz|uuid)$/i.test(raw)) {
      // 允许少数安全默认值形态
      if (!/^(now\(\)|true|false|null|\d+(\.\d+)?|'([^']*)'(::[a-z0-9_]+)?)$/i.test(raw)) {
        throw new Error("defaultSql 不安全或不支持，请使用 now() / true / false / null / 数字 / '文本' / '[]'::jsonb");
      }
    }
    defaultSql = ` default ${raw}`;
  } else if (input.nullable === false) {
    // NOT NULL 无默认时给类型安全默认，避免空表加列失败
    const fallback: Record<DdlColumnType, string> = {
      text: "''",
      boolean: "false",
      integer: "0",
      bigint: "0",
      numeric: "0",
      timestamptz: "now()",
      date: "current_date",
      jsonb: "'{}'::jsonb",
      uuid: "gen_random_uuid()",
    };
    defaultSql = ` default ${fallback[input.type]}`;
  }

  const ddl =
    `alter table ${ident(input.table)} ` +
    `add column if not exists ${ident(input.column)} ${input.type}${nullSql}${defaultSql}`;

  return execDdl(ddl, `add_${input.table}_${input.column}`);
}

export type CreateTableColumn = {
  name: string;
  type: DdlColumnType;
  primaryKey?: boolean;
  nullable?: boolean;
  defaultSql?: string | null;
  references?: string | null;
};

export type CreateTableInput = {
  table: string;
  columns: CreateTableColumn[];
  confirm: boolean;
};

export async function createStudioTable(input: CreateTableInput) {
  if (!input.confirm) {
    throw new Error("写库需 confirm: true");
  }
  assertTable(input.table);
  if (!input.columns?.length) {
    throw new Error("columns 不能为空");
  }

  const parts: string[] = [];
  for (const col of input.columns) {
    assertIdent(col.name, "列名");
    if (!DDL_COLUMN_TYPES.includes(col.type)) {
      throw new Error(`不支持的类型：${col.type}`);
    }
    let piece = `${ident(col.name)} ${col.type}`;
    if (col.primaryKey) piece += " primary key";
    if (col.nullable === false && !col.primaryKey) piece += " not null";
    if (col.defaultSql != null && col.defaultSql !== "") {
      const raw = col.defaultSql.trim();
      if (!/^(now\(\)|true|false|null|\d+(\.\d+)?|'([^']*)'(::[a-z0-9_]+)?)$/i.test(raw)) {
        throw new Error(`列 ${col.name} 的 defaultSql 不安全`);
      }
      piece += ` default ${raw}`;
    }
    if (col.references) {
      assertTable(col.references);
      piece += ` references ${ident(col.references)}(id) on delete set null`;
    }
    parts.push(piece);
  }

  const ddl = `create table if not exists ${ident(input.table)} (${parts.join(", ")})`;
  return execDdl(ddl, `create_${input.table}`);
}

export type CreateIndexInput = {
  table: string;
  columns: string[];
  name?: string;
  unique?: boolean;
  confirm: boolean;
};

export async function createStudioIndex(input: CreateIndexInput) {
  if (!input.confirm) {
    throw new Error("写库需 confirm: true");
  }
  assertTable(input.table);
  if (!input.columns?.length) {
    throw new Error("columns 不能为空");
  }
  for (const col of input.columns) {
    assertIdent(col, "索引列");
  }
  const indexName =
    input.name?.trim() ||
    `${input.table}_${input.columns.join("_")}_idx`;
  assertIdent(indexName, "索引名");

  const unique = input.unique ? " unique" : "";
  const ddl =
    `create${unique} index if not exists ${ident(indexName)} ` +
    `on ${ident(input.table)} (${input.columns.map(ident).join(", ")})`;

  return execDdl(ddl, `index_${indexName}`);
}
