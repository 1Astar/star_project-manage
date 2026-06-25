import { createServiceClient } from "@/lib/supabase/server";
import type { DatabaseSnapshot } from "@/lib/db/types";
import type { PrototypeAnnotation } from "@/lib/types";

function client() {
  const sb = createServiceClient();
  if (!sb) throw new Error("Supabase 未配置：需要 NEXT_PUBLIC_SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY");
  return sb;
}

function throwOnError<T>(result: { data: T | null; error: { message: string } | null }, label: string): T {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return (result.data ?? []) as T;
}

export async function readSupabaseDb(): Promise<DatabaseSnapshot> {
  const sb = client();
  const [
    projects,
    iterations,
    modules,
    requirements,
    acceptance_items,
    role_tasks,
    test_records,
    acceptance_records,
    share_links,
    prototypes,
    prototype_annotations,
    bugs,
    notifications,
    activity_logs,
    project_members,
    pool_column_defs,
  ] = await Promise.all([
    sb.from("projects").select("*"),
    sb.from("iterations").select("*"),
    sb.from("modules").select("*"),
    sb.from("requirements").select("*"),
    sb.from("acceptance_items").select("*"),
    sb.from("role_tasks").select("*"),
    sb.from("test_records").select("*"),
    sb.from("acceptance_records").select("*"),
    sb.from("share_links").select("*"),
    sb.from("prototypes").select("*"),
    sb.from("prototype_annotations").select("*"),
    sb.from("bugs").select("*"),
    sb.from("notifications").select("*").order("created_at", { ascending: false }),
    sb.from("activity_logs").select("*").order("created_at", { ascending: false }),
    sb.from("project_members").select("*"),
    sb.from("pool_column_defs").select("*"),
  ]);

  return {
    projects: (throwOnError(projects, "projects") as DatabaseSnapshot["projects"]).map((p) => ({
      ...p,
      pool_tag_options: p.pool_tag_options?.length ? p.pool_tag_options : ["硬件", "软件", "体验"],
    })),
    iterations: throwOnError(iterations, "iterations"),
    modules: throwOnError(modules, "modules"),
    requirements: (throwOnError(requirements, "requirements") as DatabaseSnapshot["requirements"]).map(
      (row) => ({
        ...row,
        tags: row.tags ?? [],
        custom_fields: (row.custom_fields ?? {}) as Record<string, string | number | boolean | null>,
      })
    ),
    acceptance_items: throwOnError(acceptance_items, "acceptance_items"),
    role_tasks: throwOnError(role_tasks, "role_tasks"),
    test_records: throwOnError(test_records, "test_records"),
    acceptance_records: throwOnError(acceptance_records, "acceptance_records"),
    share_links: throwOnError(share_links, "share_links"),
    prototypes: throwOnError(prototypes, "prototypes"),
    prototype_annotations: (throwOnError(prototype_annotations, "prototype_annotations") as PrototypeAnnotation[]).map(
      (row) => ({
        ...row,
        payload: (row.payload ?? {}) as Record<string, unknown>,
      })
    ),
    bugs: throwOnError(bugs, "bugs"),
    notifications: throwOnError(notifications, "notifications"),
    activity_logs: throwOnError(activity_logs, "activity_logs"),
    project_members: throwOnError(project_members, "project_members"),
    pool_column_defs: (throwOnError(pool_column_defs, "pool_column_defs") as DatabaseSnapshot["pool_column_defs"]).map(
      (row) => ({
        ...row,
        options: Array.isArray(row.options) ? row.options : [],
      })
    ),
  };
}

async function upsertRows<T extends object>(table: string, rows: T[]) {
  if (!rows.length) return;
  const sb = client();
  const { error } = await sb.from(table).upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`${table} upsert: ${error.message}`);
}

async function deleteMissing(table: string, keepIds: string[]) {
  const sb = client();
  const { data, error } = await sb.from(table).select("id");
  if (error) throw new Error(`${table} select: ${error.message}`);
  const removeIds = (data ?? [])
    .map((row) => row.id as string)
    .filter((id) => !keepIds.includes(id));
  if (!removeIds.length) return;
  const { error: delError } = await sb.from(table).delete().in("id", removeIds);
  if (delError) throw new Error(`${table} delete: ${delError.message}`);
}

export async function writeSupabaseDb(snapshot: DatabaseSnapshot): Promise<void> {
  const stripPlainToken = snapshot.share_links.map(({ plain_token: _plain, ...link }) => link);

  await upsertRows("projects", snapshot.projects);
  await upsertRows("iterations", snapshot.iterations);
  await upsertRows("modules", snapshot.modules);
  await upsertRows("requirements", snapshot.requirements);
  await upsertRows("acceptance_items", snapshot.acceptance_items);
  await upsertRows("role_tasks", snapshot.role_tasks);
  await upsertRows("test_records", snapshot.test_records);
  await upsertRows("acceptance_records", snapshot.acceptance_records);
  await upsertRows("share_links", stripPlainToken);
  await upsertRows("prototypes", snapshot.prototypes);
  await upsertRows(
    "prototype_annotations",
    snapshot.prototype_annotations.map((row) => ({
      ...row,
      payload: row.payload ?? {},
    }))
  );
  await upsertRows("bugs", snapshot.bugs);
  await upsertRows("notifications", snapshot.notifications);
  await upsertRows("activity_logs", snapshot.activity_logs);
  await upsertRows("project_members", snapshot.project_members);
  await upsertRows("pool_column_defs", snapshot.pool_column_defs);

  await deleteMissing("activity_logs", snapshot.activity_logs.map((r) => r.id));
  await deleteMissing("pool_column_defs", snapshot.pool_column_defs.map((r) => r.id));
  await deleteMissing("project_members", snapshot.project_members.map((r) => r.id));
  await deleteMissing("notifications", snapshot.notifications.map((r) => r.id));
  await deleteMissing("bugs", snapshot.bugs.map((r) => r.id));
  await deleteMissing("prototype_annotations", snapshot.prototype_annotations.map((r) => r.id));
  await deleteMissing("prototypes", snapshot.prototypes.map((r) => r.id));
  await deleteMissing("share_links", snapshot.share_links.map((r) => r.id));
  await deleteMissing("acceptance_records", snapshot.acceptance_records.map((r) => r.id));
  await deleteMissing("test_records", snapshot.test_records.map((r) => r.id));
  await deleteMissing("role_tasks", snapshot.role_tasks.map((r) => r.id));
  await deleteMissing("acceptance_items", snapshot.acceptance_items.map((r) => r.id));
  await deleteMissing("requirements", snapshot.requirements.map((r) => r.id));
  await deleteMissing("modules", snapshot.modules.map((r) => r.id));
  await deleteMissing("iterations", snapshot.iterations.map((r) => r.id));
  await deleteMissing("projects", snapshot.projects.map((r) => r.id));
}

export async function pingSupabase(): Promise<{ ok: boolean; projectCount: number; error?: string }> {
  try {
    const sb = client();
    const { count, error } = await sb
      .from("projects")
      .select("*", { count: "exact", head: true });
    if (error) return { ok: false, projectCount: 0, error: error.message };
    return { ok: true, projectCount: count ?? 0 };
  } catch (error) {
    return {
      ok: false,
      projectCount: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
