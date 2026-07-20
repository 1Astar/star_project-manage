import { notFound } from "next/navigation";
import { ProjectEvolutionTimeline } from "@/components/project-evolution-timeline";
import { resolveProjectRoute } from "@/lib/project-bridge";
import {
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

  const [evolution, releases, ideas] = await Promise.all([
    getProjectEvolution(ctx.studio.id),
    getProjectReleases(ctx.studio.id),
    getProjectIdeas(ctx.studio.id),
  ]);

  const iterations = ctx.pmBundle?.iterations ?? [];

  return (
    <ProjectEvolutionTimeline
      project={ctx.studio}
      releases={releases}
      evolution={evolution}
      ideas={ideas}
      iterations={iterations}
    />
  );
}
