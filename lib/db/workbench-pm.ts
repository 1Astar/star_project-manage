/**
 * 工作台专用 PM 快照：只拉 projects / modules / 工作台相关 requirements /
 * acceptance_records / 未关闭 bugs，跳过评论、附件、活动日志等重表。
 *
 * requirements 不再全表 select *（曾约 1000 行 / 1MB+，登录冷启动易 1102）。
 */
import { emptyPmSnapshot } from "@/lib/db/empty-snapshot";
import type { DatabaseSnapshot } from "@/lib/db/types";
import { createServiceClient } from "@/lib/supabase/server";
import type { Bug, BugSeverity, BugType, Project, Requirement } from "@/lib/types";
import { BUG_TYPE_LABELS } from "@/lib/types";

/** 工作台验收 / 明日清单用到的列（避免 detail 大字段与自定义字段拖垮 Worker） */
const WORKBENCH_REQ_COLUMNS = [
  "id",
  "project_id",
  "iteration_id",
  "module_l1_id",
  "module_l2_id",
  "parent_id",
  "type",
  "title",
  "detail_work",
  "acceptance_criteria",
  "priority",
  "status",
  "status_tags",
  "next_step",
  "due_date",
  "updated_at",
  "created_at",
  "in_pool",
  "completed_at",
  "force_closed",
].join(",");

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

/** 列裁剪后的 select 结果在 supabase-js 里类型偏宽，统一经 unknown 再映射 */
function asRows(data: unknown): Array<Record<string, unknown>> {
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

function shanghaiDay(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function addShanghaiDays(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00+08:00`);
  d.setDate(d.getDate() + delta);
  return shanghaiDay(d.toISOString());
}

function clipText(value: unknown, max: number): string | null {
  if (value == null) return null;
  const s = String(value);
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function rowToWorkbenchRequirement(row: Record<string, unknown>): Requirement {
  const typeRaw = String(row.type ?? "feature");
  const type =
    typeRaw === "epic" || typeRaw === "feature" || typeRaw === "task"
      ? typeRaw
      : "feature";
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    iteration_id: String(row.iteration_id ?? ""),
    module_l1_id: (row.module_l1_id as string | null) ?? null,
    module_l2_id: (row.module_l2_id as string | null) ?? null,
    parent_id: (row.parent_id as string | null) ?? null,
    type,
    title: String(row.title ?? ""),
    sub_function: null,
    detail_work: clipText(row.detail_work, 160),
    acceptance_criteria: clipText(row.acceptance_criteria, 400),
    priority: (row.priority as string | null) ?? null,
    status: (row.status as Requirement["status"]) ?? "pending",
    status_tags: Array.isArray(row.status_tags)
      ? (row.status_tags as string[])
      : ["想法"],
    assignees: [],
    req_source: null,
    req_source_note: null,
    inspiration_source: null,
    next_step: clipText(row.next_step, 120),
    completed_at: (row.completed_at as string | null) ?? null,
    studio_idea_id: null,
    blocker_reason: null,
    sort_order: 0,
    in_pool: Boolean(row.in_pool),
    category: null,
    stage_type: null,
    optimization_notes: null,
    known_issues: null,
    submitted_at: null,
    due_date: (row.due_date as string | null) ?? null,
    difficulty_notes: null,
    scenario: null,
    needs_discussion: false,
    prd_link: null,
    prototype_link: null,
    product_estimate_hours: null,
    direct_hours: null,
    actual_hours: null,
    force_closed: Boolean(row.force_closed),
    tags: [],
    custom_fields: {},
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

function mergeRequirementsById(batches: Requirement[][]): Requirement[] {
  const byId = new Map<string, Requirement>();
  for (const batch of batches) {
    for (const req of batch) byId.set(req.id, req);
  }
  return [...byId.values()];
}

const WORKBENCH_PROJECT_COLUMNS =
  "id,slug,name,description,parent_id,demo_url,created_at";
const WORKBENCH_BUG_COLUMNS =
  "id,project_id,requirement_id,title,status,severity,bug_type,created_at,updated_at";

function rowToWorkbenchProject(row: Record<string, unknown>): Project {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    description: clipText(row.description, 160),
    parent_id: (row.parent_id as string | null) ?? null,
    pool_tag_options: [],
    created_at: String(row.created_at ?? new Date().toISOString()),
    repo_full_name: null,
    repo_branch: null,
    repo_url: null,
    last_commit_sha: null,
    last_commit_message: null,
    last_commit_at: null,
    last_git_synced_at: null,
    vercel_project_id: null,
    vercel_deployment_url: null,
    last_deploy_status: null,
    demo_url: (row.demo_url as string | null) ?? null,
    local_run_guide: null,
    code_path: null,
  };
}

/** 演示沙盘：只拉 demo-showcase 对应 PM 项目行 */
export async function readDemoWorkbenchPmDb(pmProjectId: string): Promise<DatabaseSnapshot> {
  const sb = client();
  const [projects, iterations, requirements, bugs] = await Promise.all([
    sb.from("projects").select(WORKBENCH_PROJECT_COLUMNS).eq("id", pmProjectId),
    sb.from("iterations").select("*").eq("project_id", pmProjectId),
    sb.from("requirements").select(WORKBENCH_REQ_COLUMNS).eq("project_id", pmProjectId),
    sb
      .from("bugs")
      .select(WORKBENCH_BUG_COLUMNS)
      .eq("project_id", pmProjectId)
      .neq("status", "done"),
  ]);

  const iters = throwOnError(iterations, "iterations") as Array<{ id: string }>;
  const iterIds = iters.map((i) => i.id);
  let modules: DatabaseSnapshot["modules"] = [];
  if (iterIds.length) {
    const mod = await sb.from("modules").select("*").in("iteration_id", iterIds);
    modules = throwOnError(mod, "modules");
  }

  const reqs = asRows(throwOnError(requirements, "requirements")).map(
    rowToWorkbenchRequirement
  );
  const reqIds = reqs.map((r) => r.id);
  let acceptance: DatabaseSnapshot["acceptance_records"] = [];
  if (reqIds.length) {
    const acc = await sb
      .from("acceptance_records")
      .select("id,requirement_id,acceptance_item_id,passed,note,reviewer_name,created_at")
      .in("requirement_id", reqIds);
    acceptance = throwOnError(acc, "acceptance_records");
  }

  return emptyPmSnapshot({
    projects: asRows(throwOnError(projects, "projects")).map(rowToWorkbenchProject),
    iterations: iters as DatabaseSnapshot["iterations"],
    modules,
    requirements: reqs,
    acceptance_records: acceptance,
    bugs: asRows(throwOnError(bugs, "bugs")).map(normalizeBug),
  });
}

/**
 * 登录工作台：只拉「待验收候选 + 昨日更新/明日到期」需求，
 * 不做 requirements / acceptance_records 全表。
 */
export async function readWorkbenchSupabaseDb(): Promise<DatabaseSnapshot> {
  const sb = client();
  const today = shanghaiDay();
  const tomorrow = addShanghaiDays(today, 1);
  const lookbackStart = `${addShanghaiDays(today, -14)}T00:00:00.000+08:00`;

  const [projects, bugs, recentOpen, byStatusAcceptance, dueTomorrow] =
    await Promise.all([
      sb.from("projects").select(WORKBENCH_PROJECT_COLUMNS),
      sb.from("bugs").select(WORKBENCH_BUG_COLUMNS).neq("status", "done").limit(200),
      // 近 14 天有更新的未完成需求（覆盖昨日变更 + 多数待验）；列已裁剪
      sb
        .from("requirements")
        .select(WORKBENCH_REQ_COLUMNS)
        .gte("updated_at", lookbackStart)
        .neq("status", "done")
        .order("updated_at", { ascending: false })
        .limit(150),
      // 状态机仍标 acceptance 的（可能很久没动）
      sb
        .from("requirements")
        .select(WORKBENCH_REQ_COLUMNS)
        .eq("status", "acceptance")
        .limit(200),
      sb
        .from("requirements")
        .select(WORKBENCH_REQ_COLUMNS)
        .eq("due_date", tomorrow)
        .neq("status", "done")
        .limit(100),
    ]);

  const requirements = mergeRequirementsById([
    asRows(throwOnError(recentOpen, "requirements.recent")).map(
      rowToWorkbenchRequirement
    ),
    asRows(throwOnError(byStatusAcceptance, "requirements.status")).map(
      rowToWorkbenchRequirement
    ),
    asRows(throwOnError(dueTomorrow, "requirements.due")).map(
      rowToWorkbenchRequirement
    ),
  ]);

  const moduleIds = [
    ...new Set(
      requirements.flatMap((r) =>
        [r.module_l1_id, r.module_l2_id].filter(Boolean) as string[]
      )
    ),
  ];
  const reqIds = requirements.map((r) => r.id);

  const [modulesRes, acceptanceRes] = await Promise.all([
    moduleIds.length
      ? sb.from("modules").select("*").in("id", moduleIds)
      : Promise.resolve({ data: [], error: null }),
    reqIds.length
      ? sb
          .from("acceptance_records")
          .select("id,requirement_id,acceptance_item_id,passed,note,reviewer_name,created_at")
          .in("requirement_id", reqIds)
          .eq("passed", true)
      : Promise.resolve({ data: [], error: null }),
  ]);

  // 板块路径可能要父节点：若有 parent_id，再补一轮父模块
  let modules = throwOnError(modulesRes, "modules") as DatabaseSnapshot["modules"];
  const parentIds = [
    ...new Set(
      modules
        .map((m) => m.parent_id)
        .filter((id): id is string => Boolean(id) && !modules.some((x) => x.id === id))
    ),
  ];
  if (parentIds.length) {
    const parents = await sb.from("modules").select("*").in("id", parentIds);
    modules = [
      ...modules,
      ...(throwOnError(parents, "modules.parents") as DatabaseSnapshot["modules"]),
    ];
  }

  return emptyPmSnapshot({
    projects: asRows(throwOnError(projects, "projects")).map(rowToWorkbenchProject),
    iterations: [],
    modules,
    requirements,
    acceptance_records: throwOnError(
      acceptanceRes,
      "acceptance_records"
    ) as DatabaseSnapshot["acceptance_records"],
    bugs: asRows(throwOnError(bugs, "bugs")).map(normalizeBug),
  });
}
