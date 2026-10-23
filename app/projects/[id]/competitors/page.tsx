import { notFound } from "next/navigation";
import { CompetitorsHubClient } from "@/components/competitors-hub-client";
import { resolveProjectRoute } from "@/lib/project-bridge";
import { listCompetitorEntries } from "@/lib/competitors/store";

export default async function ProjectCompetitorsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await resolveProjectRoute(id);
  if (!ctx.studio && !ctx.pmProject && !ctx.pmSlug) notFound();

  const entries = ctx.pmProject
    ? await listCompetitorEntries(ctx.pmProject.id)
    : [];

  return (
    <CompetitorsHubClient routeId={ctx.routeId} entries={entries} />
  );
}
