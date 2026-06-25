"use client";

import { useMemo, useState } from "react";
import type { ModuleNode, Requirement, RoleTask } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/types";

function dayOffset(base: Date, target: Date): number {
  return Math.round((target.getTime() - base.getTime()) / 86400000);
}

interface GanttItem {
  id: string;
  title: string;
  role: string;
  assignee?: string | null;
  start: Date;
  end: Date;
  level: "module" | "requirement";
}

export function GanttView({
  requirements,
  tasks,
  modules = [],
}: {
  requirements: Requirement[];
  tasks: RoleTask[];
  modules?: ModuleNode[];
}) {
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<"all" | "module" | "requirement">("all");

  const scheduled = useMemo(() => {
    const items: GanttItem[] = [];

    const moduleLevelMods = modules.filter((m) => m.estimate_level === "module");
    for (const mod of moduleLevelMods) {
      const modReqs = requirements.filter(
        (r) => r.module_l2_id === mod.id || r.module_l1_id === mod.id
      );
      const modTasks = tasks.filter(
        (t) =>
          modReqs.some((r) => r.id === t.requirement_id) &&
          t.start_date &&
          t.end_date &&
          t.estimate_hours != null
      );
      if (modTasks.length === 0) continue;

      const starts = modTasks.map((t) => new Date(t.start_date!));
      const ends = modTasks.map((t) => new Date(t.end_date!));
      const backendTask = modTasks.find((t) => t.role === "backend") ?? modTasks[0];

      items.push({
        id: `mod-${mod.id}`,
        title: `[模块] ${mod.name}`,
        role: backendTask.role,
        assignee: backendTask.assignee,
        start: new Date(Math.min(...starts.map((d) => d.getTime()))),
        end: new Date(Math.max(...ends.map((d) => d.getTime()))),
        level: "module",
      });
    }

    const moduleScheduledReqIds = new Set(
      modules
        .filter((m) => m.estimate_level === "module")
        .flatMap((mod) =>
          requirements
            .filter((r) => r.module_l2_id === mod.id || r.module_l1_id === mod.id)
            .map((r) => r.id)
        )
    );

    for (const t of tasks) {
      if (!t.start_date || !t.end_date) continue;
      if (roleFilter !== "all" && t.role !== roleFilter) continue;

      const req = requirements.find((r) => r.id === t.requirement_id);
      const isUnderModuleSchedule = moduleScheduledReqIds.has(t.requirement_id);
      if (isUnderModuleSchedule && t.role === "backend") continue;

      items.push({
        id: t.id,
        title: req?.title ?? "未命名需求",
        role: t.role,
        assignee: t.assignee,
        start: new Date(t.start_date),
        end: new Date(t.end_date),
        level: "requirement",
      });
    }

    return items.filter((i) => levelFilter === "all" || i.level === levelFilter);
  }, [tasks, requirements, modules, roleFilter, levelFilter]);

  if (scheduled.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-slate-500">
        暂无可排期任务。导入 Excel 或为角色任务填写开始/结束时间后自动生成。模块级排期显示为一条汇总 bar。
      </div>
    );
  }

  const minDate = new Date(Math.min(...scheduled.map((s) => s.start.getTime())));
  const maxDate = new Date(Math.max(...scheduled.map((s) => s.end.getTime())));
  const totalDays = Math.max(dayOffset(minDate, maxDate), 1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="all">全部岗位</option>
          {Object.entries(ROLE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as "all" | "module" | "requirement")}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="all">全部层级</option>
          <option value="module">仅模块级</option>
          <option value="requirement">仅需求级</option>
        </select>
      </div>

      <div className="card overflow-x-auto p-4">
        <div className="min-w-[720px] space-y-3">
          {scheduled.map((item) => {
            const left = (dayOffset(minDate, item.start) / totalDays) * 100;
            const width = Math.max((dayOffset(item.start, item.end) / totalDays) * 100, 2);
            return (
              <div key={item.id} className="grid grid-cols-[240px_1fr] items-center gap-4">
                <div className="text-sm">
                  <div className="font-medium">{item.title}</div>
                  <div className="text-slate-500">
                    {ROLE_LABELS[item.role as keyof typeof ROLE_LABELS] ?? item.role}
                    {item.assignee ? ` · ${item.assignee}` : ""}
                    {item.level === "module" ? " · 模块排期" : ""}
                  </div>
                </div>
                <div className="relative h-8 rounded bg-slate-100">
                  <div
                    className={`absolute top-1 h-6 rounded ${
                      item.level === "module" ? "bg-violet-500/80" : "bg-blue-500/80"
                    }`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
