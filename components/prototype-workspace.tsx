"use client";

import { useMemo, useState } from "react";
import { KanbanBoard } from "@/components/task-board";
import type { Prototype, Requirement, RoleTask } from "@/lib/types";

export function PrototypeWorkspace({
  projectId,
  projectSlug,
  requirements,
  tasks,
  prototypes,
}: {
  projectId: string;
  projectSlug: string;
  requirements: Requirement[];
  tasks: RoleTask[];
  prototypes: Prototype[];
}) {
  const [selectedReqId, setSelectedReqId] = useState(requirements[0]?.id ?? "");
  const selectedReq = requirements.find((r) => r.id === selectedReqId);
  const prototype = prototypes.find((p) => p.requirement_id === selectedReqId) ?? prototypes[0];

  const sidebarTasks = useMemo(
    () => tasks.filter((t) => t.requirement_id === selectedReqId),
    [tasks, selectedReqId]
  );

  return (
    <div className="grid min-h-[70vh] gap-4 lg:grid-cols-[1.4fr_1fr]">
      <section className="card overflow-hidden">
        <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium">
          原型预览
          {prototype?.external_url ? (
            <a
              href={prototype.external_url}
              target="_blank"
              rel="noreferrer"
              className="ml-3 text-blue-600"
            >
              在新窗口打开
            </a>
          ) : null}
        </div>
        <div className="flex h-[calc(70vh-48px)] items-center justify-center bg-slate-100 p-6">
          {prototype?.external_url ? (
            <iframe
              title="prototype"
              src={prototype.external_url}
              sandbox="allow-scripts allow-same-origin"
              className="h-full w-full rounded-lg border border-slate-200 bg-white"
            />
          ) : prototype?.storage_path ? (
            <iframe
              title="prototype"
              src={prototype.storage_path}
              sandbox="allow-scripts allow-same-origin"
              className="h-full w-full rounded-lg border border-slate-200 bg-white"
            />
          ) : (
            <div className="max-w-md text-center text-sm text-slate-500">
              <p>尚未上传 HTML 原型或关联外链。</p>
              <p className="mt-2">
                可在
                <a href={`/projects/${projectSlug}/settings`} className="text-blue-600">
                  项目设置
                </a>
                中上传 ZIP 或填写 Figma / 网页链接。
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div className="card p-4">
          <label className="text-sm font-medium text-slate-700">绑定需求</label>
          <select
            value={selectedReqId}
            onChange={(e) => setSelectedReqId(e.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {requirements.map((req) => (
              <option key={req.id} value={req.id}>
                {req.title}
              </option>
            ))}
          </select>
          {selectedReq?.acceptance_criteria ? (
            <p className="mt-3 text-sm text-slate-600">{selectedReq.acceptance_criteria}</p>
          ) : null}
        </div>

        <div className="space-y-3">
          {sidebarTasks.length > 0 ? (
            <KanbanBoard
              requirements={requirements.filter((r) => r.id === selectedReqId)}
              tasks={sidebarTasks}
              projectId={projectId}
              actorName="开发"
            />
          ) : (
            <div className="card p-4 text-sm text-slate-500">该需求暂无角色任务</div>
          )}
        </div>
      </section>
    </div>
  );
}
