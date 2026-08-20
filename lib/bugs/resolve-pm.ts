import { getStudioSnapshot } from "@/lib/studio/store";
import { ensurePmProjectForStudio, getProjects } from "@/lib/db/local-store";
import {
  getPmSlugForStudioProject,
  resolveProjectRoute,
} from "@/lib/project-bridge";

/** 站内/管理员路径：可走演示沙盘过滤 */
export async function resolvePmProject(projectId: string) {
  const ctx = await resolveProjectRoute(projectId);
  const pmAll = await getProjects();
  const pm =
    (ctx.pmSlug ? pmAll.find((p) => p.slug === ctx.pmSlug) : null) ||
    pmAll.find((p) => p.id === projectId) ||
    pmAll.find((p) => p.slug === projectId) ||
    (ctx.studio ? pmAll.find((p) => p.name === ctx.studio!.title) : null);
  return { ctx, pm: pm ?? null };
}

/**
 * 公开 Bug 反馈专用：无登录也要解析真实项目。
 * 不走 resolveProjectRoute / getProjects 的演示沙盘过滤。
 */
export async function resolvePmProjectForFeedback(studioProjectId: string) {
  const id = studioProjectId.trim();
  if (!id) return { studio: null, pm: null };

  const { projects } = await getStudioSnapshot();
  const studio = projects.find((p) => p.id === id) ?? null;
  if (!studio) return { studio: null, pm: null };

  const slug = getPmSlugForStudioProject(studio);
  const pm = await ensurePmProjectForStudio({
    slug,
    name: studio.title,
    description: studio.positioning || null,
    demo_url: studio.demoUrl,
    local_run_guide: studio.localRunGuide,
    code_path: studio.codePath,
    repo_full_name: studio.githubRepo,
    repo_branch: studio.githubBranch || null,
    repo_url: studio.githubRepo ? `https://github.com/${studio.githubRepo}` : null,
  });

  return { studio, pm };
}
