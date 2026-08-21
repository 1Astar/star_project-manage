import { createServiceClient } from "@/lib/supabase/server";
import { bumpDurableReadGeneration } from "@/lib/runtime/durable-read-memo";
import type { DatabaseSnapshot } from "@/lib/db/types";
import type {
  Bug,
  BugSeverity,
  BugType,
  GitActivity,
  InterviewRequirementLink,
  Iteration,
  Project,
  ProjectInterview,
  Requirement,
  RequirementAttachment,
  BugAttachment,
  RequirementLink,
} from "@/lib/types";
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

function throwOnError<T>(result: { data: T | null; error: { message: string } | null }, label: string): T {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return (result.data ?? []) as T;
}

async function loadComments(sb: ReturnType<typeof client>) {
  const result = await sb
    .from("requirement_comments")
    .select("*")
    .order("created_at", { ascending: false });
  if (
    result.error?.message.includes("requirement_comments") ||
    /too many subrequests/i.test(result.error?.message ?? "")
  ) {
    return [];
  }
  return throwOnError(result, "requirement_comments");
}

async function loadOptionalTable(sb: ReturnType<typeof client>, table: string) {
  const result = await sb.from(table).select("*");
  if (
    result.error?.message.includes(table) ||
    /too many subrequests/i.test(result.error?.message ?? "")
  ) {
    return [];
  }
  return throwOnError(result, table);
}

async function loadGitActivities(sb: ReturnType<typeof client>) {
  const result = await sb
    .from("git_activities")
    .select("*")
    .order("committed_at", { ascending: false });
  if (result.error?.message.includes("git_activities")) {
    return [];
  }
  return throwOnError(result, "git_activities");
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
    bugs,
    notifications,
    activity_logs,
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
    sb.from("bugs").select("*"),
    sb.from("notifications").select("*").order("created_at", { ascending: false }),
    sb.from("activity_logs").select("*").order("created_at", { ascending: false }),
  ]);

  const comments = await loadComments(sb);
  const bug_comments = await loadOptionalTable(sb, "bug_comments");
  const git_activities = await loadGitActivities(sb);
  const project_members = await loadOptionalTable(sb, "project_members");
  const pool_column_defs = await loadOptionalTable(sb, "pool_column_defs");
  const requirement_attachments = await loadOptionalTable(sb, "requirement_attachments");
  const bug_attachments = await loadOptionalTable(sb, "bug_attachments");
  const requirement_links = await loadOptionalTable(sb, "requirement_links");
  const project_interviews = await loadOptionalTable(sb, "project_interviews");
  const interview_requirement_links = await loadOptionalTable(
    sb,
    "interview_requirement_links"
  );

  return {
    projects: throwOnError(projects, "projects"),
    iterations: throwOnError(iterations, "iterations"),
    modules: throwOnError(modules, "modules"),
    requirements: throwOnError(requirements, "requirements"),
    acceptance_items: throwOnError(acceptance_items, "acceptance_items"),
    role_tasks: throwOnError(role_tasks, "role_tasks"),
    test_records: throwOnError(test_records, "test_records"),
    acceptance_records: throwOnError(acceptance_records, "acceptance_records"),
    share_links: throwOnError(share_links, "share_links"),
    prototypes: throwOnError(prototypes, "prototypes"),
    bugs: throwOnError(bugs, "bugs").map((row) =>
      normalizeBug(row as unknown as Record<string, unknown>)
    ),
    notifications: throwOnError(notifications, "notifications"),
    activity_logs: throwOnError(activity_logs, "activity_logs"),
    comments,
    bug_comments,
    git_activities,
    project_members,
    pool_column_defs,
    requirement_attachments,
    bug_attachments,
    requirement_links,
    project_interviews: ((project_interviews ?? []) as Record<string, unknown>[]).map(
      (row) => ({
        id: String(row.id),
        project_id: String(row.project_id),
        title: String(row.title ?? ""),
        interviewee: row.interviewee != null ? String(row.interviewee) : null,
        interviewed_at: row.interviewed_at != null ? String(row.interviewed_at) : null,
        record_notes: String(row.record_notes ?? ""),
        product_judgment: String(row.product_judgment ?? ""),
        hypotheses: Array.isArray(row.hypotheses) ? (row.hypotheses as ProjectInterview["hypotheses"]) : [],
        created_at: String(row.created_at ?? new Date().toISOString()),
        updated_at: String(row.updated_at ?? new Date().toISOString()),
      })
    ),
    interview_requirement_links: (interview_requirement_links ??
      []) as InterviewRequirementLink[],
  };
}

async function upsertRows<T extends object>(table: string, rows: T[]) {
  if (!rows.length) return;
  const sb = client();
  const { error } = await sb.from(table).upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`${table} upsert: ${error.message}`);
  bumpDurableReadGeneration();
}

/** 新列未跑迁移 029 时回退，避免整库保存失败 */
async function upsertBugs(rows: DatabaseSnapshot["bugs"]) {
  if (!rows.length) return;
  try {
    await upsertRows("bugs", rows);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/severity|bug_type|schema cache|column/i.test(message)) {
      await upsertRows(
        "bugs",
        rows.map(({ severity: _s, bug_type: _t, ...rest }) => rest)
      );
      return;
    }
    throw error;
  }
}

async function deleteMissing(table: string, keepIds: string[]) {
  const sb = client();
  const { data, error } = await sb.from(table).select("id");
  if (error) {
    if (
      table === "requirement_comments" ||
      table === "git_activities" ||
      table === "project_members" ||
      table === "pool_column_defs" ||
      table === "requirement_attachments" ||
      table === "bug_attachments" ||
      table === "requirement_links" ||
      table === "project_interviews" ||
      table === "interview_requirement_links"
    ) {
      return;
    }
    throw new Error(`${table} select: ${error.message}`);
  }
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
  await upsertBugs(snapshot.bugs);
  await upsertRows("notifications", snapshot.notifications);
  await upsertRows("activity_logs", snapshot.activity_logs);
  if ((snapshot.comments ?? []).length) {
    await upsertRows("requirement_comments", snapshot.comments ?? []);
  }
  if ((snapshot.bug_comments ?? []).length) {
    await upsertRows("bug_comments", snapshot.bug_comments ?? []);
  }
  if ((snapshot.git_activities ?? []).length) {
    await upsertRows("git_activities", snapshot.git_activities ?? []);
  }
  if ((snapshot.project_members ?? []).length) {
    await upsertRows("project_members", snapshot.project_members ?? []);
  }
  if ((snapshot.pool_column_defs ?? []).length) {
    await upsertRows("pool_column_defs", snapshot.pool_column_defs ?? []);
  }
  if ((snapshot.requirement_attachments ?? []).length) {
    await upsertRows("requirement_attachments", snapshot.requirement_attachments ?? []);
  }
  if ((snapshot.bug_attachments ?? []).length) {
    try {
      await upsertRows("bug_attachments", snapshot.bug_attachments ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (!/bug_attachments|schema cache|does not exist/i.test(msg)) throw e;
    }
  }
  if ((snapshot.requirement_links ?? []).length) {
    await upsertRows("requirement_links", snapshot.requirement_links ?? []);
  }
  if ((snapshot.project_interviews ?? []).length) {
    try {
      await upsertRows("project_interviews", snapshot.project_interviews ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (!/project_interviews|schema cache|does not exist/i.test(msg)) throw e;
    }
  }
  if ((snapshot.interview_requirement_links ?? []).length) {
    try {
      await upsertRows(
        "interview_requirement_links",
        snapshot.interview_requirement_links ?? []
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (!/interview_requirement_links|schema cache|does not exist/i.test(msg)) {
        throw e;
      }
    }
  }

  await deleteMissing("git_activities", (snapshot.git_activities ?? []).map((r) => r.id));
  await deleteMissing("pool_column_defs", (snapshot.pool_column_defs ?? []).map((r) => r.id));
  await deleteMissing(
    "requirement_attachments",
    (snapshot.requirement_attachments ?? []).map((r) => r.id)
  );
  await deleteMissing(
    "bug_attachments",
    (snapshot.bug_attachments ?? []).map((r) => r.id)
  );
  await deleteMissing(
    "requirement_links",
    (snapshot.requirement_links ?? []).map((r) => r.id)
  );
  await deleteMissing(
    "interview_requirement_links",
    (snapshot.interview_requirement_links ?? []).map((r) => r.id)
  );
  await deleteMissing(
    "project_interviews",
    (snapshot.project_interviews ?? []).map((r) => r.id)
  );
  await deleteMissing("project_members", (snapshot.project_members ?? []).map((r) => r.id));
  await deleteMissing("requirement_comments", (snapshot.comments ?? []).map((r) => r.id));
  await deleteMissing("bug_comments", (snapshot.bug_comments ?? []).map((r) => r.id));
  await deleteMissing("activity_logs", snapshot.activity_logs.map((r) => r.id));
  await deleteMissing("notifications", snapshot.notifications.map((r) => r.id));
  await deleteMissing("bugs", snapshot.bugs.map((r) => r.id));
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
    const { count, error } = await sb.from("projects").select("*", { count: "exact", head: true });
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

export async function updateProjectById(
  projectId: string,
  fields: Partial<Project>
): Promise<Project> {
  const sb = client();
  const { data, error } = await sb
    .from("projects")
    .update(fields)
    .eq("id", projectId)
    .select("*")
    .single();
  if (error) throw new Error(`projects update: ${error.message}`);
  bumpDurableReadGeneration();
  return data as Project;
}

export async function upsertProjectRow(project: Project): Promise<void> {
  await upsertRows("projects", [project]);
}

export async function upsertIterationRow(iteration: Iteration): Promise<void> {
  await upsertRows("iterations", [iteration]);
}

export async function upsertRequirementRow(requirement: Requirement): Promise<void> {
  await upsertRows("requirements", [requirement]);
}

export async function upsertAcceptanceItemRow(
  item: import("@/lib/types").AcceptanceItem
): Promise<void> {
  await upsertRows("acceptance_items", [item]);
}

export async function upsertAcceptanceRecordRow(
  record: import("@/lib/types").AcceptanceRecord
): Promise<void> {
  await upsertRows("acceptance_records", [record]);
}

export async function upsertActivityLogRow(log: import("@/lib/types").ActivityLog): Promise<void> {
  await upsertRows("activity_logs", [log]);
}

export async function upsertBugRow(bug: import("@/lib/types").Bug): Promise<void> {
  await upsertBugs([bug]);
}

/** 仅 projects 表，供 getProjects / MCP 列表，禁止整库 */
export async function listAllProjects(): Promise<Project[]> {
  const sb = client();
  // projects 行数很少；select * 可接受，关键是不要连带整库其它表
  const { data, error } = await sb.from("projects").select("*").order("name", {
    ascending: true,
  });
  if (error) throw new Error(`projects: ${error.message}`);
  return (data ?? []) as Project[];
}

/** 需求池作用域：只拉该项目池内需求/模块，禁止整库 */
export async function loadPoolScopedBundle(
  project: Project,
  poolIterationName: string
): Promise<{
  project: Project;
  poolIteration: import("@/lib/types").Iteration;
  poolRequirements: DatabaseSnapshot["requirements"];
  poolModules: DatabaseSnapshot["modules"];
  activeIterations: DatabaseSnapshot["iterations"];
  project_members: DatabaseSnapshot["project_members"];
  poolColumnDefs: DatabaseSnapshot["pool_column_defs"];
  attachments: DatabaseSnapshot["requirement_attachments"];
  links: DatabaseSnapshot["requirement_links"];
}> {
  const sb = client();
  const pid = project.id;

  let poolIteration = await findPoolIterationRow(pid, poolIterationName);
  if (!poolIteration) {
    throw new Error("需求池迭代不存在");
  }

  const [reqsRes, itersRes, membersRes, colsRes, modsRes, attsRes, linksRes] =
    await Promise.all([
      sb
        .from("requirements")
        .select("*")
        .eq("project_id", pid)
        .eq("in_pool", true)
        .order("sort_order", { ascending: true }),
      sb
        .from("iterations")
        .select("*")
        .eq("project_id", pid)
        .neq("name", poolIterationName)
        .order("sort_order", { ascending: true }),
      sb.from("project_members").select("*").eq("project_id", pid),
      sb
        .from("pool_column_defs")
        .select("*")
        .eq("project_id", pid)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      sb
        .from("modules")
        .select("*")
        .eq("iteration_id", poolIteration.id)
        .order("sort_order", { ascending: true }),
      sb
        .from("requirement_attachments")
        .select("*")
        .eq("project_id", pid)
        .order("created_at", { ascending: false }),
      sb
        .from("requirement_links")
        .select("*")
        .eq("project_id", pid)
        .order("created_at", { ascending: false }),
    ]);

  const soft = <T,>(
    result: { data: T | null; error: { message: string } | null },
    label: string
  ): T => {
    if (result.error) {
      if (/does not exist|schema cache|too many subrequests/i.test(result.error.message)) {
        return [] as T;
      }
      throw new Error(`${label}: ${result.error.message}`);
    }
    return (result.data ?? []) as T;
  };

  return {
    project,
    poolIteration,
    poolRequirements: throwOnError(reqsRes, "requirements") as DatabaseSnapshot["requirements"],
    poolModules: throwOnError(modsRes, "modules") as DatabaseSnapshot["modules"],
    activeIterations: throwOnError(itersRes, "iterations") as DatabaseSnapshot["iterations"],
    project_members: soft(membersRes, "project_members"),
    poolColumnDefs: soft(colsRes, "pool_column_defs"),
    attachments: soft(attsRes, "requirement_attachments"),
    links: soft(linksRes, "requirement_links"),
  };
}

/** 项目迭代列表（演进页等） */
export async function listIterationsForProject(
  projectId: string
): Promise<import("@/lib/types").Iteration[]> {
  const sb = client();
  const { data, error } = await sb
    .from("iterations")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`iterations: ${error.message}`);
  return (data ?? []) as import("@/lib/types").Iteration[];
}

/** 公开反馈专用：单行查项目，避免整库 readSupabaseDb */
export async function findProjectBySlugOrId(slugOrId: string): Promise<Project | null> {
  const key = slugOrId.trim();
  if (!key) return null;
  const sb = client();
  const bySlug = await sb.from("projects").select("*").eq("slug", key).maybeSingle();
  if (bySlug.error) throw new Error(`projects: ${bySlug.error.message}`);
  if (bySlug.data) return bySlug.data as Project;
  const byId = await sb.from("projects").select("*").eq("id", key).maybeSingle();
  if (byId.error) throw new Error(`projects: ${byId.error.message}`);
  return (byId.data as Project | null) ?? null;
}

/** 单条 Bug，避免整库 readDb */
export async function findBugById(bugId: string): Promise<Bug | null> {
  const id = bugId.trim();
  if (!id) return null;
  const sb = client();
  const { data, error } = await sb.from("bugs").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`bugs: ${error.message}`);
  if (!data) return null;
  return normalizeBug(data as unknown as Record<string, unknown>);
}

/** 按项目拉 Bug 列表，避免整库 readDb */
export async function listBugsForProject(projectId: string): Promise<Bug[]> {
  const pid = projectId.trim();
  if (!pid) return [];
  const sb = client();
  const { data, error } = await sb
    .from("bugs")
    .select("*")
    .eq("project_id", pid)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`bugs: ${error.message}`);
  return (data ?? []).map((row) =>
    normalizeBug(row as unknown as Record<string, unknown>)
  );
}

/** 公开反馈挂需求：只拉该项目需求标题，不读整库 */
export async function listRequirementOptionsForProject(
  projectId: string
): Promise<Array<{ id: string; title: string; inPool: boolean }>> {
  const sb = client();
  const { data, error } = await sb
    .from("requirements")
    .select("id,title,in_pool")
    .eq("project_id", projectId)
    .order("title", { ascending: true });
  if (error) throw new Error(`requirements: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.title ?? ""),
    inPool: Boolean(row.in_pool),
  }));
}

export async function upsertBugCommentRow(
  comment: import("@/lib/types").BugComment
): Promise<void> {
  await upsertRows("bug_comments", [comment]);
}

/** 项目作用域看板：只拉该项目相关行，禁止整库 readSupabaseDb */
export async function loadProjectScopedBundle(project: Project): Promise<{
  project: Project;
  iterations: DatabaseSnapshot["iterations"];
  modules: DatabaseSnapshot["modules"];
  requirements: DatabaseSnapshot["requirements"];
  role_tasks: DatabaseSnapshot["role_tasks"];
  acceptance_items: DatabaseSnapshot["acceptance_items"];
  share_links: DatabaseSnapshot["share_links"];
  notifications: DatabaseSnapshot["notifications"];
  prototypes: DatabaseSnapshot["prototypes"];
  bugs: DatabaseSnapshot["bugs"];
  comments: DatabaseSnapshot["comments"];
  git_activities: DatabaseSnapshot["git_activities"];
  project_members: DatabaseSnapshot["project_members"];
  pool_column_defs: DatabaseSnapshot["pool_column_defs"];
  activity_logs: DatabaseSnapshot["activity_logs"];
}> {
  const sb = client();
  const pid = project.id;

  const [
    iterationsRes,
    requirementsRes,
    bugsRes,
    notificationsRes,
    prototypesRes,
    shareLinksRes,
    membersRes,
    poolColsRes,
    gitRes,
    activityRes,
    commentsRes,
  ] = await Promise.all([
    sb.from("iterations").select("*").eq("project_id", pid),
    sb.from("requirements").select("*").eq("project_id", pid).eq("in_pool", false),
    sb.from("bugs").select("*").eq("project_id", pid),
    sb
      .from("notifications")
      .select("id,project_id,recipient_name,type,title,body,link,is_read,created_at")
      .eq("project_id", pid)
      .order("created_at", { ascending: false })
      .limit(50),
    sb.from("prototypes").select("*").eq("project_id", pid),
    sb.from("share_links").select("*").eq("project_id", pid),
    sb.from("project_members").select("*").eq("project_id", pid),
    sb.from("pool_column_defs").select("*").eq("project_id", pid).eq("is_active", true),
    sb
      .from("git_activities")
      .select("*")
      .eq("project_id", pid)
      .order("committed_at", { ascending: false })
      .limit(40),
    sb
      .from("activity_logs")
      .select("*")
      .eq("project_id", pid)
      .order("created_at", { ascending: false })
      .limit(30),
    sb.from("comments").select("*").eq("project_id", pid).limit(200),
  ]);

  const iterations = throwOnError(iterationsRes, "iterations") as DatabaseSnapshot["iterations"];
  const iterIds = iterations.map((i) => i.id);
  let modules: DatabaseSnapshot["modules"] = [];
  if (iterIds.length) {
    const mod = await sb.from("modules").select("*").in("iteration_id", iterIds);
    modules = throwOnError(mod, "modules");
  }

  const requirements = throwOnError(
    requirementsRes,
    "requirements"
  ) as DatabaseSnapshot["requirements"];
  const reqIds = requirements.map((r) => r.id);
  let role_tasks: DatabaseSnapshot["role_tasks"] = [];
  let acceptance_items: DatabaseSnapshot["acceptance_items"] = [];
  if (reqIds.length) {
    const [roles, items] = await Promise.all([
      sb.from("role_tasks").select("*").in("requirement_id", reqIds),
      sb.from("acceptance_items").select("*").in("requirement_id", reqIds),
    ]);
    role_tasks = throwOnError(roles, "role_tasks");
    acceptance_items = throwOnError(items, "acceptance_items");
  }

  const soft = <T,>(
    result: { data: T | null; error: { message: string } | null },
    label: string
  ): T => {
    if (result.error) {
      if (/too many subrequests|schema cache|does not exist/i.test(result.error.message)) {
        return [] as T;
      }
      throw new Error(`${label}: ${result.error.message}`);
    }
    return (result.data ?? []) as T;
  };

  return {
    project,
    iterations,
    modules,
    requirements,
    role_tasks,
    acceptance_items,
    share_links: soft(shareLinksRes, "share_links"),
    notifications: soft(notificationsRes, "notifications"),
    prototypes: soft(prototypesRes, "prototypes"),
    bugs: throwOnError(bugsRes, "bugs").map((row) =>
      normalizeBug(row as unknown as Record<string, unknown>)
    ),
    comments: soft(commentsRes, "comments"),
    git_activities: soft(gitRes, "git_activities"),
    project_members: soft(membersRes, "project_members"),
    pool_column_defs: soft(poolColsRes, "pool_column_defs"),
    activity_logs: soft(activityRes, "activity_logs"),
  };
}

export async function listRecentNotifications(limit = 50): Promise<
  import("@/lib/types").NotificationItem[]
> {
  const sb = client();
  const { data, error } = await sb
    .from("notifications")
    .select("id,project_id,recipient_name,type,title,body,link,is_read,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`notifications: ${error.message}`);
  return (data ?? []) as import("@/lib/types").NotificationItem[];
}

export async function listMembersForProject(
  projectId: string
): Promise<import("@/lib/types").ProjectMember[]> {
  const sb = client();
  const { data, error } = await sb
    .from("project_members")
    .select("id,project_id,name,role,is_active,created_at")
    .eq("project_id", projectId)
    .order("name", { ascending: true });
  if (error) {
    if (/does not exist|schema cache/i.test(error.message)) return [];
    throw new Error(`project_members: ${error.message}`);
  }
  return (data ?? []) as import("@/lib/types").ProjectMember[];
}

export async function listBugCommentsForBug(
  bugId: string
): Promise<import("@/lib/types").BugComment[]> {
  const sb = client();
  const { data, error } = await sb
    .from("bug_comments")
    .select("*")
    .eq("bug_id", bugId)
    .order("created_at", { ascending: true });
  if (error) {
    if (/does not exist|schema cache|too many subrequests/i.test(error.message)) return [];
    throw new Error(`bug_comments: ${error.message}`);
  }
  return (data ?? []) as import("@/lib/types").BugComment[];
}

export async function listBugAttachmentsForBug(bugId: string): Promise<BugAttachment[]> {
  const sb = client();
  const { data, error } = await sb
    .from("bug_attachments")
    .select("*")
    .eq("bug_id", bugId)
    .order("created_at", { ascending: false });
  if (error) {
    if (/does not exist|schema cache|too many subrequests/i.test(error.message)) return [];
    throw new Error(`bug_attachments: ${error.message}`);
  }
  return (data ?? []) as BugAttachment[];
}

export async function findRequirementTitleById(
  requirementId: string
): Promise<{ id: string; title: string } | null> {
  const sb = client();
  const { data, error } = await sb
    .from("requirements")
    .select("id,title")
    .eq("id", requirementId)
    .maybeSingle();
  if (error) throw new Error(`requirements: ${error.message}`);
  if (!data) return null;
  return { id: String(data.id), title: String(data.title ?? "") };
}

export async function findPoolIterationRow(
  projectId: string,
  name: string
): Promise<import("@/lib/types").Iteration | null> {
  const sb = client();
  const { data, error } = await sb
    .from("iterations")
    .select("*")
    .eq("project_id", projectId)
    .eq("name", name)
    .maybeSingle();
  if (error) throw new Error(`iterations: ${error.message}`);
  return (data as import("@/lib/types").Iteration | null) ?? null;
}

export async function upsertNotificationRow(
  notification: import("@/lib/types").NotificationItem
): Promise<void> {
  await upsertRows("notifications", [notification]);
}

export async function upsertRequirementAttachmentRow(
  attachment: RequirementAttachment
): Promise<void> {
  await upsertRows("requirement_attachments", [attachment]);
}

export async function deleteRequirementAttachmentRow(id: string): Promise<void> {
  const sb = client();
  const { error } = await sb.from("requirement_attachments").delete().eq("id", id);
  if (error) throw new Error(`requirement_attachments delete: ${error.message}`);
  bumpDurableReadGeneration();
}

export async function upsertBugAttachmentRow(attachment: BugAttachment): Promise<void> {
  await upsertRows("bug_attachments", [attachment]);
}

export async function deleteBugAttachmentRow(id: string): Promise<void> {
  const sb = client();
  const { error } = await sb.from("bug_attachments").delete().eq("id", id);
  if (error) throw new Error(`bug_attachments delete: ${error.message}`);
  bumpDurableReadGeneration();
}

export async function upsertRequirementLinkRow(link: RequirementLink): Promise<void> {
  await upsertRows("requirement_links", [link]);
}

export async function deleteRequirementLinkRow(id: string): Promise<void> {
  const sb = client();
  const { error } = await sb.from("requirement_links").delete().eq("id", id);
  if (error) throw new Error(`requirement_links delete: ${error.message}`);
  bumpDurableReadGeneration();
}

export async function deleteRequirementRows(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const sb = client();
  const { error } = await sb.from("requirements").delete().in("id", ids);
  if (error) throw new Error(`requirements delete: ${error.message}`);
  bumpDurableReadGeneration();
}

export async function upsertGitActivities(rows: GitActivity[]) {
  if (!rows.length) return;
  await upsertRows("git_activities", rows);
}
