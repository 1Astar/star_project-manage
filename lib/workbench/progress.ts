import { readWorkbenchDb, getProjects } from "@/lib/db/local-store";
import { getScopedStudioSnapshot } from "@/lib/demo/ensure-showcase";
import { getStudioIdFromPmSlug } from "@/lib/project-bridge";
import { TASK_STATUS_LABELS as STUDIO_TASK_STATUS_LABELS } from "@/lib/studio/types";
import {
  TASK_STATUS_LABELS as PM_TASK_STATUS_LABELS,
  type TaskStatus as PmTaskStatus,
} from "@/lib/types";

export type WorkItemSource = "pm" | "studio";

export type ActiveWorkItem = {
  id: string;
  title: string;
  status: string;
  statusLabel: string;
  priority: string | null;
  source: WorkItemSource;
  projectId: string;
  projectTitle: string;
  href: string;
};

export type CompletedWorkItem = {
  id: string;
  title: string;
  source: WorkItemSource;
  projectId: string;
  projectTitle: string;
  completedAt: string;
  href: string;
};

export type ActiveWorkGroup = {
  projectId: string;
  projectTitle: string;
  items: ActiveWorkItem[];
};

const ACTIVE_PM_STATUSES = new Set<PmTaskStatus>([
  "in_progress",
  "integration",
  "testing",
  "acceptance",
]);

function routeIdForPmSlug(slug: string): string {
  return getStudioIdFromPmSlug(slug) ?? slug;
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

/**
 * 各项目进行中的需求：
 * 用 readWorkbenchDb（裁剪列 + 近期/待验切片），禁止对每个项目 getProjectBundle。
 */
export async function getActiveRequirementsAcrossProjects(): Promise<ActiveWorkGroup[]> {
  const studioSnap = await getScopedStudioSnapshot();
  const studioById = new Map(studioSnap.projects.map((p) => [p.id, p]));
  const items: ActiveWorkItem[] = [];

  const [wb, pmProjects] = await Promise.all([readWorkbenchDb(), getProjects()]);
  const pmById = new Map(pmProjects.map((p) => [p.id, p]));

  for (const req of wb.requirements) {
    if (req.in_pool) continue;
    if (!ACTIVE_PM_STATUSES.has(req.status)) continue;
    const pmProject = pmById.get(req.project_id);
    if (!pmProject) continue;
    const routeId = routeIdForPmSlug(pmProject.slug);
    const projectTitle = studioById.get(routeId)?.title ?? pmProject.name;
    items.push({
      id: req.id,
      title: req.title,
      status: req.status,
      statusLabel: PM_TASK_STATUS_LABELS[req.status] ?? req.status,
      priority: req.priority,
      source: "pm",
      projectId: routeId,
      projectTitle,
      href: `/projects/${routeId}/tasks?req=${req.id}`,
    });
  }

  for (const task of studioSnap.tasks) {
    if (task.status !== "in_progress") continue;
    const project = studioById.get(task.projectId);
    if (!project || project.status === "archived") continue;
    items.push({
      id: task.id,
      title: task.title,
      status: task.status,
      statusLabel: STUDIO_TASK_STATUS_LABELS[task.status],
      priority: task.priority,
      source: "studio",
      projectId: project.id,
      projectTitle: project.title,
      href: `/projects/${project.id}/tasks`,
    });
  }

  const groupMap = new Map<string, ActiveWorkGroup>();
  for (const item of items) {
    const existing = groupMap.get(item.projectId);
    if (existing) {
      existing.items.push(item);
    } else {
      groupMap.set(item.projectId, {
        projectId: item.projectId,
        projectTitle: item.projectTitle,
        items: [item],
      });
    }
  }

  const priorityRank = (p: string | null) => {
    if (p === "P0") return 0;
    if (p === "P1") return 1;
    if (p === "P2") return 2;
    return 3;
  };

  for (const group of groupMap.values()) {
    group.items.sort(
      (a, b) =>
        priorityRank(a.priority) - priorityRank(b.priority) ||
        a.title.localeCompare(b.title, "zh-CN")
    );
  }

  return [...groupMap.values()].sort((a, b) =>
    a.projectTitle.localeCompare(b.projectTitle, "zh-CN")
  );
}

/** 近 N 天已完成：优先 Studio；PM 侧用工作台切片需求 completed_at（不再扫全板 role_tasks） */
export async function getRecentlyCompletedWork(
  limit = 20,
  days = 14
): Promise<CompletedWorkItem[]> {
  const since = daysAgoIso(days);
  const studioSnap = await getScopedStudioSnapshot();
  const studioById = new Map(studioSnap.projects.map((p) => [p.id, p]));
  const items: CompletedWorkItem[] = [];

  const [wb, pmProjects] = await Promise.all([readWorkbenchDb(), getProjects()]);
  const pmById = new Map(pmProjects.map((p) => [p.id, p]));

  for (const req of wb.requirements) {
    const completedAt = req.completed_at;
    if (!completedAt || completedAt < since) continue;
    const pmProject = pmById.get(req.project_id);
    if (!pmProject) continue;
    const routeId = routeIdForPmSlug(pmProject.slug);
    items.push({
      id: req.id,
      title: req.title,
      source: "pm",
      projectId: routeId,
      projectTitle: studioById.get(routeId)?.title ?? pmProject.name,
      completedAt,
      href: `/projects/${routeId}/tasks?req=${req.id}`,
    });
  }

  for (const task of studioSnap.tasks) {
    if (task.status !== "done") continue;
    const when = task.completedAt;
    if (!when || when < since) continue;
    const project = studioById.get(task.projectId);
    if (!project) continue;
    items.push({
      id: task.id,
      title: task.title,
      source: "studio",
      projectId: project.id,
      projectTitle: project.title,
      completedAt: when,
      href: `/projects/${project.id}/tasks`,
    });
  }

  items.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  return items.slice(0, limit);
}

/** 近 N 天完成的需求：工作台切片 + 本地/Supabase 轻量，禁止每项目双 bundle */
export async function getCompletedRequirementsForCalendar(
  days = 60
): Promise<
  Array<{
    id: string;
    title: string;
    projectId: string;
    projectTitle: string;
    completedAt: string;
  }>
> {
  const since = daysAgoIso(days);
  const studioSnap = await getScopedStudioSnapshot();
  const studioById = new Map(studioSnap.projects.map((p) => [p.id, p]));
  const out: Array<{
    id: string;
    title: string;
    projectId: string;
    projectTitle: string;
    completedAt: string;
  }> = [];

  const [wb, pmProjects] = await Promise.all([readWorkbenchDb(), getProjects()]);
  const pmById = new Map(pmProjects.map((p) => [p.id, p]));

  for (const req of wb.requirements) {
    const completedAt = req.completed_at;
    if (!completedAt || completedAt < since) continue;
    const pmProject = pmById.get(req.project_id);
    if (!pmProject) continue;
    const routeId = routeIdForPmSlug(pmProject.slug);
    out.push({
      id: req.id,
      title: req.title,
      projectId: routeId,
      projectTitle: studioById.get(routeId)?.title ?? pmProject.name,
      completedAt,
    });
  }

  out.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  return out;
}
