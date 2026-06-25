import type { ParsePreview, ParsedRequirementRow } from "@/lib/excel/parser";
import type { EstimateLevel, RoleType, TaskStatus } from "@/lib/types";
import {
  readDb,
  writeDb,
  uid,
  nowIso,
  getProjectById,
} from "@/lib/db";

const STATUS_MAP: Record<string, TaskStatus> = {
  未开始: "pending",
  进行中: "in_progress",
  联调中: "integration",
  联调: "integration",
  待测试: "testing",
  阻塞: "blocked",
  已完成: "done",
  待验收: "acceptance",
};

function mapStatus(raw?: string): TaskStatus {
  if (!raw) return "pending";
  for (const [key, val] of Object.entries(STATUS_MAP)) {
    if (raw.includes(key)) return val;
  }
  return "pending";
}

function detectModuleLevelHours(rows: ParsedRequirementRow[]): Set<number> {
  const moduleGroups = new Map<string, ParsedRequirementRow[]>();
  for (const row of rows) {
    const key = `${row.moduleL1}::${row.moduleL2}`;
    if (!moduleGroups.has(key)) moduleGroups.set(key, []);
    moduleGroups.get(key)!.push(row);
  }

  const moduleLevelIndices = new Set<number>();
  rows.forEach((row, idx) => {
    const key = `${row.moduleL1}::${row.moduleL2}`;
    const group = moduleGroups.get(key) ?? [];
    if (group.length <= 1) return;

    const firstWithHours = group.find((r) =>
      r.roles.some((role) => role.estimateHours != null && role.estimateHours > 0)
    );
    if (firstWithHours === row) {
      const backendHours = row.roles.find((r) => r.role === "backend")?.estimateHours;
      const subRowsHaveNoHours = group
        .filter((r) => r !== row)
        .every((r) => !r.roles.some((role) => role.estimateHours != null && role.estimateHours > 0));
      if (backendHours && subRowsHaveNoHours) {
        moduleLevelIndices.add(idx);
      }
    }
  });
  return moduleLevelIndices;
}

export interface ImportResult {
  iterationId: string;
  requirementsCreated: number;
  tasksCreated: number;
  modulesCreated: number;
  totalEstimateHours: number;
}

export async function importSheetToProject(
  projectIdOrSlug: string,
  sheet: ParsePreview,
  options?: { clearProjectRequirements?: boolean }
): Promise<ImportResult> {
  const project = await getProjectById(projectIdOrSlug);
  if (!project) throw new Error("项目不存在");

  const db = await readDb();
  const moduleLevelIndices = detectModuleLevelHours(sheet.rows);

  if (options?.clearProjectRequirements) {
    const reqIds = new Set(
      db.requirements
        .filter((r) => r.project_id === project.id && !r.in_pool)
        .map((r) => r.id)
    );
    db.requirements = db.requirements.filter(
      (r) => r.project_id !== project.id || r.in_pool
    );
    db.role_tasks = db.role_tasks.filter((t) => !reqIds.has(t.requirement_id));
    db.acceptance_items = db.acceptance_items.filter((a) => !reqIds.has(a.requirement_id));
    db.modules = db.modules.filter((m) => {
      const iter = db.iterations.find((i) => i.id === m.iteration_id);
      if (iter?.project_id !== project.id) return true;
      return iter.name === "需求池";
    });
  }

  const iterationName = sheet.rows[0]?.iterationName ?? sheet.sheetName;
  let iteration = db.iterations.find(
    (i) => i.project_id === project.id && i.name === iterationName
  );
  if (!iteration) {
    iteration = {
      id: uid("iter-"),
      project_id: project.id,
      name: iterationName,
      sort_order: db.iterations.filter((i) => i.project_id === project.id).length + 1,
      created_at: nowIso(),
    };
    db.iterations.push(iteration);
  }

  const moduleCache = new Map<string, string>();
  let requirementsCreated = 0;
  let tasksCreated = 0;
  let modulesCreated = 0;
  let totalEstimateHours = 0;

  for (let rowIdx = 0; rowIdx < sheet.rows.length; rowIdx++) {
    const row = sheet.rows[rowIdx];
    const isModuleLevel = moduleLevelIndices.has(rowIdx);

    let moduleL1Id: string | null = null;
    let moduleL2Id: string | null = null;

    if (row.moduleL1) {
      const l1Key = `${iteration.id}::${row.moduleL1}`;
      if (!moduleCache.has(l1Key)) {
        const mod = {
          id: uid("mod-"),
          iteration_id: iteration.id,
          parent_id: null,
          name: row.moduleL1,
          level: 1 as const,
          estimate_level: "requirement" as EstimateLevel,
          module_estimate_hours: null,
          sort_order: modulesCreated++,
        };
        db.modules.push(mod);
        moduleCache.set(l1Key, mod.id);
      }
      moduleL1Id = moduleCache.get(l1Key)!;
    }

    if (row.moduleL2) {
      const l2Key = `${iteration.id}::${row.moduleL1}::${row.moduleL2}`;
      if (!moduleCache.has(l2Key)) {
        const mod = {
          id: uid("mod-"),
          iteration_id: iteration.id,
          parent_id: moduleL1Id,
          name: row.moduleL2,
          level: 2 as const,
          estimate_level: (isModuleLevel ? "module" : "requirement") as EstimateLevel,
          module_estimate_hours: isModuleLevel
            ? row.roles.find((r) => r.role === "backend")?.estimateHours ?? null
            : null,
          sort_order: modulesCreated++,
        };
        db.modules.push(mod);
        moduleCache.set(l2Key, mod.id);
      }
      moduleL2Id = moduleCache.get(l2Key)!;
    }

    const title =
      row.subFunction ||
      row.moduleL2 ||
      row.moduleL1 ||
      "未命名需求";

    const requirement = {
      id: uid("req-"),
      project_id: project.id,
      iteration_id: iteration.id,
      module_l1_id: moduleL1Id,
      module_l2_id: moduleL2Id,
      title,
      sub_function: row.subFunction ?? null,
      detail_work: isModuleLevel
        ? `${row.detailWork ?? ""} [模块级工时]`.trim()
        : row.detailWork ?? null,
      acceptance_criteria: row.acceptanceCriteria ?? null,
      priority: row.priority ?? null,
      status: mapStatus(row.status),
      blocker_reason: row.blocker ?? null,
      sort_order: requirementsCreated,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    db.requirements.push(requirement);
    requirementsCreated++;

    if (row.acceptanceCriteria) {
      db.acceptance_items.push({
        id: uid("acc-"),
        requirement_id: requirement.id,
        description: row.acceptanceCriteria,
        passed: null,
        note: null,
        sort_order: 1,
      });
    } else {
      db.acceptance_items.push({
        id: uid("acc-"),
        requirement_id: requirement.id,
        description: `${title} - 功能符合 PRD`,
        passed: null,
        note: null,
        sort_order: 1,
      });
    }

    for (const roleData of row.roles) {
      const hours = isModuleLevel && roleData.role !== "backend" ? null : roleData.estimateHours;
      if (isModuleLevel && roleData.role === "backend" && rowIdx > 0) {
        // Only count module-level backend hours on first row of group
        const key = `${row.moduleL1}::${row.moduleL2}`;
        const firstIdx = sheet.rows.findIndex(
          (r, i) =>
            moduleLevelIndices.has(i) &&
            `${r.moduleL1}::${r.moduleL2}` === key
        );
        if (firstIdx !== rowIdx) continue;
      }
      if (isModuleLevel && roleData.role === "backend" && hours) {
        totalEstimateHours += hours;
      } else if (!isModuleLevel && hours) {
        totalEstimateHours += hours;
      }

      db.role_tasks.push({
        id: uid("task-"),
        requirement_id: requirement.id,
        role: roleData.role as RoleType,
        assignee: roleData.assignee ?? null,
        estimate_hours: hours ?? null,
        actual_hours: null,
        start_date: roleData.startDate ?? null,
        end_date: roleData.endDate ?? null,
        status: mapStatus(row.status),
        notes: null,
        blocker_reason: row.blocker ?? null,
        progress_percent: roleData.progress ?? null,
        updated_at: nowIso(),
      });
      tasksCreated++;
    }
  }

  db.notifications.unshift({
    id: uid("notif-"),
    project_id: project.id,
    recipient_name: "产品",
    type: "import_complete",
    title: `Excel 导入完成：${sheet.sheetName}`,
    body: `新增 ${requirementsCreated} 条需求，${tasksCreated} 个角色任务`,
    link: `/projects/${project.slug}/board`,
    is_read: false,
    created_at: nowIso(),
  });

  await writeDb(db);

  return {
    iterationId: iteration.id,
    requirementsCreated,
    tasksCreated,
    modulesCreated,
    totalEstimateHours,
  };
}
