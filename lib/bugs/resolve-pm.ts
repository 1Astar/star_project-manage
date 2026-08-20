import { getStudioSnapshot } from "@/lib/studio/store";
import { ensurePmProjectForStudio, getProjects } from "@/lib/db/local-store";
import { findProjectBySlugOrId } from "@/lib/db/supabase-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  getPmSlugForStudioProject,
  getStudioIdFromPmSlug,
  resolveProjectRoute,
} from "@/lib/project-bridge";
import type { Project } from "@/lib/types";

type ResolveCtx = {
  studio: { id: string; title?: string } | null;
  routeId: string;
  pmSlug: string | null;
  pmBundle: null;
};

/**
 * 站内/管理员路径：解析 PM 项目。
 * Supabase 下禁止 resolveProjectRoute（会 fetch 整板）+ getProjects（整库 readDb），
 * 否则 Cloudflare Worker 会 Too many subrequests → 前端只看到 HTTP 500。
 */
export async function resolvePmProject(projectId: string) {
  const id = projectId.trim();
  if (!id) {
    return {
      ctx: { studio: null, routeId: id, pmSlug: null, pmBundle: null } satisfies ResolveCtx,
      pm: null as Project | null,
    };
  }

  if (isSupabaseConfigured()) {
    const keys = new Set<string>();
    keys.add(id);
    keys.add(getPmSlugForStudioProject({ id }));
    const asStudioFromSlug = getStudioIdFromPmSlug(id);
    if (asStudioFromSlug) {
      keys.add(id);
      keys.add(getPmSlugForStudioProject({ id: asStudioFromSlug }));
    }

    let pm: Project | null = null;
    for (const key of keys) {
      pm = await findProjectBySlugOrId(key);
      if (pm) break;
    }

    return {
      ctx: {
        studio: null,
        routeId: id,
        pmSlug: pm?.slug ?? null,
        pmBundle: null,
      } satisfies ResolveCtx,
      pm,
    };
  }

  const ctx = await resolveProjectRoute(id);
  const pmAll = await getProjects();
  const pm =
    (ctx.pmSlug ? pmAll.find((p) => p.slug === ctx.pmSlug) : null) ||
    pmAll.find((p) => p.id === id) ||
    pmAll.find((p) => p.slug === id) ||
    (ctx.studio ? pmAll.find((p) => p.name === ctx.studio!.title) : null);

  return {
    ctx: {
      studio: ctx.studio,
      routeId: ctx.routeId,
      pmSlug: ctx.pmSlug,
      pmBundle: null,
    },
    pm: pm ?? null,
  };
}

/**
 * 公开 Bug 反馈专用：无登录也要解析真实项目。
 * 不走 resolveProjectRoute / getProjects / 整库 readDb（Cloudflare 子请求会爆）。
 */
export async function resolvePmProjectForFeedback(studioProjectId: string) {
  const id = studioProjectId.trim();
  if (!id) return { studio: null, pm: null };

  const slug = getPmSlugForStudioProject({ id });

  if (isSupabaseConfigured()) {
    const pm =
      (await findProjectBySlugOrId(slug)) ?? (await findProjectBySlugOrId(id));
    if (pm) {
      return { studio: { id }, pm };
    }
  }

  // 库中尚无 PM 行时才拉 Studio 快照并 ensure（极少路径）
  const { projects } = await getStudioSnapshot();
  const studio = projects.find((p) => p.id === id) ?? null;
  if (!studio) return { studio: null, pm: null };

  const pm = await ensurePmProjectForStudio({
    slug: getPmSlugForStudioProject(studio),
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
