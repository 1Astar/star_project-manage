import { fetchRecentCommits } from "@/lib/github/client";
import type { Project } from "@/lib/studio/types";

function normalizeRepoPath(codePath: string | null): string | undefined {
  if (!codePath?.trim()) return undefined;
  return codePath.trim().replace(/\\/g, "/").replace(/^\/+/, "");
}

export async function getStudioProjectGitPreview(project: Project) {
  if (!project.githubRepo) return null;
  const branch = project.githubBranch || "main";
  const path = normalizeRepoPath(project.codePath);
  try {
    const commits = await fetchRecentCommits(project.githubRepo, branch, 1, path);
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
