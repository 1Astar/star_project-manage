import {
  ensurePoolIteration,
  readDb,
  uid,
  nowIso,
  writeDb,
  getProjectById,
} from "@/lib/db";
import {
  REQUIREMENT_POOL_DEFAULTS,
  statusTagsFromTaskStatus,
  type ModuleNode,
  type Requirement,
} from "@/lib/types";
import { mapNotionStatus, type NotionCsvPreview } from "@/lib/notion/parser";

export interface NotionImportResult {
  requirementsCreated: number;
  modulesCreated: number;
}

export async function importNotionCsvToPool(
  projectIdOrSlug: string,
  preview: NotionCsvPreview,
  options?: { clearPool?: boolean }
): Promise<NotionImportResult> {
  const project = await getProjectById(projectIdOrSlug);
  if (!project) throw new Error("项目不存在");

  const db = await readDb();
  const poolIteration = await ensurePoolIteration(project.id);

  if (options?.clearPool) {
    const poolReqIds = new Set(
      db.requirements
        .filter((r) => r.project_id === project.id && r.in_pool)
        .map((r) => r.id)
    );
    db.requirements = db.requirements.filter((r) => !poolReqIds.has(r.id));
    db.modules = db.modules.filter((m) => m.iteration_id !== poolIteration.id);
  }

  const moduleCache = new Map<string, string>();
  let requirementsCreated = 0;
  let modulesCreated = 0;
  let sortOrder =
    db.requirements.filter((r) => r.project_id === project.id && r.in_pool).length + 1;

  for (const row of preview.rows) {
    if (row.isModuleHeader) {
      const moduleName = row.moduleName ?? row.title;
      if (!moduleCache.has(moduleName)) {
        const mod: ModuleNode = {
          id: uid("mod-"),
          iteration_id: poolIteration.id,
          parent_id: null,
          name: moduleName,
          level: 1,
          estimate_level: "requirement",
          module_estimate_hours: null,
          sort_order: modulesCreated++,
        };
        db.modules.push(mod);
        moduleCache.set(moduleName, mod.id);
      }
      continue;
    }

    let moduleL1Id: string | null = null;
    if (row.moduleName) {
      if (!moduleCache.has(row.moduleName)) {
        const mod: ModuleNode = {
          id: uid("mod-"),
          iteration_id: poolIteration.id,
          parent_id: null,
          name: row.moduleName,
          level: 1,
          estimate_level: "requirement",
          module_estimate_hours: null,
          sort_order: modulesCreated++,
        };
        db.modules.push(mod);
        moduleCache.set(row.moduleName, mod.id);
      }
      moduleL1Id = moduleCache.get(row.moduleName) ?? null;
    }

    const status = mapNotionStatus(row.statusRaw);
    const req: Requirement = {
      ...REQUIREMENT_POOL_DEFAULTS,
      id: uid("req-"),
      project_id: project.id,
      iteration_id: poolIteration.id,
      module_l1_id: moduleL1Id,
      module_l2_id: null,
      title: row.title,
      sub_function: row.subFunction,
      detail_work: null,
      acceptance_criteria: null,
      priority: row.priority,
      status,
      status_tags: statusTagsFromTaskStatus(status),
      blocker_reason: null,
      sort_order: sortOrder++,
      in_pool: true,
      category: row.category,
      stage_type: row.stageType ?? row.statusRaw,
      optimization_notes: row.optimizationNotes,
      known_issues: row.knownIssues,
      submitted_at: row.submittedAt ?? nowIso().slice(0, 10),
      due_date: row.dueDate,
      difficulty_notes: row.difficultyNotes,
      scenario: row.scenario,
      needs_discussion: row.needsDiscussion,
      tags: row.tags ?? [],
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    db.requirements.push(req);
    requirementsCreated++;
  }

  await writeDb(db);
  return { requirementsCreated, modulesCreated };
}
