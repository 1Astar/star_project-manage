import { fetchProjectBoard } from "@/lib/actions";
import { ensurePmProjectForStudio } from "@/lib/db/local-store";
import { getProjectById as getStudioProjectById, getAllProjects } from "@/lib/studio/data";
import type { Project as StudioProject } from "@/lib/studio/types";

/** Studio 项目 id → Star PM 看板 slug（硬编码优先） */
const STUDIO_TO_PM_SLUG: Record<string, string> = {
  "proj-ai-pet": "ai-pet",
  "proj-ai-controller": "ai-controller",
  "proj-star-pm": "star-pm",
  // 随心而行：库内 slug 是 studio-proj-moonpie；勿改成 moonpie（会丢需求）
  "proj-moonpie": "studio-proj-moonpie",
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

export async function resolveProjectRoute(id: string) {
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

  if (studio && pmSlug) {
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
  }

  const pmBundle = pmSlug ? await fetchProjectBoard(pmSlug) : null;

  const routeId = studio?.id ?? studioIdFromSlug ?? id;

  return {
    studio,
    routeId,
    pmSlug: pmSlug ?? pmBundle?.project.slug ?? null,
    pmBundle,
  };
}

export async function getAllProjectsWithGitPreview() {
  const projects = await getAllProjects();
  return projects;
}
