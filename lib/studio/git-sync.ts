import { fetchRecentCommits } from "@/lib/github/client";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getProjectById } from "@/lib/studio/data";
import { invalidateStudioCache } from "@/lib/studio/store";
import type { StudioGitActivity } from "@/lib/studio/git-utils";
import { resolveProjectGitScope } from "@/lib/studio/git-utils";
export type { StudioGitActivity } from "@/lib/studio/git-utils";
export { studioProjectHasGit, studioProjectRepoUrl } from "@/lib/studio/git-utils";
import type { Project } from "@/lib/studio/types";

interface StudioGitActivityRow {
  id: string;
  project_id: string;
  repo_full_name: string;
  branch: string;
  commit_sha: string;
  short_sha: string;
  message: string;
  author: string;
  committed_at: string;
  url: string;
  synced_at: string;
}

function sb() {
  const client = createServiceClient();
  if (!client) throw new Error("Supabase 未配置");
  return client;
}

function shortSha(sha: string) {
  return sha.slice(0, 7);
}

function rowToActivity(row: StudioGitActivityRow): StudioGitActivity {
  return {
    id: row.id,
    projectId: row.project_id,
    repoFullName: row.repo_full_name,
    branch: row.branch,
    commitSha: row.commit_sha,
    shortSha: row.short_sha,
    message: row.message,
    author: row.author,
    committedAt: row.committed_at,
    url: row.url,
    syncedAt: row.synced_at,
  };
}

export async function getStudioGitActivities(projectId: string, limit = 5): Promise<StudioGitActivity[]> {
  if (!isSupabaseConfigured()) return [];

  const { data, error } = await sb()
    .from("studio_git_activities")
    .select("*")
    .eq("project_id", projectId)
    .order("committed_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (error.message.includes("studio_git_activities")) return [];
    throw new Error(error.message);
  }

  return ((data ?? []) as StudioGitActivityRow[]).map(rowToActivity);
}

export async function syncStudioProjectGit(projectId: string) {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase 未配置，无法同步 Studio Git");
  }

  const project = await getProjectById(projectId);
  if (!project) throw new Error("项目不存在");

  const { repoFullName, branch, path } = resolveProjectGitScope(project);
  let commits = await fetchRecentCommits(repoFullName, branch, 20, path);
  let pathFilterIgnored = false;
  let warning: string | null = null;

  // path 过滤过严或误填时 GitHub 会返回空；回退整仓再拉一次
  if (path && commits.length === 0) {
    commits = await fetchRecentCommits(repoFullName, branch, 20);
    if (commits.length > 0) {
      pathFilterIgnored = true;
      warning = `代码目录「${path}」下无提交，已改拉分支整仓最近提交`;
    }
  }

  if (commits.length === 0) {
    warning =
      warning ??
      `仓库 ${repoFullName} 分支 ${branch}${path ? `（目录 ${path}）` : ""} 未拉到任何提交。请确认分支名与 GitHub TOKEN 权限`;
  }

  const { data: existingRows } = await sb()
    .from("studio_git_activities")
    .select("commit_sha")
    .eq("project_id", projectId);

  const existingShas = new Set(
    ((existingRows ?? []) as { commit_sha: string }[]).map((r) => r.commit_sha)
  );

  const syncedAt = new Date().toISOString();
  let newCount = 0;
  const newRows: StudioGitActivityRow[] = [];

  for (const commit of commits) {
    if (existingShas.has(commit.sha)) continue;
    newRows.push({
      id: `sga-${crypto.randomUUID().slice(0, 12)}`,
      project_id: projectId,
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

  if (newRows.length > 0) {
    const { error: insertError } = await sb().from("studio_git_activities").insert(newRows);
    if (insertError) throw new Error(insertError.message);
  }

  const latest = commits[0] ?? null;
  const projectPatch: Partial<Project> & Record<string, unknown> = {
    lastGitSyncedAt: syncedAt,
    ...(latest
      ? {
          lastCommitSha: latest.sha,
          lastCommitMessage: latest.commit.message.split("\n")[0] ?? latest.commit.message,
          lastCommitAt: latest.commit.author.date,
        }
      : {}),
  };

  const { error: updateError } = await sb()
    .from("studio_projects")
    .update({
      last_git_synced_at: projectPatch.lastGitSyncedAt,
      last_commit_sha: projectPatch.lastCommitSha ?? null,
      last_commit_message: projectPatch.lastCommitMessage ?? null,
      last_commit_at: projectPatch.lastCommitAt ?? null,
      updated_at: syncedAt,
    })
    .eq("id", projectId);

  if (updateError) throw new Error(updateError.message);
  invalidateStudioCache();

  const activities = await getStudioGitActivities(projectId, 10);

  return {
    ok: true as const,
    projectId,
    newCount,
    fetchedCount: commits.length,
    pathFilterIgnored,
    warning,
    latest: latest
      ? {
          sha: latest.sha,
          shortSha: shortSha(latest.sha),
          message: latest.commit.message.split("\n")[0] ?? latest.commit.message,
          author: latest.commit.author.name,
          committedAt: latest.commit.author.date,
          url: latest.html_url,
        }
      : null,
    syncedAt,
    activities,
  };
}

export async function syncAllStudioBoundProjectsGit() {
  if (!isSupabaseConfigured()) {
    return { total: 0, succeeded: 0, failed: 0, results: [] as Array<Record<string, unknown>> };
  }

  const { data, error } = await sb()
    .from("studio_projects")
    .select("id, title, github_repo, github_branch")
    .not("github_repo", "is", null);

  if (error) throw new Error(error.message);

  const bound = ((data ?? []) as Array<{ id: string; title: string; github_repo: string | null }>).filter(
    (p) => p.github_repo?.trim()
  );

  const results: Array<{ projectId: string; name: string; ok: boolean; newCount?: number; error?: string }> = [];

  for (const project of bound) {
    try {
      const result = await syncStudioProjectGit(project.id);
      results.push({ projectId: project.id, name: project.title, ok: true, newCount: result.newCount });
    } catch (err) {
      results.push({
        projectId: project.id,
        name: project.title,
        ok: false,
        error: err instanceof Error ? err.message : "同步失败",
      });
    }
  }

  return {
    total: bound.length,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}
