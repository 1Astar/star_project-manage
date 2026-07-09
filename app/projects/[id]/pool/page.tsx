import { notFound } from "next/navigation";
import { fetchPoolData } from "@/lib/actions";
import { RequirementPoolClient } from "@/components/requirement-pool-client";
import { resolveProjectRoute } from "@/lib/project-bridge";

export default async function PoolPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await resolveProjectRoute(id);
  const slug = ctx.pmSlug ?? id;
  const bundle = await fetchPoolData(slug);
  if (!bundle) notFound();

  return (
    <RequirementPoolClient
      projectId={bundle.project.id}
      projectSlug={bundle.project.slug}
      requirements={bundle.poolRequirements}
      modules={bundle.poolModules}
      activeIterations={bundle.activeIterations}
      columnDefs={bundle.poolColumnDefs}
      tagOptions={bundle.tagOptions}
    />
  );
}
