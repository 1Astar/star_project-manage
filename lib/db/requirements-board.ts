/**
 * 跨项目需求总览：禁止走 readDb()/select * 全表（易 CF Worker 1102）。
 * 只拉 projects 三列 + requirements 看板列；演示访客仅 demo 项目。
 */
import { isLeafRequirement } from "@/lib/requirement-tree";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServiceClient } from "@/lib/supabase/server";
import type { Requirement, TaskStatus } from "@/lib/types";

export type RequirementBoardItem = {
  requirement: Requirement;
  project_id: string;
  project_name: string;
  project_slug: string;
};

/** 看板/表格只用到状态与标题等；勿拉 detail / custom_fields */
const BOARD_REQ_COLUMNS = [
  "id",
  "project_id",
  "iteration_id",
  "module_l1_id",
  "module_l2_id",
  "parent_id",
  "type",
  "title",
  "priority",
  "status",
  "status_tags",
  "in_pool",
  "force_closed",
  "completed_at",
  "due_date",
  "created_at",
  "updated_at",
].join(",");

/** 防一次塞爆 Worker；列已裁剪后仍设上限 */
const BOARD_REQ_LIMIT = 800;

function asRows(data: unknown): Array<Record<string, unknown>> {
  return (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>;
}

function rowToBoardRequirement(row: Record<string, unknown>): Requirement {
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
    detail_work: null,
    acceptance_criteria: null,
    priority: (row.priority as string | null) ?? null,
    status: (row.status as TaskStatus) ?? "pending",
    status_tags: Array.isArray(row.status_tags)
      ? (row.status_tags as string[])
      : ["想法"],
    assignees: [],
    req_source: null,
    req_source_note: null,
    inspiration_source: null,
    next_step: null,
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

function buildBoard(
  projects: Array<{ id: string; name: string; slug: string }>,
  requirements: Requirement[]
): { items: RequirementBoardItem[]; projects: Array<{ id: string; name: string; slug: string }> } {
  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const byProject = new Map<string, Requirement[]>();
  for (const r of requirements) {
    const list = byProject.get(r.project_id) ?? [];
    list.push(r);
    byProject.set(r.project_id, list);
  }

  const items: RequirementBoardItem[] = [];
  for (const [projectId, reqs] of byProject) {
    const project = projectMap.get(projectId);
    if (!project) continue;
    for (const r of reqs) {
      if (!isLeafRequirement(r, reqs)) continue;
      items.push({
        requirement: r,
        project_id: project.id,
        project_name: project.name,
        project_slug: project.slug,
      });
    }
  }

  items.sort((a, b) => {
    const byProjectName = a.project_name.localeCompare(b.project_name, "zh");
    if (byProjectName) return byProjectName;
    return a.requirement.title.localeCompare(b.requirement.title, "zh");
  });

  const sortedProjects = [...projects].sort((a, b) =>
    a.name.localeCompare(b.name, "zh")
  );

  return { items, projects: sortedProjects };
}

/** Supabase 轻量路径：仅看板所需列 + 条数上限 */
export async function loadRequirementsBoardSlim(): Promise<{
  items: RequirementBoardItem[];
  projects: Array<{ id: string; name: string; slug: string }>;
}> {
  if (!isSupabaseConfigured()) {
    return { items: [], projects: [] };
  }
  const sb = createServiceClient();
  if (!sb) return { items: [], projects: [] };

  const { isDemoPublicScope } = await import("@/lib/demo/scope");
  const { DEMO_SHOWCASE_PM_SLUG } = await import("@/lib/demo/showcase");
  const demo = await isDemoPublicScope();

  let projectQuery = sb.from("projects").select("id,name,slug");
  if (demo) {
    projectQuery = projectQuery.or(
      `slug.eq.${DEMO_SHOWCASE_PM_SLUG},id.eq.proj-demo-showcase`
    );
  }

  const { data: projectRows, error: projectError } = await projectQuery;
  if (projectError) throw new Error(`projects: ${projectError.message}`);

  const projects = asRows(projectRows).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
  }));

  if (!projects.length) return { items: [], projects: [] };

  const projectIds = projects.map((p) => p.id);
  let reqQuery = sb
    .from("requirements")
    .select(BOARD_REQ_COLUMNS)
    .order("updated_at", { ascending: false })
    .limit(BOARD_REQ_LIMIT);

  if (demo || projectIds.length <= 80) {
    reqQuery = reqQuery.in("project_id", projectIds);
  }

  const { data: reqRows, error: reqError } = await reqQuery;
  if (reqError) throw new Error(`requirements: ${reqError.message}`);

  const requirements = asRows(reqRows)
    .filter((row) => projectMapHas(projectIds, String(row.project_id)))
    .map(rowToBoardRequirement);

  return buildBoard(projects, requirements);
}

function projectMapHas(ids: string[], id: string): boolean {
  return ids.includes(id);
}
