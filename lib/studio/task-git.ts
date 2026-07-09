import { fetchRecentCommits, type GitHubCommit } from "@/lib/github/client";
import { updateStudioTask } from "@/lib/studio/mutations";
import { getStudioSnapshot } from "@/lib/studio/store";
import type { Project, StudioTask } from "@/lib/studio/types";

function taskKeywords(title: string): string[] {
  return title
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);
}

function commitMatchesTask(commit: GitHubCommit, task: StudioTask): boolean {
  const message = commit.commit.message.toLowerCase();
  if (message.includes(task.id.toLowerCase())) return true;

  const keywords = taskKeywords(task.title);
  if (keywords.length === 0) return false;

  const hits = keywords.filter((kw) => message.includes(kw.toLowerCase()));
  return hits.length >= Math.min(2, keywords.length);
}

export async function syncProjectTasksFromGit(project: Project) {
  if (!project.githubRepo) {
    throw new Error("项目未配置 GitHub 仓库");
  }

  const commits = await fetchRecentCommits(project.githubRepo, "main", 30);
  const { tasks } = await getStudioSnapshot();
  const openTasks = tasks.filter((t) => t.projectId === project.id && t.status !== "done");

  const updated: Array<{ taskId: string; title: string; commitMessage: string }> = [];

  for (const task of openTasks) {
    const match = commits.find((c) => commitMatchesTask(c, task));
    if (!match) continue;

    await updateStudioTask(task.id, {
      status: "done",
      completionSource: "git",
      gitCommitSha: match.sha,
      gitCommitMessage: match.commit.message.split("\n")[0],
    });

    updated.push({
      taskId: task.id,
      title: task.title,
      commitMessage: match.commit.message.split("\n")[0],
    });
  }

  return { matched: updated.length, updated };
}
