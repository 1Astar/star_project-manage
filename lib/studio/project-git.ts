import { fetchRecentCommits } from "@/lib/github/client";
import { resolveProjectGitScope } from "@/lib/studio/git-utils";
import type { Project } from "@/lib/studio/types";

/**
 * 预览「本分支 + 本目录」最近一次提交。
 * 使用项目 githubBranch / codePath，不写死 main。
 */
export async function getStudioProjectGitPreview(project: Project) {
  if (!project.githubRepo?.trim()) return null;
  if (!project.githubBranch?.trim()) {
    return project.lastCommitMessage
      ? {
          message: project.lastCommitMessage,
          url: null as string | null,
          date: project.lastCommitAt,
        }
      : null;
  }

  try {
    const { repoFullName, branch, path } = resolveProjectGitScope(project);
    const commits = await fetchRecentCommits(repoFullName, branch, 1, path);
    const latest = commits[0];
    if (!latest) return null;
    return {
      message: latest.commit.message.split("\n")[0],
      url: latest.html_url,
      date: latest.commit.author.date,
    };
  } catch {
    return project.lastCommitMessage
      ? {
          message: project.lastCommitMessage,
          url: null,
          date: project.lastCommitAt,
        }
      : null;
  }
}
