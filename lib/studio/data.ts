import { getScopedStudioSnapshot } from "@/lib/demo/ensure-showcase";
import {
  getStudioProjectBundle,
  getStudioProjectRow,
} from "@/lib/studio/project-scoped-read";
import type { Idea } from "@/lib/studio/types";

export async function getStudioData() {
  return getScopedStudioSnapshot();
}

export async function getAllProjects() {
  const { projects } = await getScopedStudioSnapshot();
  return projects;
}

export async function getProjectColumnDefs(activeOnly = true) {
  const { projectColumnDefs } = await getScopedStudioSnapshot();
  const list = [...(projectColumnDefs ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  return activeOnly ? list.filter((d) => d.isActive) : list;
}

export async function getAllIdeas() {
  const { ideas } = await getScopedStudioSnapshot();
  return ideas;
}

export async function getAllEvolutionLogs() {
  const { evolutionLogs } = await getScopedStudioSnapshot();
  return evolutionLogs;
}

export async function getAllChangeSessions() {
  const { changeSessions } = await getScopedStudioSnapshot();
  return changeSessions ?? [];
}

export async function getProjectById(id: string) {
  return getStudioProjectRow(id);
}

export async function getIdeasByStatus(status: Idea["status"]) {
  const { ideas } = await getScopedStudioSnapshot();
  return ideas.filter((i) => i.status === status);
}

export async function getProjectIdeas(projectId: string) {
  const { ideas } = await getStudioProjectBundle(projectId);
  return ideas;
}

export async function getProjectTasks(projectId: string) {
  const { tasks } = await getStudioProjectBundle(projectId);
  return tasks;
}

export async function getProjectAssets(projectId: string) {
  const { assets } = await getStudioProjectBundle(projectId);
  return assets;
}

export async function getAssetById(id: string) {
  const { assets } = await getScopedStudioSnapshot();
  return assets.find((a) => a.id === id) ?? null;
}

export async function getProjectReleases(projectId: string) {
  const { releases } = await getStudioProjectBundle(projectId);
  return [...releases].sort((a, b) =>
    (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "")
  );
}

export async function getProjectEvolution(projectId: string) {
  const { evolutionLogs } = await getStudioProjectBundle(projectId);
  return [...evolutionLogs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getProjectChangeSessions(projectId: string, day?: string) {
  const { changeSessions } = await getStudioProjectBundle(projectId);
  return changeSessions
    .filter((c) => !day || c.day === day)
    .sort(
      (a, b) =>
        b.day.localeCompare(a.day) || b.createdAt.localeCompare(a.createdAt)
    );
}

export async function getChangeSessionById(id: string) {
  const { changeSessions } = await getScopedStudioSnapshot();
  return (changeSessions ?? []).find((c) => c.id === id) ?? null;
}

export async function getMainlineProject() {
  const { getSuggestedMainline } = await import("@/lib/workbench/mainline-score");
  const suggested = await getSuggestedMainline();
  return suggested?.project ?? null;
}

export async function getTodayFocus() {
  const { getSuggestedMainline } = await import("@/lib/workbench/mainline-score");
  const suggested = await getSuggestedMainline();
  if (!suggested) return null;
  return { project: suggested.project, task: suggested.focusTask };
}

export async function getRecentIdeas(limit = 5) {
  const { ideas } = await getScopedStudioSnapshot();
  return [...ideas]
    .filter((i) => i.status === "inbox")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function getRecentEvolution(limit = 5) {
  const { evolutionLogs } = await getScopedStudioSnapshot();
  return [...evolutionLogs]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function getParkedIdeas() {
  const { ideas } = await getScopedStudioSnapshot();
  return ideas.filter((i) => i.status === "parked");
}

export async function getParkedProjects() {
  const { projects } = await getScopedStudioSnapshot();
  return projects.filter((p) => p.status === "parking");
}

export async function getProjectTitle(id: string) {
  const project = await getStudioProjectRow(id);
  return project?.title ?? "未知项目";
}

export async function getActiveProjects() {
  const { projects } = await getScopedStudioSnapshot();
  return projects.filter((p) => p.status !== "archived" && p.status !== "parking");
}

export async function getAllAssets() {
  const { assets } = await getScopedStudioSnapshot();
  return assets;
}

export async function getPendingAlerts() {
  const { tasks, ideas, projects } = await getScopedStudioSnapshot();
  const blockers = tasks.filter((t) => t.blocker && t.status !== "done");
  const inboxCount = ideas.filter((i) => i.status === "inbox").length;
  const emptyNextActionCount = projects.filter((p) => {
    if (p.status === "archived" || p.status === "parking") return false;
    const next = p.nextAction?.trim() || p.body?.nextStep?.trim() || "";
    return !next;
  }).length;
  return { blockers, inboxCount, emptyNextActionCount };
}

/** 各项目「下一步」草稿：取最近一条未完成任务标题 */
export async function getNextActionDrafts(): Promise<Record<string, string>> {
  const { tasks } = await getScopedStudioSnapshot();
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

export async function getRecentGitUpdates(limit = 5) {
  const { projects } = await getScopedStudioSnapshot();
  return [...projects]
    .filter((p) => p.lastCommitMessage || p.githubRepo)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit)
    .map((p) => ({
      projectId: p.id,
      title: p.title,
      message: p.lastCommitMessage ?? "已配置 GitHub 仓库",
      updatedAt: p.lastCommitAt ?? p.updatedAt,
      githubRepo: p.githubRepo,
    }));
}
