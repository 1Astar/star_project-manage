import { notFound } from "next/navigation";
import { fetchProjectBoard } from "@/lib/actions";
import { DemoDataNotice } from "@/components/demo-data-notice";
import { ImportClient } from "@/components/import-client";
import { AppShell } from "@/components/ui";
import { ProjectNavLoader } from "@/components/project-nav-loader";

export default async function ImportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bundle = await fetchProjectBoard(id);
  if (!bundle) notFound();

  return (
    <AppShell
      title={`${bundle.project.name} · Excel 导入`}
      subtitle="Excel 工时表或 Notion CSV 导入需求池"
      nav={<ProjectNavLoader projectId={bundle.project.id} slug={bundle.project.slug} />}
    >
      <div className="mb-6">
        <DemoDataNotice projectSlug={bundle.project.slug} />
      </div>
      <ImportClient projectSlug={bundle.project.slug} projectId={bundle.project.id} />
    </AppShell>
  );
}
