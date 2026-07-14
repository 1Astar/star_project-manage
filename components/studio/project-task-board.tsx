"use client";



import { useRouter } from "next/navigation";

import { Fragment, useEffect, useState } from "react";

import { StudioBadge } from "@/components/studio/shell";

import type { StudioTask, TaskStatus } from "@/lib/studio/types";

import { TASK_STATUS_LABELS } from "@/lib/studio/types";



type ProjectTaskBoardProps = {

  projectId: string;

  tasks: StudioTask[];

  hasGitHub: boolean;

};



const STATUS_OPTIONS: TaskStatus[] = ["todo", "in_progress", "done", "paused"];



const cellInput =

  "w-full min-w-0 rounded border border-transparent bg-transparent px-1 py-1 text-sm outline-none hover:border-slate-200 focus:border-sky-300 focus:bg-white";



function toDateInput(value: string | null): string {

  if (!value) return "";

  return value.slice(0, 10);

}



function parseHoursInput(value: string): number | null {

  const trimmed = value.trim();

  if (!trimmed) return null;

  const n = Number(trimmed);

  return Number.isFinite(n) ? n : null;

}



function formatCompletedAt(iso: string): string {

  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);

  return d.toLocaleDateString("zh-CN");

}



function priorityTone(priority: string) {

  if (priority === "P0") return "p0" as const;

  if (priority === "P1") return "p1" as const;

  return "default" as const;

}



function formatHours(value: number | null): string {

  return value === null ? "" : String(value);

}



export function ProjectTaskBoard({ projectId, tasks: initialTasks, hasGitHub }: ProjectTaskBoardProps) {

  const router = useRouter();

  const [tasks, setTasks] = useState(initialTasks);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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

        gitCommitSha: null,

        gitCommitMessage: null,

      });

    } catch (error) {

      setMessage(error instanceof Error ? error.message : "更新失败");

    }

  }



  async function handleScheduleBlur(

    taskId: string,

    field: "startDate" | "endDate" | "dueDate" | "estimateHours" | "actualHours" | "blocker",

    raw: string

  ) {

    const existing = tasks.find((t) => t.id === taskId);

    if (!existing) return;



    let patch: Record<string, string | number | null>;

    if (field === "estimateHours" || field === "actualHours") {

      const parsed = parseHoursInput(raw);

      if (existing[field] === parsed) return;

      patch = { [field]: parsed };

    } else if (field === "blocker") {

      const value = raw.trim() || null;

      if (existing.blocker === value) return;

      patch = { blocker: value };

    } else {

      const value = raw.trim() || null;

      if (existing[field] === value) return;

      patch = { [field]: value };

    }



    try {

      await patchTask(taskId, patch);

    } catch (error) {

      setMessage(error instanceof Error ? error.message : "保存失败");

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



  function toggleExpand(taskId: string) {

    setExpanded((prev) => ({ ...prev, [taskId]: !prev[taskId] }));

  }



  if (tasks.length === 0) {

    return (

      <section>

        <h2 className="text-sm font-semibold text-stone-500">Studio 需求任务</h2>

        <p className="mt-2 text-sm text-stone-400">暂无任务。从「捕捉想法」拆解后会自动写入。</p>

      </section>

    );

  }



  const doneCount = tasks.filter((t) => t.status === "done").length;



  return (

    <section>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">

        <div>

          <p className="text-xs text-stone-400">

            {doneCount}/{tasks.length} 已完成 · 点击行尾 ▼ 展开备注与 Git 信息

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



      {message ? <p className="mb-2 text-xs text-stone-600">{message}</p> : null}



      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">

        <table className="w-full min-w-[960px] text-sm">

          <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs text-stone-500">

            <tr>

              <th className="min-w-[140px] px-2 py-2.5 font-medium">标题</th>

              <th className="px-2 py-2.5 font-medium">状态</th>

              <th className="px-2 py-2.5 font-medium">优先级</th>

              <th className="px-2 py-2.5 font-medium">开始</th>

              <th className="px-2 py-2.5 font-medium">结束</th>

              <th className="px-2 py-2.5 font-medium">截止</th>

              <th className="px-2 py-2.5 font-medium">预估h</th>

              <th className="px-2 py-2.5 font-medium">实际h</th>

              <th className="min-w-[100px] px-2 py-2.5 font-medium">阻塞</th>

              <th className="w-10 px-2 py-2.5 font-medium" />

            </tr>

          </thead>

          <tbody className="divide-y divide-stone-100">

            {tasks.map((task) => {

              const isOpen = expanded[task.id];

              return (

                <Fragment key={task.id}>

                  <tr className="hover:bg-stone-50/80">

                    <td className="px-2 py-1.5 align-top">

                      <div className="font-medium text-stone-800">{task.title}</div>

                      {task.workload ? (

                        <div className="mt-0.5 text-xs text-stone-400">{task.workload}</div>

                      ) : null}

                    </td>

                    <td className="px-2 py-1.5 align-top">

                      <select

                        value={task.status}

                        onChange={(e) => handleStatusChange(task.id, e.target.value as TaskStatus)}

                        className={`${cellInput} text-xs`}

                      >

                        {STATUS_OPTIONS.map((s) => (

                          <option key={s} value={s}>

                            {TASK_STATUS_LABELS[s]}

                          </option>

                        ))}

                      </select>

                    </td>

                    <td className="px-2 py-1.5 align-top">

                      <StudioBadge tone={priorityTone(task.priority)}>{task.priority}</StudioBadge>

                    </td>

                    <td className="px-2 py-1.5 align-top">

                      <input

                        type="date"

                        defaultValue={toDateInput(task.startDate)}

                        onBlur={(e) => handleScheduleBlur(task.id, "startDate", e.target.value)}

                        className={`${cellInput} text-xs`}

                      />

                    </td>

                    <td className="px-2 py-1.5 align-top">

                      <input

                        type="date"

                        defaultValue={toDateInput(task.endDate)}

                        onBlur={(e) => handleScheduleBlur(task.id, "endDate", e.target.value)}

                        className={`${cellInput} text-xs`}

                      />

                    </td>

                    <td className="px-2 py-1.5 align-top">

                      <input

                        type="date"

                        defaultValue={toDateInput(task.dueDate)}

                        onBlur={(e) => handleScheduleBlur(task.id, "dueDate", e.target.value)}

                        className={`${cellInput} text-xs`}

                      />

                    </td>

                    <td className="px-2 py-1.5 align-top">

                      <input

                        type="number"

                        min={0}

                        step={0.5}

                        defaultValue={formatHours(task.estimateHours)}

                        onBlur={(e) => handleScheduleBlur(task.id, "estimateHours", e.target.value)}

                        placeholder="—"

                        className={`${cellInput} w-16 text-xs`}

                      />

                    </td>

                    <td className="px-2 py-1.5 align-top">

                      <input

                        type="number"

                        min={0}

                        step={0.5}

                        defaultValue={formatHours(task.actualHours)}

                        onBlur={(e) => handleScheduleBlur(task.id, "actualHours", e.target.value)}

                        placeholder="—"

                        className={`${cellInput} w-16 text-xs`}

                      />

                    </td>

                    <td className="px-2 py-1.5 align-top">

                      <input

                        type="text"

                        defaultValue={task.blocker ?? ""}

                        onBlur={(e) => handleScheduleBlur(task.id, "blocker", e.target.value)}

                        placeholder="—"

                        className={`${cellInput} text-xs`}

                      />

                    </td>

                    <td className="px-2 py-1.5 align-top text-center">

                      <button

                        type="button"

                        onClick={() => toggleExpand(task.id)}

                        className="rounded px-1.5 py-0.5 text-xs text-stone-500 hover:bg-stone-100"

                        aria-expanded={isOpen}

                        aria-label={isOpen ? "收起详情" : "展开详情"}

                      >

                        {isOpen ? "▲" : "▼"}

                      </button>

                    </td>

                  </tr>

                  {isOpen ? (

                    <tr className="bg-stone-50/60">

                      <td colSpan={10} className="px-4 py-3">

                        {task.status === "done" && task.completionSource ? (

                          <p className="mb-2 text-xs text-emerald-700">

                            {task.completionSource === "git" ? "✓ Git 检测完成" : "✓ 手动标记完成"}

                            {task.completedAt ? ` · ${formatCompletedAt(task.completedAt)}` : ""}

                            {task.gitCommitMessage ? ` · ${task.gitCommitMessage}` : ""}

                          </p>

                        ) : null}

                        <label className="block text-xs text-stone-500">

                          进度备注

                          <textarea

                            key={`${task.id}-${task.progressNote}`}

                            defaultValue={task.progressNote}

                            onBlur={(e) => handleNoteBlur(task.id, e.target.value)}

                            rows={3}

                            placeholder="记录进展、决策、下一步…"

                            className="mt-1 w-full rounded-md border border-stone-200 bg-white px-2 py-1.5 text-sm text-stone-700 outline-none focus:border-sky-300"

                          />

                        </label>

                      </td>

                    </tr>

                  ) : null}

                </Fragment>

              );

            })}

          </tbody>

        </table>

      </div>

    </section>

  );

}


