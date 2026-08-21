import { fetchProjectBoard } from "@/lib/actions";
import { ensurePmProjectForStudio } from "@/lib/db/local-store";
import { findProjectBySlugOrId } from "@/lib/db/supabase-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getProjectById as getStudioProjectById, getAllProjects } from "@/lib/studio/data";
import type { Project as StudioProject } from "@/lib/studio/types";
import type { Project as PmProject } from "@/lib/types";

/** Studio 项目 id → Star PM 看板 slug（硬编码优先） */
const STUDIO_TO_PM_SLUG: Record<string, string> = {
  "proj-ai-pet": "ai-pet",
  "proj-ai-controller": "ai-controller",
  "proj-star-pm": "star-pm",
  // 随心而行：库内 slug 是 studio-proj-moonpie；勿改成 moonpie（会丢需求）
  "proj-moonpie": "studio-proj-moonpie",
  // 小手机 / AI Companion
  "proj-02c0940a": "studio-proj-02c0940a",
  "proj-c84ff6fa": "yoking-pump",
  "proj-yuanjing-pump": "yuanjing-pump",
  "proj-star-lab-os": "star-lab-os",
  "proj-personal-tools": "personal-tools",
  "proj-demo-showcase": "demo-showcase",
};

const PM_TO_STUDIO_ID: Record<string, string> = Object.fromEntries(
  Object.entries(STUDIO_TO_PM_SLUG).map(([studioId, slug]) => [slug, studioId])
);

/** 历史错误 slug（工作台曾写成 moonpie）→ Studio id */
const LEGACY_PM_SLUG_TO_STUDIO: Record<string, string> = {
  moonpie: "proj-moonpie",
};

/** 任意 Studio 项目都有稳定 PM slug；未硬编码时用 studio-{id} */
export function getPmSlugForStudioProject(
  studioProject: Pick<StudioProject, "id">
): string {
  return STUDIO_TO_PM_SLUG[studioProject.id] ?? `studio-${studioProject.id}`;
}

export function getStudioIdFromPmSlug(slug: string): string | null {
  if (PM_TO_STUDIO_ID[slug]) return PM_TO_STUDIO_ID[slug];
  if (LEGACY_PM_SLUG_TO_STUDIO[slug]) return LEGACY_PM_SLUG_TO_STUDIO[slug];
  if (slug.startsWith("studio-")) {
    const rest = slug.slice("studio-".length);
    return rest || null;
  }
  return null;
}

/** 按 Studio 项目找对应 PM 行（兼容历史 moonpie slug） */
export function findPmProjectForStudio<T extends { id: string; slug: string }>(
  studioId: string,
  pmProjects: T[]
): T | undefined {
  const primary = getPmSlugForStudioProject({ id: studioId });
  const hit = pmProjects.find((p) => p.slug === primary);
  if (hit) return hit;
  if (studioId === "proj-moonpie") {
    return pmProjects.find((p) => p.slug === "moonpie");
  }
  return undefined;
}

export type ResolveProjectRouteResult = {
  studio: StudioProject | null;
  routeId: string;
  pmSlug: string | null;
  /** 轻量：单行项目；layout / 导航用，避免整板 */
  pmProject: PmProject | null;
  /** 仅 includeBoard 时填充；默认 null */
  pmBundle: Awaited<ReturnType<typeof fetchProjectBoard>> | null;
};

/**
 * 解析项目路由。
 * 默认不拉整板（省 Egress）；需要看板数据时传 `{ includeBoard: true }`，
 * 或页面自行 `fetchProjectBoard(pmSlug)`。
 */
export async function resolveProjectRoute(
  id: string,
  opts?: { includeBoard?: boolean }
): Promise<ResolveProjectRouteResult> {
  const includeBoard = opts?.includeBoard === true;
  const studioById = await getStudioProjectById(id);
  const studioIdFromSlug = getStudioIdFromPmSlug(id);
  const studio =
    studioById ??
    (studioIdFromSlug ? await getStudioProjectById(studioIdFromSlug) : null);

  // 访客 / 观看者只能进演示项目（与 REQUIRE_AUTH 解耦）
  try {
    const { isDemoPublicScope } = await import("@/lib/demo/scope");
    const { isDemoShowcaseId } = await import("@/lib/demo/showcase");
    if (await isDemoPublicScope()) {
      const candidate = studio?.id ?? id;
      if (!isDemoShowcaseId(candidate) && !isDemoShowcaseId(id)) {
        return {
          studio: null,
          routeId: id,
          pmSlug: null,
          pmProject: null,
          pmBundle: null,
        };
      }
    }
  } catch {
    /* ignore */
  }

  let pmSlug = studio
    ? getPmSlugForStudioProject(studio)
    : getStudioIdFromPmSlug(id)
      ? id
      : null;

  let pmProject: PmProject | null = null;

  if (pmSlug && isSupabaseConfigured()) {
    pmProject = await findProjectBySlugOrId(pmSlug);
    if (!pmProject && studio) {
      pmProject = await ensurePmProjectForStudio({
        slug: pmSlug,
        name: studio.title,
        description: studio.positioning || null,
        demo_url: studio.demoUrl,
        local_run_guide: studio.localRunGuide,
        code_path: studio.codePath,
        repo_full_name: studio.githubRepo,
        repo_branch: studio.githubBranch || null,
        repo_url: studio.githubRepo
          ? `https://github.com/${studio.githubRepo}`
          : null,
      });
    }
    if (pmProject) pmSlug = pmProject.slug;
  } else if (studio && pmSlug) {
    const ensured = await ensurePmProjectForStudio({
      slug: pmSlug,
      name: studio.title,
      description: studio.positioning || null,
      demo_url: studio.demoUrl,
      local_run_guide: studio.localRunGuide,
      code_path: studio.codePath,
      repo_full_name: studio.githubRepo,
      repo_branch: studio.githubBranch || null,
      repo_url: studio.githubRepo
        ? `https://github.com/${studio.githubRepo}`
        : null,
    });
    pmSlug = ensured.slug;
    pmProject = ensured;
  } else if (pmSlug) {
    // 纯 PM slug 路径（本地）
    const { getProjectById } = await import("@/lib/db/local-store");
    pmProject = await getProjectById(pmSlug);
  }

  const pmBundle =
    includeBoard && pmSlug ? await fetchProjectBoard(pmSlug) : null;

  const routeId = studio?.id ?? studioIdFromSlug ?? id;

  return {
    studio,
    routeId,
    pmSlug: pmSlug ?? pmBundle?.project.slug ?? pmProject?.slug ?? null,
    pmProject: pmProject ?? pmBundle?.project ?? null,
    pmBundle,
  };
}

export async function getAllProjectsWithGitPreview() {
  const projects = await getAllProjects();
  return projects;
}
