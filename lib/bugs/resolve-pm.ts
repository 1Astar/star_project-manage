import { resolveProjectRoute } from "@/lib/project-bridge";
import { getProjects } from "@/lib/db/local-store";

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
