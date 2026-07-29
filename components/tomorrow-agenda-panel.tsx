"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StudioBadge } from "@/components/studio/shell";
import type { TomorrowAgendaItem } from "@/lib/workbench/tomorrow-agenda";
import { cn } from "@/lib/utils";

type Props = {
  todayDay: string;
  yesterdayDay: string;
  tomorrowDay?: string;
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
  tomorrowDay,
  items,
  projects,
  initialProjectId,
}: Props) {
  const [projectId, setProjectId] = useState(initialProjectId ?? "");

  const filtered = useMemo(() => {
    if (!projectId) return items;
    return items.filter((i) => i.projectId === projectId);
  }, [items, projectId]);

  return (
    <section className="rounded-xl border border-indigo-100 bg-white">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">明日待办</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            只收明天真要推的（非完整 backlog）· 基准 {todayDay}
            {tomorrowDay ? ` · 目标日 ${tomorrowDay}` : ""} · 含 {yesterdayDay}{" "}
            变更未完 / 会话未勾完 / 到期=明天 · 共 {filtered.length} 条
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
          明天暂无专属事项。昨日无未完变更、也没有到期日为明天的任务时会为空——完整待办请看下方区块。
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
                        item.reason === "due_tomorrow"
                          ? "bg-sky-50 text-sky-800"
                          : "bg-amber-50 text-amber-800"
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
