import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchProjectBoard } from "@/lib/actions";
import { PrototypeWorkspace } from "@/components/prototype-workspace";
import { AppShell, ProjectNav } from "@/components/ui";

export default async function PrototypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bundle = await fetchProjectBoard(id);
  if (!bundle) notFound();

  return (
    <AppShell
      title={`${bundle.project.name} · 原型工作区`}
      subtitle="左侧原型预览，右侧需求与任务面板同源数据"
      nav={<ProjectNav projectId={bundle.project.id} slug={bundle.project.slug} />}
    >
      <PrototypeWorkspace
        projectId={bundle.project.id}
        projectSlug={bundle.project.slug}
        requirements={bundle.requirements}
        tasks={bundle.role_tasks}
        prototypes={bundle.prototypes}
      />
    </AppShell>
  );
}
