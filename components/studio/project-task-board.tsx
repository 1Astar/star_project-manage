"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { StudioBadge } from "@/components/studio/shell";
import type { StudioTask, TaskStatus } from "@/lib/studio/types";
import { TASK_STATUS_LABELS } from "@/lib/studio/types";

type ProjectTaskBoardProps = {
  projectId: string;
  tasks: StudioTask[];
  hasGitHub: boolean;
};

const STATUS_OPTIONS: TaskStatus[] = ["todo", "in_progress", "done", "paused"];

function priorityTone(priority: string) {
  if (priority === "P0") return "p0" as const;
  if (priority === "P1") return "p1" as const;
  return "default" as const;
}

export function ProjectTaskBoard({ projectId, tasks: initialTasks, hasGitHub }: ProjectTaskBoardProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  async function patchTask(taskId: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/studio/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "更新失败");
    setTasks((prev) => prev.map((t) => (t.id === taskId ? data.task : t)));
  }

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    try {
      await patchTask(taskId, {
        status,
        completionSource: status === "done" ? "manual" : null,
        gitCommitSha: status === "done" ? null : null,
        gitCommitMessage: status === "done" ? null : null,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新失败");
    }
  }

  async function handleNoteBlur(taskId: string, progressNote: string) {
    const existing = tasks.find((t) => t.id === taskId);
    if (!existing || existing.progressNote === progressNote) return;
    try {
      await patchTask(taskId, { progressNote });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "备注保存失败");
    }
  }

  async function syncFromGit() {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/studio/projects/${projectId}/tasks/sync-git`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Git 同步失败");
        return;
      }
      setMessage(
        data.matched > 0
          ? `已从 Git 匹配 ${data.matched} 条已完成任务`
          : "未发现可匹配的 commit，请检查 commit message 是否含任务关键词"
      );
      router.refresh();
    } catch {
      setMessage("网络错误");
    } finally {
      setSyncing(false);
    }
  }

  if (tasks.length === 0) {
    return (
      <section className="mt-8">
        <h2 className="text-sm font-semibold text-stone-500">需求任务</h2>
        <p className="mt-2 text-sm text-stone-400">暂无任务。从「捕捉想法」拆解后会自动写入。</p>
      </section>
    );
  }

  const doneCount = tasks.filter((t) => t.status === "done").length;

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-stone-500">需求任务</h2>
          <p className="mt-0.5 text-xs text-stone-400">
            {doneCount}/{tasks.length} 已完成 · 可手动标记或通过 Git commit 检测
          </p>
        </div>
        {hasGitHub ? (
          <button
            type="button"
            onClick={syncFromGit}
            disabled={syncing}
            className="rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
          >
            {syncing ? "检测中…" : "从 Git 检测完成"}
          </button>
        ) : null}
      </div>

      {message ? <p className="mt-2 text-xs text-stone-600">{message}</p> : null}

      <ul className="mt-3 space-y-3">
        {tasks.map((task) => (
          <li key={task.id} className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-stone-800">{task.title}</div>
                {task.workload ? (
                  <p className="mt-0.5 text-xs text-stone-500">{task.workload}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StudioBadge tone={priorityTone(task.priority)}>{task.priority}</StudioBadge>
                <select
                  value={task.status}
                  onChange={(e) => handleStatusChange(task.id, e.target.value as TaskStatus)}
                  className="rounded-md border border-stone-200 px-2 py-1 text-xs"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {TASK_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {task.status === "done" && task.completionSource ? (
              <p className="mt-2 text-xs text-emerald-700">
                {task.completionSource === "git" ? "✓ Git 检测完成" : "✓ 手动标记完成"}
                {task.gitCommitMessage ? ` · ${task.gitCommitMessage}` : ""}
              </p>
            ) : null}

            {task.blocker ? (
              <p className="mt-1 text-xs text-orange-600">阻塞：{task.blocker}</p>
            ) : null}

            <label className="mt-3 block text-xs text-stone-500">
              进度备注
              <textarea
                defaultValue={task.progressNote}
                onBlur={(e) => handleNoteBlur(task.id, e.target.value)}
                rows={2}
                placeholder="记录进展、决策、下一步…"
                className="mt-1 w-full rounded-md border border-stone-100 bg-stone-50 px-2 py-1.5 text-sm text-stone-700 outline-none focus:border-sky-300"
              />
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
