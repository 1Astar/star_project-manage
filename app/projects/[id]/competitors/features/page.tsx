import { notFound } from "next/navigation";
import { CompetitorsFeaturesClient } from "@/components/competitors-features-client";
import { resolveProjectRoute } from "@/lib/project-bridge";

export default async function ProjectCompetitorFeaturesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await resolveProjectRoute(id);
  if (!ctx.studio && !ctx.pmProject && !ctx.pmSlug) notFound();

  return <CompetitorsFeaturesClient routeId={ctx.routeId} />;
}
