import { listCompetitorEntries } from "@/lib/competitors/store";
import {
  listBugsByProject,
  listProjectModules,
  getProjectById,
} from "@/lib/db/local-store";
import { readDb } from "@/lib/db/local-store";
import { findProjectBySlugOrId } from "@/lib/db/supabase-store";
import { listProjectLearningNotes } from "@/lib/learning-notes/store";
import { listProjectPrds } from "@/lib/prds/store";
import type { ResolveProjectRouteResult } from "@/lib/project-bridge";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServiceClient } from "@/lib/supabase/server";
import type { Bug, Requirement } from "@/lib/types";
import { listProjectWikiPages } from "@/lib/wiki-pages/store";

const HUB_ROW_CAP = 300;

/** Hub / 模块主页：需求只取列表列，禁止 getPoolBundle（附件+链接+select * 易 1102） */
const HUB_REQ_COLUMNS = [
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
  "tags",
  "in_pool",
  "updated_at",
  "created_at",
].join(",");

/** Bug 列表列：去掉 repro/description 等大字段，Peek 再按需拉 */
const HUB_BUG_COLUMNS = [
  "id",
  "project_id",
  "requirement_id",
  "title",
  "module_path",
  "priority",
  "status",
  "severity",
  "bug_type",
  "created_at",
  "updated_at",
].join(",");

async function soft<T>(
  label: string,
  run: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await run();
  } catch (e) {
    console.error("module-home soft-fail", label, e);
    return fallback;
  }
}

function cap<T>(rows: T[]): T[] {
  return rows.length > HUB_ROW_CAP ? rows.slice(0, HUB_ROW_CAP) : rows;
}

async function listHubRequirements(projectId: string): Promise<Requirement[]> {
  if (isSupabaseConfigured()) {
    const project = await findProjectBySlugOrId(projectId);
    if (!project) return [];
    const sb = createServiceClient();
    if (!sb) return [];
    const { data, error } = await sb
      .from("requirements")
      .select(HUB_REQ_COLUMNS)
      .eq("project_id", project.id)
      .order("updated_at", { ascending: false })
      .limit(HUB_ROW_CAP);
    if (error) throw new Error(`requirements: ${error.message}`);
    return (data ?? []) as unknown as Requirement[];
  }

  const project = await getProjectById(projectId);
  if (!project) return [];
  const db = await readDb();
  return cap(
    db.requirements
      .filter((r) => r.project_id === project.id)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map((r) => ({
        ...r,
        detail_work: null,
        acceptance_criteria: null,
        optimization_notes: null,
        known_issues: null,
      }))
  );
}

async function listHubBugs(projectId: string): Promise<Bug[]> {
  if (isSupabaseConfigured()) {
    const project = await findProjectBySlugOrId(projectId);
    if (!project) return [];
    const sb = createServiceClient();
    if (!sb) return [];
    const { data, error } = await sb
      .from("bugs")
      .select(HUB_BUG_COLUMNS)
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .limit(HUB_ROW_CAP);
    if (error) throw new Error(`bugs: ${error.message}`);
    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      project_id: String(row.project_id),
      requirement_id: (row.requirement_id as string | null) ?? null,
      test_plan_id: null,
      iteration_id: null,
      title: String(row.title ?? ""),
      description: null,
      precondition: null,
      repro_steps: null,
      expected_result: null,
      actual_result: null,
      suggestion: null,
      module_path: (row.module_path as string | null) ?? null,
      found_version: null,
      resolved_version: null,
      environments: [],
      priority: (() => {
        const p = String(row.priority ?? "").toUpperCase();
        return p === "P0" || p === "P1" || p === "P2" || p === "P3" ? p : null;
      })(),
      assignee: null,
      reporter_name: null,
      updated_by: null,
      watchers: [],
      status: (row.status as Bug["status"]) ?? "pending",
      severity: ([1, 2, 3, 4].includes(Number(row.severity))
        ? Number(row.severity)
        : 3) as Bug["severity"],
      bug_type: (row.bug_type as Bug["bug_type"]) ?? "code",
      execution_case: null,
      linked_learning_note_ids: [],
      linked_competitor_ids: [],
      custom_fields: {},
      created_at: String(row.created_at ?? ""),
      updated_at: String(row.updated_at ?? row.created_at ?? ""),
    }));
  }

  return cap(
    (await listBugsByProject(projectId)).map((b) => ({
      ...b,
      description: null,
      precondition: null,
      repro_steps: null,
      expected_result: null,
      actual_result: null,
      suggestion: null,
    }))
  );
}

/** 模块主页 / 项目 Hub 轻量包：列裁剪 + 单表失败降级，避免 CF Worker 1102 */
export async function loadModuleHomeBundle(ctx: ResolveProjectRouteResult) {
  const project = ctx.pmProject;
  if (!project) return null;

  const [learnings, bugs, competitors, prds, modules, requirements, wikiPages] =
    await Promise.all([
      soft("learnings", () => listProjectLearningNotes(project.id), []),
      soft("bugs", () => listHubBugs(project.id), []),
      soft("competitors", () => listCompetitorEntries(project.id), []),
      soft("prds", () => listProjectPrds(project.id), []),
      soft("modules", () => listProjectModules(project.id), []),
      soft("requirements", () => listHubRequirements(project.id), []),
      soft("wikiPages", () => listProjectWikiPages(project.id), []),
    ]);

  return {
    project,
    learnings: cap(learnings),
    bugs,
    competitors: cap(competitors),
    prds: cap(prds),
    modules,
    requirements,
    wikiPages: cap(wikiPages),
  };
}
