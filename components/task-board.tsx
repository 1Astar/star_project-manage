"use client";

import { useState, useTransition } from "react";
import { saveRoleTaskAction, updateTaskStatusAction } from "@/lib/actions";
import { ROLE_LABELS, TASK_STATUS_FLOW, TASK_STATUS_LABELS } from "@/lib/types";
import type { Requirement, RoleTask, TaskStatus } from "@/lib/types";
import { StatusBadge } from "@/components/ui";

export function TaskCard({
  task,
  requirement,
  projectId,
  actorName,
  actorRole,
  editable = true,
  shareToken,
}: {
  task: RoleTask;
  requirement: Requirement;
  projectId: string;
  actorName: string;
  actorRole?: string;
  editable?: boolean;
  shareToken?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState(task.notes ?? "");
  const [blocker, setBlocker] = useState(task.blocker_reason ?? "");

  function onStatusChange(status: TaskStatus) {
    startTransition(async () => {
      await updateTaskStatusAction({
        taskId: task.id,
        status,
        actorName,
        actorRole,
        projectId,
        blockerReason: status === "blocked" ? blocker : undefined,
        shareToken,
      });
    });
  }

  function onSaveNotes() {
    startTransition(async () => {
      await saveRoleTaskAction({
        taskId: task.id,
        updates: { notes, blocker_reason: blocker || null },
        actorName,
        actorRole,
        projectId,
        shareToken,
      });
    });
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-slate-500">
            {ROLE_LABELS[task.role]}
            {task.assignee ? ` · ${task.assignee}` : ""}
          </div>
          <div className="mt-1 font-medium text-slate-900">{requirement.title}</div>
        </div>
        <StatusBadge status={task.status} />
      </div>

      {(task.estimate_hours != null || task.progress_percent != null) && (
        <div className="flex gap-4 text-sm text-slate-600">
          {task.estimate_hours != null ? <span>预估 {task.estimate_hours}h</span> : null}
          {task.progress_percent != null ? (
            <span>进度 {task.progress_percent}%</span>
          ) : null}
        </div>
      )}

      {editable ? (
        <>
          <div className="flex flex-wrap gap-2">
            {TASK_STATUS_FLOW.concat(["blocked"] as TaskStatus[]).map((status) => (
              <button
                key={status}
                type="button"
                disabled={pending}
                onClick={() => onStatusChange(status)}
                className={`rounded-md border px-2 py-1 text-xs ${
                  task.status === status
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {TASK_STATUS_LABELS[status]}
              </button>
            ))}
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="完成说明 / 备注"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            rows={2}
          />
          {task.status === "blocked" || blocker ? (
            <input
              value={blocker}
              onChange={(e) => setBlocker(e.target.value)}
              placeholder="阻塞原因"
              className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm"
            />
          ) : null}
          <button
            type="button"
            disabled={pending}
            onClick={onSaveNotes}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            保存
          </button>
        </>
      ) : null}
    </div>
  );
}

export function KanbanBoard({
  requirements,
  tasks,
  projectId,
  actorName,
  actorRole,
  roleFilter,
  shareToken,
}: {
  requirements: Requirement[];
  tasks: RoleTask[];
  projectId: string;
  actorName: string;
  actorRole?: string;
  roleFilter?: string;
  shareToken?: string;
}) {
  const filteredTasks = roleFilter
    ? tasks.filter((t) => t.role === roleFilter)
    : tasks;

  const columns: TaskStatus[] = [
    "pending",
    "in_progress",
    "integration",
    "testing",
    "acceptance",
    "done",
    "blocked",
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-7 md:grid-cols-3">
      {columns.map((status) => {
        const columnTasks = filteredTasks.filter((t) => t.status === status);
        return (
          <div key={status} className="min-w-[220px]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">
                {TASK_STATUS_LABELS[status]}
              </h3>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {columnTasks.length}
              </span>
            </div>
            <div className="space-y-3">
              {columnTasks.map((task) => {
                const req = requirements.find((r) => r.id === task.requirement_id);
                if (!req) return null;
                return (
                  <TaskCard
                    key={task.id}
                    task={task}
                    requirement={req}
                    projectId={projectId}
                    actorName={actorName}
                    actorRole={actorRole}
                    shareToken={shareToken}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
