"use client";

import { useMemo } from "react";
import type { ModuleNode, Requirement, RoleTask } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";

export function HoursView({
  requirements,
  tasks,
  modules = [],
}: {
  requirements: Requirement[];
  tasks: RoleTask[];
  modules?: ModuleNode[];
}) {
  const moduleLevelIds = new Set(
    modules.filter((m) => m.estimate_level === "module").map((m) => m.id)
  );

  const dedupedTasks = useMemo(() => {
    const moduleScheduledReqIds = new Set(
      requirements
        .filter(
          (r) =>
            (r.module_l2_id && moduleLevelIds.has(r.module_l2_id)) ||
            (r.module_l1_id && moduleLevelIds.has(r.module_l1_id))
        )
        .map((r) => r.id)
    );

    return tasks.filter((t) => {
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
  }, [tasks, requirements, moduleLevelIds]);

  const byRole = useMemo(() => {
    const map = new Map<string, { estimate: number; actual: number; count: number }>();
    for (const task of dedupedTasks) {
      const current = map.get(task.role) ?? { estimate: 0, actual: 0, count: 0 };
      current.estimate += task.estimate_hours ?? 0;
      current.actual += task.actual_hours ?? 0;
      current.count += 1;
      map.set(task.role, current);
    }
    return Array.from(map.entries()).map(([role, stats]) => ({
      role,
      label: ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role,
      ...stats,
    }));
  }, [dedupedTasks]);

  const byRequirement = useMemo(() => {
    return requirements.map((req) => {
      const reqTasks = dedupedTasks.filter((t) => t.requirement_id === req.id);
      const estimate = reqTasks.reduce((sum, t) => sum + (t.estimate_hours ?? 0), 0);
      const isModuleLevel = req.detail_work?.includes("模块级工时");
      return { req, estimate, isModuleLevel, taskCount: reqTasks.length };
    });
  }, [requirements, dedupedTasks]);

  const totalEstimate = byRole.reduce((s, r) => s + r.estimate, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <div className="text-sm text-slate-500">预估总工时（去重后）</div>
          <div className="mt-1 text-2xl font-bold">{totalEstimate}h</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-slate-500">需求数</div>
          <div className="mt-1 text-2xl font-bold">{requirements.length}</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-slate-500">角色任务数</div>
          <div className="mt-1 text-2xl font-bold">{dedupedTasks.length}</div>
        </div>
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 font-semibold">按岗位</div>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">岗位</th>
              <th className="px-4 py-2">任务数</th>
              <th className="px-4 py-2">预估工时</th>
              <th className="px-4 py-2">实际工时</th>
              <th className="px-4 py-2">偏差</th>
            </tr>
          </thead>
          <tbody>
            {byRole.map((row) => (
              <tr key={row.role} className="border-t border-slate-100">
                <td className="px-4 py-2">{row.label}</td>
                <td className="px-4 py-2">{row.count}</td>
                <td className="px-4 py-2">{row.estimate}h</td>
                <td className="px-4 py-2">{row.actual}h</td>
                <td className="px-4 py-2">{row.actual - row.estimate}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 font-semibold">按需求</div>
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">需求</th>
              <th className="px-4 py-2">任务数</th>
              <th className="px-4 py-2">预估工时</th>
              <th className="px-4 py-2">备注</th>
            </tr>
          </thead>
          <tbody>
            {byRequirement.map(({ req, estimate, isModuleLevel, taskCount }) => (
              <tr key={req.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{req.title}</td>
                <td className="px-4 py-2">{taskCount}</td>
                <td className="px-4 py-2">{estimate}h</td>
                <td className="px-4 py-2 text-slate-500">
                  {isModuleLevel ? "模块级工时（不重复累计）" : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
