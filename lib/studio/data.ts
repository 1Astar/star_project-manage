import { getStudioSnapshot } from "@/lib/studio/store";
import type { Idea } from "@/lib/studio/types";

export async function getStudioData() {
  return getStudioSnapshot();
}

export async function getAllProjects() {
  const { projects } = await getStudioSnapshot();
  return projects;
}

export async function getProjectColumnDefs(activeOnly = true) {
  const { projectColumnDefs } = await getStudioSnapshot();
  const list = [...(projectColumnDefs ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  return activeOnly ? list.filter((d) => d.isActive) : list;
}

export async function getAllIdeas() {
  const { ideas } = await getStudioSnapshot();
  return ideas;
}

export async function getAllEvolutionLogs() {
  const { evolutionLogs } = await getStudioSnapshot();
  return evolutionLogs;
}

export async function getProjectById(id: string) {
  const { projects } = await getStudioSnapshot();
  return projects.find((p) => p.id === id) ?? null;
}

export async function getIdeasByStatus(status: Idea["status"]) {
  const { ideas } = await getStudioSnapshot();
  return ideas.filter((i) => i.status === status);
}

export async function getProjectIdeas(projectId: string) {
  const { ideas } = await getStudioSnapshot();
  return ideas.filter((i) => i.relatedProjectId === projectId);
}

export async function getProjectTasks(projectId: string) {
  const { tasks } = await getStudioSnapshot();
  return tasks.filter((t) => t.projectId === projectId);
}

export async function getProjectAssets(projectId: string) {
  const { assets } = await getStudioSnapshot();
  return assets.filter((a) => a.projectId === projectId);
}

export async function getProjectReleases(projectId: string) {
  const { releases } = await getStudioSnapshot();
  return (releases ?? [])
    .filter((r) => r.projectId === projectId)
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
}

export async function getProjectEvolution(projectId: string) {
  const { evolutionLogs } = await getStudioSnapshot();
  return evolutionLogs
    .filter((e) => e.projectId === projectId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getMainlineProject() {
  const { projects } = await getStudioSnapshot();
  return projects.find((p) => p.status === "mainline") ?? null;
}

export async function getTodayFocus() {
  const { projects, tasks } = await getStudioSnapshot();
  const mainline = projects.find((p) => p.status === "mainline");
  if (!mainline) return null;
  const task =
    tasks.find((t) => t.projectId === mainline.id && t.status === "in_progress") ??
    tasks.find((t) => t.projectId === mainline.id) ??
    null;
  return { project: mainline, task };
}

export async function getRecentIdeas(limit = 5) {
  const { ideas } = await getStudioSnapshot();
  return [...ideas]
    .filter((i) => i.status === "inbox")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function getRecentEvolution(limit = 5) {
  const { evolutionLogs } = await getStudioSnapshot();
  return [...evolutionLogs]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function getParkedIdeas() {
  const { ideas } = await getStudioSnapshot();
  return ideas.filter((i) => i.status === "parked");
}

export async function getParkedProjects() {
  const { projects } = await getStudioSnapshot();
  return projects.filter((p) => p.status === "parking");
}

export async function getProjectTitle(id: string) {
  const { projects } = await getStudioSnapshot();
  return projects.find((p) => p.id === id)?.title ?? "未知项目";
}

export async function getActiveProjects() {
  const { projects } = await getStudioSnapshot();
  return projects.filter((p) => p.status !== "archived" && p.status !== "parking");
}

export async function getAllAssets() {
  const { assets } = await getStudioSnapshot();
  return assets;
}

export async function getPendingAlerts() {
  const { tasks, ideas, projects } = await getStudioSnapshot();
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
  const { tasks } = await getStudioSnapshot();
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
  const { projects } = await getStudioSnapshot();
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
