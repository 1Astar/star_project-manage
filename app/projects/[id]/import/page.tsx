import { notFound } from "next/navigation";
import { fetchProjectBoard } from "@/lib/actions";
import { ImportClient } from "@/components/import-client";
import { AppShell, ProjectNav } from "@/components/ui";

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
      subtitle="识别多行合并表头，预览后再写入"
      nav={<ProjectNav projectId={bundle.project.id} slug={bundle.project.slug} />}
    >
      <ImportClient projectSlug={bundle.project.slug} projectId={bundle.project.id} />
    </AppShell>
  );
}
