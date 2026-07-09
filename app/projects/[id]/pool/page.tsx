import { notFound } from "next/navigation";
import { fetchPoolData } from "@/lib/actions";
import { RequirementPoolClient } from "@/components/requirement-pool-client";
import { AppShell, ProjectNav } from "@/components/ui";

export default async function PoolPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bundle = await fetchPoolData(id);
  if (!bundle) notFound();

  return (
    <AppShell
      title={`${bundle.project.name} · 需求池`}
      subtitle="产品私有功能点库，规划成熟后加入当前迭代"
      nav={<ProjectNav projectId={bundle.project.id} slug={bundle.project.slug} />}
    >
      <RequirementPoolClient
        projectId={bundle.project.id}
        projectSlug={bundle.project.slug}
        requirements={bundle.poolRequirements}
        modules={bundle.poolModules}
        activeIterations={bundle.activeIterations}
        columnDefs={bundle.poolColumnDefs}
        tagOptions={bundle.tagOptions}
      />
    </AppShell>
  );
}
