import { notFound } from "next/navigation";
import { fetchProjectBoard } from "@/lib/actions";
import { KanbanBoard } from "@/components/task-board";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { AppShell } from "@/components/ui";
import { ProjectNavLoader } from "@/components/project-nav-loader";

export default async function ProjectBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bundle = await fetchProjectBoard(id);
  if (!bundle) notFound();

  return (
    <AppShell
      title={`${bundle.project.name} · 需求看板`}
      subtitle="开发更新进度后，此处与原型侧栏实时同步"
      nav={<ProjectNavLoader projectId={bundle.project.id} slug={bundle.project.slug} />}
    >
      <RealtimeRefresh />
      <KanbanBoard
        requirements={bundle.requirements}
        tasks={bundle.role_tasks}
        projectId={bundle.project.id}
        actorName="产品"
        actorRole="admin"
      />
    </AppShell>
  );
}
