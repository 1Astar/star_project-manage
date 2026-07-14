import { buildRepoUrl } from "@/lib/github/client";
import type { Project } from "@/lib/studio/types";

export interface StudioGitActivity {
  id: string;
  projectId: string;
  repoFullName: string;
  branch: string;
  commitSha: string;
  shortSha: string;
  message: string;
  author: string;
  committedAt: string;
  url: string;
  syncedAt: string;
}

export function studioProjectHasGit(project: Project) {
  return Boolean(project.githubRepo?.trim() && (project.githubBranch || "main").trim());
}

export function studioProjectRepoUrl(project: Project) {
  return project.githubRepo ? buildRepoUrl(project.githubRepo) : null;
}
