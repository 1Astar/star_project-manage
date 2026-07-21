"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBugStatusAction } from "@/lib/actions";
import { BugCreateForm, type BugFormOption, type MemberOption } from "@/components/bug-side-form";
import { StudioBadge } from "@/components/studio/shell";
import type { Bug, TaskStatus } from "@/lib/types";
import {
  BUG_SEVERITY_LABELS,
  BUG_TYPE_LABELS,
  TASK_STATUS_LABELS,
  type BugSeverity,
} from "@/lib/types";

const OPEN_STATUSES: TaskStatus[] = ["pending", "in_progress", "testing", "blocked"];
const RESOLVED: TaskStatus[] = ["done", "acceptance"];

export function ProjectBugsClient({
  projectId,
  projectSlug,
  bugs: initialBugs,
  members,
  requirements,
}: {
  projectId: string;
  projectSlug: string;
  bugs: Bug[];
  members: MemberOption[];
  requirements: BugFormOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<"all" | "open">("all");
  const [showCreate, setShowCreate] = useState(false);

  const bugs =
    filter === "open"
      ? initialBugs.filter((b) => OPEN_STATUSES.includes(b.status))
      : initialBugs;

  function setStatus(bugId: string, status: TaskStatus) {
    startTransition(async () => {
      await updateBugStatusAction({ bugId, projectSlug, status });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Bug 反馈</h2>
          <p className="text-xs text-slate-500">共 {initialBugs.length} 项</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-sm">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`rounded-lg px-3 py-1 ${filter === "all" ? "bg-white shadow-sm" : ""}`}
            >
              所有
            </button>
            <button
              type="button"
              onClick={() => setFilter("open")}
              className={`rounded-lg px-3 py-1 ${filter === "open" ? "bg-white shadow-sm" : ""}`}
            >
              未解决
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            {showCreate ? "收起表单" : "+ 提 Bug"}
          </button>
        </div>
      </div>

      {showCreate ? (
        <BugCreateForm
          projectId={projectId}
          projectSlug={projectSlug}
          members={members}
          requirements={requirements}
        />
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2.5">标题</th>
              <th className="px-3 py-2.5">严重</th>
              <th className="px-3 py-2.5">类型</th>
              <th className="px-3 py-2.5">状态</th>
              <th className="px-3 py-2.5">创建</th>
              <th className="px-3 py-2.5">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bugs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                  暂无 Bug
                </td>
              </tr>
            ) : (
              bugs.map((bug) => {
                const severity = (bug.severity ?? 3) as BugSeverity;
                return (
                  <tr key={bug.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/projects/${projectSlug}/bugs/${bug.id}`}
                        className="font-medium text-indigo-700 hover:underline"
                      >
                        {bug.title}
                      </Link>
                      {bug.assignee ? (
                        <div className="mt-0.5 text-xs text-slate-500">指派 {bug.assignee}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">
                      {BUG_SEVERITY_LABELS[severity] ?? severity}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">
                      {BUG_TYPE_LABELS[bug.bug_type] ?? bug.bug_type ?? "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <StudioBadge
                        tone={RESOLVED.includes(bug.status) ? "success" : "warning"}
                      >
                        {TASK_STATUS_LABELS[bug.status]}
                      </StudioBadge>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">
                      {new Date(bug.created_at).toLocaleDateString("zh-CN")}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {!RESOLVED.includes(bug.status) ? (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setStatus(bug.id, "done")}
                            className="rounded border border-emerald-200 px-2 py-0.5 text-[11px] text-emerald-700"
                          >
                            解决
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setStatus(bug.id, "pending")}
                            className="rounded border border-slate-200 px-2 py-0.5 text-[11px] text-slate-600"
                          >
                            重开
                          </button>
                        )}
                      </div>
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
