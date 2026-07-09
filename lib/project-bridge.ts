import { fetchProjectBoard } from "@/lib/actions";
import { getProjectById as getStudioProjectById, getAllProjects } from "@/lib/studio/data";
import type { Project as StudioProject } from "@/lib/studio/types";

/** Studio 项目 id → Star PM 看板 slug */
const STUDIO_TO_PM_SLUG: Record<string, string> = {
  "proj-ai-pet": "ai-pet",
  "proj-ai-controller": "ai-controller",
};

const PM_TO_STUDIO_ID: Record<string, string> = Object.fromEntries(
  Object.entries(STUDIO_TO_PM_SLUG).map(([studioId, slug]) => [slug, studioId])
);

export function getPmSlugForStudioProject(studioProject: StudioProject): string | null {
  return STUDIO_TO_PM_SLUG[studioProject.id] ?? null;
}

export async function resolveProjectRoute(id: string) {
  const studioById = await getStudioProjectById(id);
  const studioIdFromSlug = PM_TO_STUDIO_ID[id];
  const studio =
    studioById ??
    (studioIdFromSlug ? await getStudioProjectById(studioIdFromSlug) : null);

  const pmSlug = studio ? getPmSlugForStudioProject(studio) : PM_TO_STUDIO_ID[id] ? id : null;
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
