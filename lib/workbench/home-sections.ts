/**
 * 工作台首页分段数据：每段单独可请求，避免一次 SSR 把全页塞进 Worker。
 */
import { getScopedWorkbenchStudioSnapshot } from "@/lib/demo/ensure-showcase";
import { buildStarMapLayout, type StarMapLayout } from "@/lib/studio/idea-star-map";
import { buildImprovementCalendar, type ImprovementDayBucket } from "@/lib/studio/improvement-calendar";
import type { Project, StudioTask } from "@/lib/studio/types";
import { PROJECT_STATUS_LABELS } from "@/lib/studio/types";
import {
  filterTomorrowDueOnly,
  getOpenBugsAcrossProjects,
  getPmAcceptanceQueue,
  getPmFollowUps,
  type PmAcceptanceBundle,
  type PmAcceptanceItem,
  type PmFollowUpItem,
  type PmOpenBugItem,
} from "@/lib/workbench/pm-inbox";
import { getSuggestedMainline, type MainlineSuggestion } from "@/lib/workbench/mainline-score";
import { getTomorrowAgenda, type TomorrowAgendaItem } from "@/lib/workbench/tomorrow-agenda";
import { runWithDurableReadMemo } from "@/lib/runtime/durable-read-memo";

export type WorkbenchHomePart = "hero" | "today" | "library" | "star";

export type WorkbenchBlockerItem = {
  taskId: string;
  title: string;
  blocker: string;
  projectId: string;
  projectTitle: string;
};

export type WorkbenchHeroPayload = {
  focus: { project: Project; task: StudioTask | null } | null;
  suggestedMainline: MainlineSuggestion | null;
  nextActionDrafts: Record<string, string>;
  inboxCount: number;
  acceptanceBundleCount: number;
  acceptanceItemCount: number;
  openBugCount: number;
  followUpCount: number;
  blockers: WorkbenchBlockerItem[];
  statusLabels: typeof PROJECT_STATUS_LABELS;
};

export type WorkbenchTodayPayload = {
  acceptance: PmAcceptanceItem[];
  acceptanceBundles: PmAcceptanceBundle[];
  followUps: PmFollowUpItem[];
  openBugs: PmOpenBugItem[];
  lookbackDays: number;
  todayDay: string;
  tomorrowDay: string;
  tomorrowItems: TomorrowAgendaItem[];
};

export type WorkbenchLibraryPayload = {
  projects: Project[];
  nextActionDrafts: Record<string, string>;
  captureProjects: Array<{ id: string; label: string }>;
};

export type WorkbenchStarPayload = {
  layout: StarMapLayout;
  improvementByDay: Record<string, ImprovementDayBucket>;
};

function nextActionDraftsFromTasks(tasks: StudioTask[]): Record<string, string> {
  const rank: Record<string, number> = { in_progress: 0, todo: 1, paused: 2 };
  const drafts: Record<string, string> = {};
  const open = [...tasks]
    .filter((t) => t.status !== "done" && t.title.trim())
    .sort((a, b) => {
      const ra = rank[a.status] ?? 9;
      const rb = rank[b.status] ?? 9;
      if (ra !== rb) return ra - rb;
      return b.id.localeCompare(a.id);
    });
  for (const t of open) {
    if (!drafts[t.projectId]) drafts[t.projectId] = t.title.trim();
  }
  return drafts;
}

export async function loadWorkbenchHero(): Promise<WorkbenchHeroPayload> {
  return runWithDurableReadMemo(async () => {
    const [suggestedMainline, studioSnap, acceptanceQueue, followUps, openBugs] =
      await Promise.all([
        getSuggestedMainline(),
        getScopedWorkbenchStudioSnapshot(),
        getPmAcceptanceQueue(),
        getPmFollowUps(),
        getOpenBugsAcrossProjects(),
      ]);

    const projectTitleById = new Map(studioSnap.projects.map((p) => [p.id, p.title]));
    const drafts = nextActionDraftsFromTasks(studioSnap.tasks);
    const blockers = studioSnap.tasks
      .filter((t) => t.blocker && t.status !== "done")
      .map((t) => ({
        taskId: t.id,
        title: t.title,
        blocker: t.blocker?.trim() || "",
        projectId: t.projectId,
        projectTitle: projectTitleById.get(t.projectId) ?? "未知项目",
      }));

    return {
      focus: suggestedMainline
        ? { project: suggestedMainline.project, task: suggestedMainline.focusTask }
        : null,
      suggestedMainline,
      nextActionDrafts: drafts,
      inboxCount: studioSnap.ideas.filter((i) => i.status === "inbox").length,
      acceptanceBundleCount: acceptanceQueue.bundles.length,
      acceptanceItemCount: acceptanceQueue.items.length,
      openBugCount: openBugs.length,
      followUpCount: followUps.items.length,
      blockers,
      statusLabels: PROJECT_STATUS_LABELS,
    };
  });
}

export async function loadWorkbenchToday(): Promise<WorkbenchTodayPayload> {
  return runWithDurableReadMemo(async () => {
    const [tomorrowAgenda, acceptanceQueue, followUps, openBugs] = await Promise.all([
      getTomorrowAgenda(),
      getPmAcceptanceQueue(),
      getPmFollowUps(),
      getOpenBugsAcrossProjects(),
    ]);
    return {
      acceptance: acceptanceQueue.items,
      acceptanceBundles: acceptanceQueue.bundles,
      followUps: followUps.items,
      openBugs,
      lookbackDays: acceptanceQueue.lookbackDays,
      todayDay: tomorrowAgenda.todayDay,
      tomorrowDay: tomorrowAgenda.tomorrowDay,
      tomorrowItems: filterTomorrowDueOnly(tomorrowAgenda.items),
    };
  });
}

export async function loadWorkbenchLibrary(): Promise<WorkbenchLibraryPayload> {
  return runWithDurableReadMemo(async () => {
    const studioSnap = await getScopedWorkbenchStudioSnapshot();
    const drafts = nextActionDraftsFromTasks(studioSnap.tasks);
    const projects = studioSnap.projects.filter((p) => p.status !== "archived");
    return {
      projects,
      nextActionDrafts: drafts,
      captureProjects: studioSnap.projects.map((p) => ({ id: p.id, label: p.title })),
    };
  });
}

export async function loadWorkbenchStar(): Promise<WorkbenchStarPayload> {
  return runWithDurableReadMemo(async () => {
    const [studioSnap, acceptanceQueue] = await Promise.all([
      getScopedWorkbenchStudioSnapshot(),
      getPmAcceptanceQueue(),
    ]);
    const projectTitleById = new Map(studioSnap.projects.map((p) => [p.id, p.title]));
    const improvementByDayMap = buildImprovementCalendar({
      evolution: studioSnap.evolutionLogs,
      changeSessions: studioSnap.changeSessions ?? [],
      projectTitleById,
    });
    const improvementByDay = Object.fromEntries(improvementByDayMap);
    const layout = buildStarMapLayout(studioSnap.ideas, studioSnap.projects, {
      acceptanceCount: acceptanceQueue.items.length,
      latestImproveDay: Object.keys(improvementByDay).sort().reverse()[0] ?? null,
      changeSessions: studioSnap.changeSessions ?? [],
      evolution: studioSnap.evolutionLogs,
    });
    return { layout, improvementByDay };
  });
}

export async function loadWorkbenchHomePart(part: WorkbenchHomePart) {
  switch (part) {
    case "hero":
      return { part, data: await loadWorkbenchHero() };
    case "today":
      return { part, data: await loadWorkbenchToday() };
    case "library":
      return { part, data: await loadWorkbenchLibrary() };
    case "star":
      return { part, data: await loadWorkbenchStar() };
    default:
      throw new Error(`unknown workbench part: ${part}`);
  }
}
