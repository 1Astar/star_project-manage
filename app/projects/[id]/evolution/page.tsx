import { notFound } from "next/navigation";
import { ProjectEvolutionTimeline } from "@/components/project-evolution-timeline";
import { resolveProjectRoute } from "@/lib/project-bridge";
import { listIterationsForProject } from "@/lib/db/supabase-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getProjectBundle } from "@/lib/db/local-store";
import {
  getProjectChangeSessions,
  getProjectEvolution,
  getProjectIdeas,
  getProjectReleases,
} from "@/lib/studio/data";

export default async function ProjectEvolutionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await resolveProjectRoute(id);
  if (!ctx.studio) notFound();

  const [evolution, releases, ideas, changeSessions] = await Promise.all([
    getProjectEvolution(ctx.studio.id),
    getProjectReleases(ctx.studio.id),
    getProjectIdeas(ctx.studio.id),
    getProjectChangeSessions(ctx.studio.id),
  ]);

  let iterations =
    ctx.pmProject && isSupabaseConfigured()
      ? await listIterationsForProject(ctx.pmProject.id)
      : [];
  if (!iterations.length && ctx.pmSlug) {
    const bundle = await getProjectBundle(ctx.pmSlug);
    iterations = bundle?.iterations ?? [];
  }

  return (
    <ProjectEvolutionTimeline
      project={ctx.studio}
      releases={releases}
      evolution={evolution}
      ideas={ideas}
      iterations={iterations}
      changeSessions={changeSessions}
    />
  );
}
