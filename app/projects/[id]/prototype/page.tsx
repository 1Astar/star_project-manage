import { notFound } from "next/navigation";
import { fetchProjectBoard } from "@/lib/actions";
import { PrototypeWorkspace } from "@/components/prototype-workspace";
import { AppShell, ProjectNav } from "@/components/ui";
import "@/app/prototype-workspace.css";

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
      subtitle="PinMark 标注可绑定验收项，右侧逐项验收"
      nav={<ProjectNav projectId={bundle.project.id} slug={bundle.project.slug} />}
    >
      <PrototypeWorkspace
        projectId={bundle.project.id}
        projectSlug={bundle.project.slug}
        projectName={bundle.project.name}
        requirements={bundle.requirements}
        acceptanceItems={bundle.acceptance_items}
        savedAnnotations={bundle.prototype_annotations}
        tasks={bundle.role_tasks}
        prototypes={bundle.prototypes}
      />
    </AppShell>
  );
}
