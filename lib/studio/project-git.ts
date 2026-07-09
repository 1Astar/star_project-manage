import { fetchRecentCommits } from "@/lib/github/client";
import type { Project } from "@/lib/studio/types";

export async function getStudioProjectGitPreview(project: Project) {
  if (!project.githubRepo) return null;
  try {
    const commits = await fetchRecentCommits(project.githubRepo, "main", 1);
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
