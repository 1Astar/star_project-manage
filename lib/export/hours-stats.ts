import type { ModuleNode, Requirement, RoleTask } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";

export type HoursRoleRow = {
  role: string;
  label: string;
  count: number;
  estimate: number;
  actual: number;
  delta: number;
};

export type HoursReqRow = {
  title: string;
  taskCount: number;
  estimate: number;
  note: string;
};

export function buildHoursTables(
  requirements: Requirement[],
  tasks: RoleTask[],
  modules: ModuleNode[] = []
): { byRole: HoursRoleRow[]; byRequirement: HoursReqRow[] } {
  const moduleLevelIds = new Set(
    modules.filter((m) => m.estimate_level === "module").map((m) => m.id)
  );
  const moduleScheduledReqIds = new Set(
    requirements
      .filter(
        (r) =>
          (r.module_l2_id && moduleLevelIds.has(r.module_l2_id)) ||
          (r.module_l1_id && moduleLevelIds.has(r.module_l1_id))
      )
      .map((r) => r.id)
  );

  const dedupedTasks = tasks.filter((t) => {
    if (!moduleScheduledReqIds.has(t.requirement_id)) return true;
    if (t.role === "backend" && t.estimate_hours != null) {
      const req = requirements.find((r) => r.id === t.requirement_id);
      const modId = req?.module_l2_id ?? req?.module_l1_id;
      if (!modId) return true;
      const firstReq = requirements.find(
        (r) =>
          (r.module_l2_id === modId || r.module_l1_id === modId) &&
          tasks.some((x) => x.requirement_id === r.id && x.role === "backend" && x.estimate_hours)
      );
      return firstReq?.id === t.requirement_id;
    }
    return t.estimate_hours == null || t.estimate_hours === 0;
  });

  const roleMap = new Map<string, { estimate: number; actual: number; count: number }>();
  for (const task of dedupedTasks) {
    const current = roleMap.get(task.role) ?? { estimate: 0, actual: 0, count: 0 };
    current.estimate += task.estimate_hours ?? 0;
    current.actual += task.actual_hours ?? 0;
    current.count += 1;
    roleMap.set(task.role, current);
  }

  const byRole: HoursRoleRow[] = Array.from(roleMap.entries()).map(([role, stats]) => ({
    role,
    label: ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role,
    count: stats.count,
    estimate: stats.estimate,
    actual: stats.actual,
    delta: stats.actual - stats.estimate,
  }));

  const byRequirement: HoursReqRow[] = requirements.map((req) => {
    const reqTasks = dedupedTasks.filter((t) => t.requirement_id === req.id);
    const estimate = reqTasks.reduce((sum, t) => sum + (t.estimate_hours ?? 0), 0);
    const isModuleLevel = req.detail_work?.includes("模块级工时");
    return {
      title: req.title,
      taskCount: reqTasks.length,
      estimate,
      note: isModuleLevel ? "模块级工时" : "",
    };
  });

  return { byRole, byRequirement };
}
