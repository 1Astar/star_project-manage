import { fetchProjectBoard } from "@/lib/actions";
import { ensurePmProjectForStudio } from "@/lib/db/local-store";
import { getProjectById as getStudioProjectById, getAllProjects } from "@/lib/studio/data";
import type { Project as StudioProject } from "@/lib/studio/types";

/** Studio 项目 id → Star PM 看板 slug（硬编码优先） */
const STUDIO_TO_PM_SLUG: Record<string, string> = {
  "proj-ai-pet": "ai-pet",
  "proj-ai-controller": "ai-controller",
  "proj-star-pm": "star-pm",
  "proj-c84ff6fa": "yoking-pump",
  "proj-star-lab-os": "star-lab-os",
  "proj-personal-tools": "personal-tools",
};

const PM_TO_STUDIO_ID: Record<string, string> = Object.fromEntries(
  Object.entries(STUDIO_TO_PM_SLUG).map(([studioId, slug]) => [slug, studioId])
);

/** 任意 Studio 项目都有稳定 PM slug；未硬编码时用 studio-{id} */
export function getPmSlugForStudioProject(studioProject: StudioProject): string {
  return STUDIO_TO_PM_SLUG[studioProject.id] ?? `studio-${studioProject.id}`;
}

export function getStudioIdFromPmSlug(slug: string): string | null {
  if (PM_TO_STUDIO_ID[slug]) return PM_TO_STUDIO_ID[slug];
  if (slug.startsWith("studio-")) {
    const rest = slug.slice("studio-".length);
    return rest || null;
  }
  return null;
}

export async function resolveProjectRoute(id: string) {
  const studioById = await getStudioProjectById(id);
  const studioIdFromSlug = getStudioIdFromPmSlug(id);
  const studio =
    studioById ??
    (studioIdFromSlug ? await getStudioProjectById(studioIdFromSlug) : null);

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
