import { updateProjectGitSettings } from "@/lib/db/local-store";
import { getPmSlugForStudioProject } from "@/lib/project-bridge";
import { fetchProjectBoard } from "@/lib/actions";
import { updateStudioProject } from "@/lib/studio/mutations";
import type { Project } from "@/lib/studio/types";

export type SaveStudioGitInput = {
  projectId: string;
  githubRepo?: string | null;
  githubBranch?: string | null;
  codePath?: string | null;
  demoUrl?: string | null;
  localRunGuide?: string | null;
  vercelUrl?: string | null;
};

export async function saveStudioGitSettings(input: SaveStudioGitInput): Promise<Project> {
  const repo = input.githubRepo?.trim() || null;
  const branch = input.githubBranch?.trim() || "main";

  const project = await updateStudioProject(input.projectId, {
    githubRepo: repo,
    githubBranch: branch,
    codePath: input.codePath !== undefined ? input.codePath?.trim() || null : undefined,
    demoUrl: input.demoUrl !== undefined ? input.demoUrl?.trim() || null : undefined,
    localRunGuide:
      input.localRunGuide !== undefined ? input.localRunGuide?.trim() || null : undefined,
    vercelUrl: input.vercelUrl !== undefined ? input.vercelUrl?.trim() || null : undefined,
  });

  const pmSlug = getPmSlugForStudioProject(project);
  if (pmSlug) {
    const bundle = await fetchProjectBoard(pmSlug);
    if (bundle) {
      await updateProjectGitSettings(bundle.project.id, {
        repo_full_name: repo,
        repo_branch: branch,
        code_path: project.codePath,
        demo_url: project.demoUrl,
        local_run_guide: project.localRunGuide,
      });
    }
  }

  return project;
}

export async function applyDefaultGitToUnboundProjects(repo: string, branch: string) {
  const { getAllProjects } = await import("@/lib/studio/data");
  const projects = await getAllProjects();
  const trimmedRepo = repo.trim();
  const trimmedBranch = branch.trim() || "main";

  if (!trimmedRepo) throw new Error("仓库必填");

  const updated: string[] = [];
  for (const project of projects) {
    if (project.githubRepo?.trim()) continue;
    await saveStudioGitSettings({
      projectId: project.id,
      githubRepo: trimmedRepo,
      githubBranch: trimmedBranch,
    });
    updated.push(project.title);
  }

  return { count: updated.length, projects: updated };
}
