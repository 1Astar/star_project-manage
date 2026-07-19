"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBugAction, updateBugStatusAction } from "@/lib/actions";
import { StudioBadge } from "@/components/studio/shell";
import type { Bug, TaskStatus } from "@/lib/types";
import { TASK_STATUS_LABELS } from "@/lib/types";

const OPEN_STATUSES: TaskStatus[] = ["pending", "in_progress", "testing", "blocked"];
const RESOLVED: TaskStatus[] = ["done", "acceptance"];

export function ProjectBugsClient({
  projectId,
  projectSlug,
  bugs: initialBugs,
}: {
  projectId: string;
  projectSlug: string;
  bugs: Bug[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<"all" | "open">("all");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const bugs =
    filter === "open"
      ? initialBugs.filter((b) => OPEN_STATUSES.includes(b.status))
      : initialBugs;

  function submit() {
    if (!title.trim()) return;
    startTransition(async () => {
      try {
        await createBugAction({
          projectId,
          projectSlug,
          title: title.trim(),
          description: description.trim() || undefined,
        });
        setTitle("");
        setDescription("");
        setMessage("已提交 Bug");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "提交失败");
      }
    });
  }

  function setStatus(bugId: string, status: TaskStatus) {
    startTransition(async () => {
      await updateBugStatusAction({ bugId, projectSlug, status });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Bug 反馈</h2>
          <p className="text-xs text-slate-500">共 {initialBugs.length} 项</p>
        </div>
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
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-medium text-slate-700">+ 提 Bug</h3>
        <div className="space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Bug 标题"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="描述 / 复现步骤"
            rows={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pending || !title.trim()}
              onClick={submit}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              提交
            </button>
            {message ? <span className="text-xs text-slate-500">{message}</span> : null}
          </div>
        </div>
      </section>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2.5">标题</th>
              <th className="px-3 py-2.5">状态</th>
              <th className="px-3 py-2.5">创建</th>
              <th className="px-3 py-2.5">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bugs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-slate-400">
                  暂无 Bug
                </td>
              </tr>
            ) : (
              bugs.map((bug) => (
                <tr key={bug.id} className="hover:bg-slate-50/80">
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-slate-800">{bug.title}</div>
                    {bug.description ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{bug.description}</p>
                    ) : null}
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
