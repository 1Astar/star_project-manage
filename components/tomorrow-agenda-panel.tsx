"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StudioBadge } from "@/components/studio/shell";
import type { TomorrowAgendaItem } from "@/lib/workbench/tomorrow-agenda";
import { cn } from "@/lib/utils";

type Props = {
  todayDay: string;
  yesterdayDay: string;
  items: TomorrowAgendaItem[];
  projects: Array<{ id: string; title: string }>;
  initialProjectId?: string | null;
};

function priorityTone(p: string) {
  if (p === "P0") return "p0" as const;
  if (p === "P1") return "p1" as const;
  return "muted" as const;
}

export function TomorrowAgendaPanel({
  todayDay,
  yesterdayDay,
  items,
  projects,
  initialProjectId,
}: Props) {
  const [projectId, setProjectId] = useState(initialProjectId ?? "");

  const filtered = useMemo(() => {
    if (!projectId) return items;
    return items.filter((i) => i.projectId === projectId);
  }, [items, projectId]);

  const changedCount = filtered.filter((i) => i.reason !== "open_task").length;

  return (
    <section className="rounded-xl border border-indigo-100 bg-white">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">明日待办清单</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            自动生成（不落库）· 基准日 {todayDay} · 优先纳入 {yesterdayDay}{" "}
            有变更且未完 · 共 {filtered.length} 条
            {changedCount > 0 ? `（其中昨日相关 ${changedCount}）` : ""}
          </p>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <span>项目</span>
          <select
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">全部项目</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-400">
          当前筛选下没有待办。昨天没改需求、也没有未完成 Studio 任务时会比较空。
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filtered.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className="flex flex-wrap items-start gap-2 px-4 py-3 hover:bg-indigo-50/40"
              >
                <StudioBadge tone={priorityTone(String(item.priority))}>
                  {item.priority || "—"}
                </StudioBadge>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium text-slate-900">{item.title}</span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px]",
                        item.reason === "yesterday_changed" ||
                          item.reason === "change_session_pending"
                          ? "bg-amber-50 text-amber-800"
                          : "bg-slate-50 text-slate-500"
                      )}
                    >
                      {item.reasonLabel}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {item.projectTitle}
                    <span className="mx-1 text-slate-300">·</span>
                    {item.statusLabel}
                    {item.note ? (
                      <>
                        <span className="mx-1 text-slate-300">·</span>
                        <span className="text-slate-400">{item.note}</span>
                      </>
                    ) : null}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
