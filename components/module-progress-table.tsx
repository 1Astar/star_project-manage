"use client";

import { useMemo } from "react";
import type { ChangeSession, EvolutionLog, Idea } from "@/lib/studio/types";
import { buildModuleProgressRows } from "@/lib/studio/module-progress";
import { cn } from "@/lib/utils";

const KIND_LABEL = {
  evolution: "演进",
  idea: "灵感",
  change: "变更",
} as const;

type Props = {
  modules: string[];
  evolution: EvolutionLog[];
  ideas: Idea[];
  changeSessions: ChangeSession[];
  pathPrefix?: string | null;
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("zh-CN");
  } catch {
    return iso.slice(0, 10);
  }
}

export function ModuleProgressTable({
  modules,
  evolution,
  ideas,
  changeSessions,
  pathPrefix,
}: Props) {
  const rows = useMemo(
    () =>
      buildModuleProgressRows({
        modules,
        evolution,
        ideas,
        changeSessions,
        pathPrefix,
      }),
    [modules, evolution, ideas, changeSessions, pathPrefix]
  );

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        还没有板块数据。在项目设置里填功能板块，或给演进/灵感打板块标签。
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-100 bg-slate-50 text-xs font-medium text-slate-500">
          <tr>
            <th className="px-4 py-2.5">板块</th>
            <th className="whitespace-nowrap px-3 py-2.5">提出时间</th>
            <th className="px-3 py-2.5">改进记录</th>
            <th className="whitespace-nowrap px-3 py-2.5">工时</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.path} className="border-b border-slate-100 align-top last:border-0">
              <td className="px-4 py-3">
                <div
                  className={cn(
                    "font-medium text-slate-900",
                    row.depth === 0 ? "text-sm" : "text-[13px] text-slate-700"
                  )}
                  style={{ paddingLeft: row.depth * 14 }}
                >
                  {row.depth > 0 ? (
                    <span className="mr-1 text-slate-300">└</span>
                  ) : null}
                  {row.label}
                </div>
                {row.depth === 0 && row.path.includes("·") === false ? (
                  <p className="mt-0.5 text-[10px] text-slate-400">{row.path}</p>
                ) : row.depth > 0 ? (
                  <p
                    className="mt-0.5 text-[10px] text-slate-400"
                    style={{ paddingLeft: row.depth * 14 + 12 }}
                  >
                    {row.path}
                  </p>
                ) : null}
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">
                {formatDate(row.proposedAt)}
              </td>
              <td className="px-3 py-3">
                {row.nodes.length === 0 ? (
                  <span className="text-xs text-slate-400">暂无</span>
                ) : (
                  <ol className="relative max-w-xl space-y-2.5 border-l border-slate-200 pl-3">
                    {row.nodes.map((node) => (
                      <li key={`${node.kind}:${node.id}`} className="relative">
                        <span className="absolute -left-[0.97rem] top-1.5 h-2 w-2 rounded-full bg-indigo-400 ring-2 ring-white" />
                        <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                          {KIND_LABEL[node.kind]}
                          {" · "}
                          {node.at.slice(0, 10)}
                          {node.rangeLabel ? ` · ${node.rangeLabel}` : ""}
                          {node.durationMs != null
                            ? ` · ${formatDurationShort(node.durationMs)}`
                            : ""}
                        </div>
                        <div className="text-[13px] font-medium text-slate-800">
                          {node.title}
                        </div>
                        {node.note ? (
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
                            {node.note}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-xs font-medium text-slate-700">
                {row.totalDurationLabel}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatDurationShort(ms: number) {
  const min = Math.round(ms / 60000);
  if (min < 1) return "<1m";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}
