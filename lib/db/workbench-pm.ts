/**
 * 工作台专用 PM 快照：只拉 projects / modules / requirements /
 * acceptance_records / 未关闭 bugs，跳过评论、附件、活动日志等重表。
 */
import { emptyPmSnapshot } from "@/lib/db/empty-snapshot";
import type { DatabaseSnapshot } from "@/lib/db/types";
import { createServiceClient } from "@/lib/supabase/server";
import type { Bug, BugSeverity, BugType } from "@/lib/types";
import { BUG_TYPE_LABELS } from "@/lib/types";

function normalizeBug(row: Record<string, unknown>): Bug {
  const severityRaw = Number(row.severity);
  const severity = ([1, 2, 3, 4].includes(severityRaw) ? severityRaw : 3) as BugSeverity;
  const typeRaw = String(row.bug_type ?? "code");
  const bug_type = (typeRaw in BUG_TYPE_LABELS ? typeRaw : "code") as BugType;
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    requirement_id: (row.requirement_id as string | null) ?? null,
    title: String(row.title ?? ""),
    description: (row.description as string | null) ?? null,
    repro_steps: (row.repro_steps as string | null) ?? null,
    assignee: (row.assignee as string | null) ?? null,
    status: (row.status as Bug["status"]) ?? "pending",
    severity,
    bug_type,
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

function client() {
  const sb = createServiceClient();
  if (!sb) {
    throw new Error("Supabase 未配置：需要 NEXT_PUBLIC_SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY");
  }
  return sb;
}

function throwOnError<T>(
  result: { data: T | null; error: { message: string } | null },
  label: string
): T {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return (result.data ?? []) as T;
}

/** 演示沙盘：只拉 demo-showcase 对应 PM 项目行 */
export async function readDemoWorkbenchPmDb(pmProjectId: string): Promise<DatabaseSnapshot> {
  const sb = client();
  const [projects, iterations, requirements, bugs] = await Promise.all([
    sb.from("projects").select("*").eq("id", pmProjectId),
    sb.from("iterations").select("*").eq("project_id", pmProjectId),
    sb.from("requirements").select("*").eq("project_id", pmProjectId),
    sb.from("bugs").select("*").eq("project_id", pmProjectId).neq("status", "done"),
  ]);

  const iters = throwOnError(iterations, "iterations") as Array<{ id: string }>;
  const iterIds = iters.map((i) => i.id);
  let modules: DatabaseSnapshot["modules"] = [];
  if (iterIds.length) {
    const mod = await sb.from("modules").select("*").in("iteration_id", iterIds);
    modules = throwOnError(mod, "modules");
  }

  const reqs = throwOnError(requirements, "requirements") as Array<{ id: string }>;
  const reqIds = reqs.map((r) => r.id);
  let acceptance: DatabaseSnapshot["acceptance_records"] = [];
  if (reqIds.length) {
    const acc = await sb.from("acceptance_records").select("*").in("requirement_id", reqIds);
    acceptance = throwOnError(acc, "acceptance_records");
  }

  return emptyPmSnapshot({
    projects: throwOnError(projects, "projects"),
    iterations: iters as DatabaseSnapshot["iterations"],
    modules,
    requirements: reqs as DatabaseSnapshot["requirements"],
    acceptance_records: acceptance,
    bugs: throwOnError(bugs, "bugs").map((row) =>
      normalizeBug(row as unknown as Record<string, unknown>)
    ),
  });
}

export async function readWorkbenchSupabaseDb(): Promise<DatabaseSnapshot> {
  const sb = client();
  const [projects, iterations, modules, requirements, acceptance_records, bugs] =
    await Promise.all([
      sb.from("projects").select("*"),
      sb.from("iterations").select("*"),
      sb.from("modules").select("*"),
      sb.from("requirements").select("*"),
      sb.from("acceptance_records").select("*"),
      sb.from("bugs").select("*").neq("status", "done"),
    ]);

  return emptyPmSnapshot({
    projects: throwOnError(projects, "projects"),
    iterations: throwOnError(iterations, "iterations"),
    modules: throwOnError(modules, "modules"),
    requirements: throwOnError(requirements, "requirements"),
    acceptance_records: throwOnError(acceptance_records, "acceptance_records"),
    bugs: throwOnError(bugs, "bugs").map((row) =>
      normalizeBug(row as unknown as Record<string, unknown>)
    ),
  });
}
