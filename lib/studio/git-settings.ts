import { updateProjectGitSettings } from "@/lib/db/local-store";
import { normalizeGithubRepoFullName } from "@/lib/github/client";
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

function sanitizeGithubRepoInput(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() || null;
  if (!trimmed) return null;
  const normalized = normalizeGithubRepoFullName(trimmed);
  const parts = normalized.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`仓库格式无效：${trimmed}，应为 owner/repo 或 GitHub URL`);
  }
  return normalized;
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
  const repo =
    input.githubRepo !== undefined ? sanitizeGithubRepoInput(input.githubRepo) : undefined;
  const branch = input.githubBranch?.trim() || null;
  if (repo && !branch) {
    throw new Error("请填写分支名（githubBranch），须使用项目实际分支，不再默认 main");
  }

  const project = await updateStudioProject(input.projectId, {
    ...(input.githubRepo !== undefined ? { githubRepo: repo } : {}),
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
        repo_full_name: project.githubRepo,
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
  const { createServiceClient } = await import("@/lib/supabase/server");
  const { isSupabaseConfigured } = await import("@/lib/supabase/config");
  const projects = await getAllProjects();
  const trimmedRepo = sanitizeGithubRepoInput(repo);
  const trimmedBranch = branch.trim();

  if (!trimmedRepo) throw new Error("仓库必填");
  if (!trimmedBranch) throw new Error("分支必填（须写明项目分支，不默认 main）");

  const updated: string[] = [];

  // 只 patch 仓库字段，避免整行 upsert 因缺列 / schema cache 失败
  if (isSupabaseConfigured()) {
    const client = createServiceClient();
    if (!client) throw new Error("Supabase 未配置");
    for (const project of projects) {
      if (project.githubRepo?.trim()) continue;
      const { error } = await client
        .from("studio_projects")
        .update({
          github_repo: trimmedRepo,
          github_branch: trimmedBranch,
          updated_at: new Date().toISOString(),
        })
        .eq("id", project.id);
      if (error) throw new Error(error.message);
      updated.push(project.title);
    }
    return { count: updated.length, projects: updated };
  }

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
