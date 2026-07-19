import { updateProjectGitSettings } from "@/lib/db/local-store";
import { getPmSlugForStudioProject } from "@/lib/project-bridge";
import { fetchProjectBoard } from "@/lib/actions";
import { updateStudioProject } from "@/lib/studio/mutations";
import type { Project } from "@/lib/studio/types";

function sanitizeCodePathInput(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() || null;
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed) || /^github\.com\//i.test(trimmed)) {
    return null;
  }
  return trimmed;
}

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
  const branch = input.githubBranch?.trim() || null;
  if (repo && !branch) {
    throw new Error("请填写分支名（githubBranch），须使用项目实际分支，不再默认 main");
  }

  const project = await updateStudioProject(input.projectId, {
    githubRepo: repo,
    githubBranch: branch ?? "",
    codePath:
      input.codePath !== undefined
        ? sanitizeCodePathInput(input.codePath)
        : undefined,
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
  const trimmedBranch = branch.trim();

  if (!trimmedRepo) throw new Error("仓库必填");
  if (!trimmedBranch) throw new Error("分支必填（须写明项目分支，不默认 main）");

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
