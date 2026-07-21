"use client";

import Link from "next/link";
import { StudioBadge } from "@/components/studio/shell";
import {
  requirementColumn,
  type RequirementKanbanItem,
} from "@/components/requirement-status-kanban";

export function GlobalRequirementTable({ items }: { items: RequirementKanbanItem[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">项目</th>
              <th className="px-3 py-3 font-medium">需求</th>
              <th className="px-3 py-3 font-medium">状态</th>
              <th className="px-3 py-3 font-medium">优先级</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-slate-400">
                  没有符合条件的需求
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const col = requirementColumn(item.req);
                const href = `/projects/${item.projectSlug}/requirements/${item.req.id}`;
                return (
                  <tr key={`${item.projectSlug}-${item.req.id}`} className="hover:bg-indigo-50/40">
                    <td className="px-4 py-3 text-xs text-slate-500">{item.projectName}</td>
                    <td className="px-3 py-3">
                      <Link
                        href={href}
                        className="font-medium text-slate-900 hover:text-indigo-700"
                      >
                        {item.req.title}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <StudioBadge tone={col === "阻塞" ? "warning" : "muted"}>{col}</StudioBadge>
                    </td>
                    <td className="px-3 py-3">
                      <StudioBadge
                        tone={
                          item.req.priority === "P0"
                            ? "p0"
                            : item.req.priority === "P1"
                              ? "p1"
                              : "muted"
                        }
                      >
                        {item.req.priority || "—"}
                      </StudioBadge>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
