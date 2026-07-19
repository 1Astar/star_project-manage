"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IterationPlanPanel } from "@/components/iteration-plan-panel";
import { KanbanBoard } from "@/components/task-board";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { RequirementPoolSplitView } from "@/components/requirement-pool-split-view";
import type { TimelineEntity } from "@/components/requirement-memory-timeline";
import { RequirementStatusKanban } from "@/components/requirement-status-kanban";
import { RequirementCalendar } from "@/components/requirement-calendar";
import { RequirementGantt } from "@/components/requirement-gantt";
import { ProjectTaskBoard } from "@/components/studio/project-task-board";
import { cn } from "@/lib/utils";
import type {
  Iteration,
  PoolColumnDef,
  ProjectMember,
  Requirement,
  RequirementAttachment,
  RequirementLink,
  RoleTask,
} from "@/lib/types";
import type { StudioRelease, StudioTask } from "@/lib/studio/types";

type ViewMode = "pool" | "req-kanban" | "calendar" | "gantt" | "kanban" | "studio";

export function ProjectTasksViews({
  routeId,
  projectId,
  poolRequirements,
  activeIterations,
  columnDefs,
  tagOptions,
  attachments,
  members,
  boardRequirements,
  boardTasks,
  syncInfo,
  links,
  timelineEntities,
  studioProjectId,
  studioTasks,
  studioHasGitHub,
  studioReleases,
}: {
  routeId: string;
  projectId: string;
  projectSlug: string;
  poolRequirements: Requirement[];
  poolModules?: unknown;
  activeIterations: Iteration[];
  columnDefs?: PoolColumnDef[];
  tagOptions?: string[];
  attachments: RequirementAttachment[];
  members: ProjectMember[];
  boardRequirements: Requirement[];
  boardTasks: RoleTask[];
  links?: RequirementLink[];
  timelineEntities?: TimelineEntity[];
  syncInfo?: {
    created: number;
    ideaSourceCount: number;
    evolutionSourceCount: number;
    skippedExisting: number;
    errors: string[];
    projectFound: boolean;
  } | null;
  studioProjectId?: string | null;
  studioTasks?: StudioTask[];
  studioHasGitHub?: boolean;
  studioReleases?: StudioRelease[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");
  const hasStudio = Boolean(studioProjectId);
  const view: ViewMode =
    viewParam === "req-kanban" || viewParam === "board"
      ? "req-kanban"
      : viewParam === "calendar"
        ? "calendar"
        : viewParam === "gantt"
          ? "gantt"
          : viewParam === "kanban"
            ? "kanban"
            : viewParam === "studio" && hasStudio
              ? "studio"
              : "pool";
  const reqId = searchParams.get("req");

  const ganttReqs = useMemo(() => {
    const map = new Map<string, Requirement>();
    for (const r of poolRequirements) map.set(r.id, r);
    for (const r of boardRequirements) map.set(r.id, r);
    return [...map.values()];
  }, [poolRequirements, boardRequirements]);

  function setView(next: ViewMode) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "pool") params.delete("view");
    else params.set("view", next);
    if (next !== "pool") params.delete("req");
    const qs = params.toString();
    router.push(qs ? `/projects/${routeId}/tasks?${qs}` : `/projects/${routeId}/tasks`);
  }

  function openReq(id: string) {
    const params = new URLSearchParams();
    params.set("req", id);
    router.push(`/projects/${routeId}/tasks?${params.toString()}`);
  }

  const tabs = (
    [
      { id: "pool" as const, label: "需求表" },
      { id: "req-kanban" as const, label: "需求看板" },
      { id: "calendar" as const, label: "日历" },
      { id: "gantt" as const, label: "甘特" },
      { id: "kanban" as const, label: "任务看板" },
      ...(hasStudio ? [{ id: "studio" as const, label: "Studio 任务" }] : []),
    ] as const
  );

  return (
    <div className="space-y-4">
      {syncInfo ? (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            syncInfo.errors.length
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-slate-200 bg-slate-50 text-slate-600"
          )}
        >
          <p>
            灵感同步：关联灵感 {syncInfo.ideaSourceCount} 条 · 演进{" "}
            {syncInfo.evolutionSourceCount} 条 → 本次新建 {syncInfo.created} · 已存在跳过{" "}
            {syncInfo.skippedExisting}
          </p>
          {syncInfo.ideaSourceCount === 0 && syncInfo.evolutionSourceCount === 0 ? (
            <p className="mt-1 text-xs">
              库里没有「关联到本项目」的灵感。去侧栏「灵感流」新建时选关联项目，或在灵感上补关联，再刷新本页。
            </p>
          ) : null}
          {syncInfo.errors[0] ? (
            <p className="mt-1 text-xs text-amber-800">失败：{syncInfo.errors[0]}</p>
          ) : null}
        </div>
      ) : null}

      <IterationPlanPanel
        projectId={projectId}
        projectSlug={routeId}
        iterations={activeIterations}
        requirements={[...poolRequirements, ...boardRequirements]}
        releases={studioReleases ?? []}
      />

      <div className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-slate-50 p-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setView(item.id)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium transition",
              view === item.id
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-800"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {view === "pool" ? (
        <RequirementPoolSplitView
          projectId={projectId}
          projectSlug={routeId}
          requirements={poolRequirements}
          activeIterations={activeIterations}
          attachments={attachments}
          members={members}
          columnDefs={columnDefs ?? []}
          tagOptions={tagOptions ?? []}
          links={links ?? []}
          timelineEntities={timelineEntities ?? []}
          initialReqId={reqId}
        />
      ) : null}

      {view === "req-kanban" ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <RequirementStatusKanban
            projectSlug={routeId}
            requirements={poolRequirements}
            onOpen={openReq}
          />
        </div>
      ) : null}

      {view === "calendar" ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <RequirementCalendar requirements={poolRequirements} onOpen={openReq} />
        </div>
      ) : null}

      {view === "gantt" ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <RequirementGantt
            projectSlug={routeId}
            requirements={ganttReqs}
            onOpen={openReq}
          />
        </div>
      ) : null}

      {view === "kanban" ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-4 text-xs text-slate-500">
            任务看板 · 按角色任务进程分列（可选拆分）
          </p>
          <RealtimeRefresh />
          <KanbanBoard
            requirements={boardRequirements}
            tasks={boardTasks}
            projectId={projectId}
            actorName="产品"
            actorRole="admin"
            detailBasePath={`/projects/${routeId}`}
          />
        </div>
      ) : null}

      {view === "studio" && studioProjectId ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <ProjectTaskBoard
            projectId={studioProjectId}
            tasks={studioTasks ?? []}
            hasGitHub={!!studioHasGitHub}
          />
        </div>
      ) : null}
    </div>
  );
}
