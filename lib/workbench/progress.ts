import { getProjects, getProjectBundle } from "@/lib/db/local-store";
import { getStudioSnapshot } from "@/lib/studio/store";
import { TASK_STATUS_LABELS as STUDIO_TASK_STATUS_LABELS } from "@/lib/studio/types";
import {
  ROLE_LABELS,
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

/** Studio project id → PM slug（与 project-bridge 保持一致） */
const STUDIO_TO_PM_SLUG: Record<string, string> = {
  "proj-ai-pet": "ai-pet",
  "proj-ai-controller": "ai-controller",
  "proj-star-pm": "star-pm",
  "proj-c84ff6fa": "yoking-pump",
  "proj-star-lab-os": "star-lab-os",
  "proj-personal-tools": "personal-tools",
};

const PM_SLUG_TO_STUDIO: Record<string, string> = Object.fromEntries(
  Object.entries(STUDIO_TO_PM_SLUG).map(([studioId, slug]) => [slug, studioId])
);

function routeIdForPmSlug(slug: string): string {
  return PM_SLUG_TO_STUDIO[slug] ?? slug;
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

/**
 * 各项目进行中的需求：
 * - PM：已入迭代（非池）且 status ∈ 开发中/待联调/待测试/待验收
 * - Studio：任务 status = in_progress
 */
export async function getActiveRequirementsAcrossProjects(): Promise<ActiveWorkGroup[]> {
  const studioSnap = await getStudioSnapshot();
  const studioById = new Map(studioSnap.projects.map((p) => [p.id, p]));
  const items: ActiveWorkItem[] = [];

  const pmProjects = await getProjects();
  await Promise.all(
    pmProjects.map(async (pmProject) => {
      const bundle = await getProjectBundle(pmProject.id);
      if (!bundle) return;
      const routeId = routeIdForPmSlug(pmProject.slug);
      const projectTitle =
        studioById.get(routeId)?.title ?? pmProject.name;

      for (const req of bundle.requirements) {
        if (req.in_pool) continue;
        if (!ACTIVE_PM_STATUSES.has(req.status)) continue;
        items.push({
          id: req.id,
          title: req.title,
          status: req.status,
          statusLabel: PM_TASK_STATUS_LABELS[req.status],
          priority: req.priority,
          source: "pm",
          projectId: routeId,
          projectTitle,
          href: `/projects/${routeId}/tasks?req=${req.id}`,
        });
      }
    })
  );

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

/** 近 N 天已完成：PM role_tasks + Studio tasks */
export async function getRecentlyCompletedWork(
  limit = 20,
  days = 14
): Promise<CompletedWorkItem[]> {
  const since = daysAgoIso(days);
  const studioSnap = await getStudioSnapshot();
  const studioById = new Map(studioSnap.projects.map((p) => [p.id, p]));
  const items: CompletedWorkItem[] = [];

  const pmProjects = await getProjects();
  await Promise.all(
    pmProjects.map(async (pmProject) => {
      const bundle = await getProjectBundle(pmProject.id);
      if (!bundle) return;
      const routeId = routeIdForPmSlug(pmProject.slug);
      const projectTitle = studioById.get(routeId)?.title ?? pmProject.name;
      const reqTitle = new Map(bundle.requirements.map((r) => [r.id, r.title]));

      for (const task of bundle.role_tasks) {
        if (task.status !== "done") continue;
        const completedAt = task.updated_at;
        if (completedAt < since) continue;
        const parentTitle = reqTitle.get(task.requirement_id);
        items.push({
          id: task.id,
          title: parentTitle
            ? `${parentTitle} · ${ROLE_LABELS[task.role]}`
            : ROLE_LABELS[task.role],

          source: "pm",
          projectId: routeId,
          projectTitle,
          completedAt,
          href: `/projects/${routeId}/tasks?req=${task.requirement_id}`,
        });
      }
    })
  );

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
