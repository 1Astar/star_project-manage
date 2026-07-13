import { fetchRecentCommits, buildRepoUrl } from "@/lib/github/client";
import { readDb, persistGitSyncResult } from "@/lib/db/local-store";
import type { GitActivity, Project } from "@/lib/types";

export interface GitSyncResult {
  ok: true;
  projectId: string;
  newCount: number;
  latest: {
    sha: string;
    shortSha: string;
    message: string;
    author: string;
    committedAt: string;
    url: string;
  } | null;
  syncedAt: string;
  activities: GitActivity[];
}

function uid(): string {
  return crypto.randomUUID();
}

function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

export async function syncProjectGit(projectId: string): Promise<GitSyncResult> {
  const db = await readDb();
  const project = db.projects.find((p) => p.id === projectId || p.slug === projectId);
  if (!project) {
    throw new Error("项目不存在");
  }
  if (!project.repo_full_name?.trim()) {
    throw new Error("项目未绑定 GitHub 仓库（repo_full_name）");
  }
  if (!project.repo_branch?.trim()) {
    throw new Error("项目未配置分支（repo_branch）");
  }

  const repoFullName = project.repo_full_name.trim();
  const branch = project.repo_branch.trim();
  const commits = await fetchRecentCommits(repoFullName, branch, 10);

  const existingShas = new Set(
    (db.git_activities ?? [])
      .filter((a) => a.project_id === project.id)
      .map((a) => a.commit_sha)
  );

  const syncedAt = new Date().toISOString();
  let newCount = 0;
  const newActivities: GitActivity[] = [];

  for (const commit of commits) {
    if (existingShas.has(commit.sha)) continue;
    newActivities.push({
      id: uid(),
      project_id: project.id,
      repo_full_name: repoFullName,
      branch,
      commit_sha: commit.sha,
      short_sha: shortSha(commit.sha),
      message: commit.commit.message.split("\n")[0] ?? commit.commit.message,
      author: commit.commit.author.name,
      committed_at: commit.commit.author.date,
      url: commit.html_url,
      synced_at: syncedAt,
    });
    newCount += 1;
  }

  const latestCommit = commits[0] ?? null;
  const projectFields: Partial<Project> = {
    repo_url: project.repo_url ?? buildRepoUrl(repoFullName),
    last_git_synced_at: syncedAt,
    ...(latestCommit
      ? {
          last_commit_sha: latestCommit.sha,
          last_commit_message:
            latestCommit.commit.message.split("\n")[0] ?? latestCommit.commit.message,
          last_commit_at: latestCommit.commit.author.date,
        }
      : {}),
  };

  await persistGitSyncResult(project.id, projectFields, newActivities);

  const dbAfter = await readDb();
  const activities = [...(dbAfter.git_activities ?? [])]
    .filter((a) => a.project_id === project.id)
    .sort((a, b) => b.committed_at.localeCompare(a.committed_at))
    .slice(0, 5);

  return {
    ok: true,
    projectId: project.id,
    newCount,
    latest: latestCommit
      ? {
          sha: latestCommit.sha,
          shortSha: shortSha(latestCommit.sha),
          message:
            latestCommit.commit.message.split("\n")[0] ?? latestCommit.commit.message,
          author: latestCommit.commit.author.name,
          committedAt: latestCommit.commit.author.date,
          url: latestCommit.html_url,
        }
      : null,
    syncedAt,
    activities,
  };
}

export async function getGitActivitiesForProject(projectId: string, limit = 5) {
  const db = await readDb();
  const project = db.projects.find((p) => p.id === projectId || p.slug === projectId);
  if (!project) return [];

  return (db.git_activities ?? [])
    .filter((a) => a.project_id === project.id)
    .sort((a, b) => b.committed_at.localeCompare(a.committed_at))
    .slice(0, limit);
}

export interface ProjectGitSyncItem {
  projectId: string;
  slug: string;
  name: string;
  ok: boolean;
  newCount?: number;
  error?: string;
}

export interface SyncAllProjectsGitResult {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  results: ProjectGitSyncItem[];
}

export async function syncAllBoundProjectsGit(): Promise<SyncAllProjectsGitResult> {
  const db = await readDb();
  const bound = db.projects.filter(
    (p) => p.repo_full_name?.trim() && p.repo_branch?.trim()
  );

  if (bound.length === 0) {
    return { total: 0, succeeded: 0, failed: 0, skipped: 0, results: [] };
  }

  const results: ProjectGitSyncItem[] = [];

  for (const project of bound) {
    try {
      const result = await syncProjectGit(project.id);
      results.push({
        projectId: project.id,
        slug: project.slug,
        name: project.name,
        ok: true,
        newCount: result.newCount,
      });
    } catch (error) {
      results.push({
        projectId: project.id,
        slug: project.slug,
        name: project.name,
        ok: false,
        error: error instanceof Error ? error.message : "同步失败",
      });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  return {
    total: bound.length,
    succeeded,
    failed,
    skipped: 0,
    results,
  };
}
