import { getStudioSnapshot } from "@/lib/studio/store";
import type { Idea } from "@/lib/studio/types";

export async function getStudioData() {
  return getStudioSnapshot();
}

export async function getAllProjects() {
  const { projects } = await getStudioSnapshot();
  return projects;
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
  const { tasks, ideas } = await getStudioSnapshot();
  const blockers = tasks.filter((t) => t.blocker && t.status !== "done");
  const inboxCount = ideas.filter((i) => i.status === "inbox").length;
  return { blockers, inboxCount };
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
