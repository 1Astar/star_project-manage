/**
 * 工作台「当前主线」算法：今日压力 / 近期活动 / Git 热度打分，取最高。
 * 项目库 status=mainline 视为「钉主线」强加权，不是唯一来源。
 * Git：用项目 lastCommitAt（及兜底 lastGitSyncedAt），不现场打 GitHub。
 */
import { getScopedWorkbenchStudioSnapshot } from "@/lib/demo/ensure-showcase";
import { memoizeDurableRead } from "@/lib/runtime/durable-read-memo";
import type { Project, StudioTask } from "@/lib/studio/types";
import {
  getOpenBugsAcrossProjects,
  getPmAcceptanceQueue,
  getPmFollowUps,
} from "@/lib/workbench/pm-inbox";

function shanghaiDay(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function addShanghaiDays(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00+08:00`);
  d.setDate(d.getDate() + delta);
  return shanghaiDay(d.toISOString());
}

function withinDays(iso: string | null | undefined, todayDay: string, days: number): boolean {
  if (!iso) return false;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : shanghaiDay(iso);
  const oldest = addShanghaiDays(todayDay, -(days - 1));
  return day >= oldest && day <= todayDay;
}

export type MainlineScoreBreakdown = {
  label: string;
  points: number;
};

export type MainlineSuggestion = {
  project: Project;
  score: number;
  reasons: string[];
  pinned: boolean;
  focusTask: StudioTask | null;
};

function pickFocusTask(tasks: StudioTask[], projectId: string): StudioTask | null {
  return (
    tasks.find((t) => t.projectId === projectId && t.status === "in_progress") ??
    tasks.find((t) => t.projectId === projectId && t.status !== "done") ??
    null
  );
}

/** 用于热度比较的时间戳：优先最近一次 commit，其次 Git 同步 */
function gitHeatAt(project: Project): string | null {
  return project.lastCommitAt?.trim() || project.lastGitSyncedAt?.trim() || null;
}

function pushGitHeat(
  breakdown: MainlineScoreBreakdown[],
  project: Project,
  todayDay: string,
  hottestAt: string | null
) {
  const commitAt = project.lastCommitAt?.trim() || null;
  const syncedAt = project.lastGitSyncedAt?.trim() || null;
  const heatAt = commitAt || syncedAt;

  if (commitAt) {
    if (withinDays(commitAt, todayDay, 1)) {
      breakdown.push({ label: "今日有提交", points: 40 });
    } else if (withinDays(commitAt, todayDay, 3)) {
      breakdown.push({ label: "近3日有提交", points: 25 });
    } else if (withinDays(commitAt, todayDay, 7)) {
      breakdown.push({ label: "近7日有提交", points: 12 });
    }
  } else if (syncedAt && withinDays(syncedAt, todayDay, 2)) {
    breakdown.push({ label: "近2日Git同步", points: 10 });
  }

  // 候选里最近一次 Git 活动最新的项目再加一档（相对热度）
  if (heatAt && hottestAt && heatAt === hottestAt) {
    breakdown.push({ label: "Git最热", points: 22 });
  }
}

export async function getSuggestedMainline(): Promise<MainlineSuggestion | null> {
  return memoizeDurableRead("mainline", loadSuggestedMainline);
}

async function loadSuggestedMainline(): Promise<MainlineSuggestion | null> {
  const todayDay = shanghaiDay();
  const [{ projects, tasks, evolutionLogs, changeSessions }, acceptance, followUps, openBugs] =
    await Promise.all([
      getScopedWorkbenchStudioSnapshot(),
      getPmAcceptanceQueue({ todayDay }),
      getPmFollowUps({ todayDay }),
      getOpenBugsAcrossProjects(),
    ]);

  const candidates = projects.filter(
    (p) => p.status !== "archived" && p.status !== "parking"
  );
  if (candidates.length === 0) return null;

  // 候选里 Git 活动最新的时间戳（相对「Git最热」）
  let hottestAt: string | null = null;
  for (const p of candidates) {
    const at = gitHeatAt(p);
    if (at && (!hottestAt || at > hottestAt)) hottestAt = at;
  }

  let best: MainlineSuggestion | null = null;

  for (const project of candidates) {
    const breakdown: MainlineScoreBreakdown[] = [];
    const pinned = project.status === "mainline";
    if (pinned) breakdown.push({ label: "钉主线", points: 80 });

    const accN = acceptance.items.filter((i) => i.projectId === project.id).length;
    if (accN > 0) {
      const n = Math.min(accN, 3);
      breakdown.push({ label: `待验收×${accN}`, points: 35 * n });
    }

    const bugN = openBugs.filter((b) => b.projectId === project.id).length;
    if (bugN > 0) {
      const n = Math.min(bugN, 3);
      breakdown.push({ label: `未关Bug×${bugN}`, points: 30 * n });
    }

    const followN = followUps.items.filter((f) => f.projectId === project.id).length;
    if (followN > 0) {
      const n = Math.min(followN, 3);
      breakdown.push({ label: `跟进×${followN}`, points: 25 * n });
    }

    const blockers = tasks.filter(
      (t) => t.projectId === project.id && t.blocker?.trim() && t.status !== "done"
    ).length;
    if (blockers > 0) {
      breakdown.push({ label: `阻塞×${blockers}`, points: 40 * Math.min(blockers, 2) });
    }

    const recentSession = (changeSessions ?? []).some(
      (c) =>
        c.projectId === project.id &&
        (withinDays(c.finishedAt || c.updatedAt || c.createdAt, todayDay, 2) ||
          withinDays(`${c.day}T12:00:00+08:00`, todayDay, 2))
    );
    if (recentSession) breakdown.push({ label: "近2日变更会话", points: 20 });

    const recentEvo = (evolutionLogs ?? []).some(
      (e) => e.projectId === project.id && withinDays(e.createdAt, todayDay, 2)
    );
    if (recentEvo) breakdown.push({ label: "近2日演进", points: 15 });

    pushGitHeat(breakdown, project, todayDay, hottestAt);

    const inProgress = tasks.some(
      (t) => t.projectId === project.id && t.status === "in_progress"
    );
    if (inProgress) breakdown.push({ label: "有进行中任务", points: 25 });

    if (project.priority === "P0") breakdown.push({ label: "项目P0", points: 15 });
    if (project.priority === "P1") breakdown.push({ label: "项目P1", points: 8 });

    const next = project.nextAction?.trim() || project.body?.nextStep?.trim() || "";
    if (next) breakdown.push({ label: "已写下一步", points: 10 });

    const score = breakdown.reduce((s, b) => s + b.points, 0);
    const reasons = breakdown
      .sort((a, b) => b.points - a.points)
      .slice(0, 3)
      .map((b) => b.label);

    const candidate: MainlineSuggestion = {
      project,
      score,
      reasons,
      pinned,
      focusTask: pickFocusTask(tasks, project.id),
    };

    if (!best || candidate.score > best.score) {
      best = candidate;
    } else if (candidate.score === best.score) {
      const a = gitHeatAt(candidate.project) ?? candidate.project.updatedAt;
      const b = gitHeatAt(best.project) ?? best.project.updatedAt;
      if (a > b) best = candidate;
    }
  }

  // 全员 0 分时：优先钉主线，否则 Git 最近，再否则项目更新时间
  if (best && best.score === 0) {
    const pinned = candidates.find((p) => p.status === "mainline");
    const byGit = [...candidates].sort((a, b) => {
      const ga = gitHeatAt(a) ?? "";
      const gb = gitHeatAt(b) ?? "";
      if (ga !== gb) return gb.localeCompare(ga);
      return b.updatedAt.localeCompare(a.updatedAt);
    })[0]!;
    const fallback = pinned ?? byGit;
    return {
      project: fallback,
      score: pinned ? 80 : 0,
      reasons: pinned ? ["钉主线"] : gitHeatAt(fallback) ? ["Git最近"] : ["最近更新"],
      pinned: fallback.status === "mainline",
      focusTask: pickFocusTask(tasks, fallback.id),
    };
  }

  return best;
}
