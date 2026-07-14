import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchProjectBoard } from "@/lib/actions";
import { KanbanBoard } from "@/components/task-board";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { ProjectIdeasSection } from "@/components/studio/project-ideas-section";
import { ProjectTaskBoard } from "@/components/studio/project-task-board";
import { resolveProjectRoute } from "@/lib/project-bridge";
import { getProjectIdeas, getProjectTasks } from "@/lib/studio/data";

export default async function ProjectTasksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await resolveProjectRoute(id);
  if (!ctx.studio && !ctx.pmBundle) notFound();

  const pmBundle = ctx.pmSlug ? await fetchProjectBoard(ctx.pmSlug) : ctx.pmBundle;
  const studioTasks = ctx.studio ? await getProjectTasks(ctx.studio.id) : [];
  const ideas = ctx.studio ? await getProjectIdeas(ctx.studio.id) : [];

  return (
    <div className="space-y-8">
      {ctx.studio ? (
        <ProjectIdeasSection
          projectId={ctx.studio.id}
          projectTitle={ctx.studio.title}
          ideas={ideas}
        />
      ) : null}

      {pmBundle ? (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">PM 需求看板</h2>
            <Link
              href={`/projects/${ctx.pmSlug ?? id}/pool`}
              className="text-sm text-indigo-600 hover:underline"
            >
              打开需求池 →
            </Link>
          </div>
          <RealtimeRefresh />
          <KanbanBoard
            requirements={pmBundle.requirements}
            tasks={pmBundle.role_tasks}
            projectId={pmBundle.project.id}
            actorName="产品"
            actorRole="admin"
          />
        </section>
      ) : null}

      {ctx.studio ? (
        <section>
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Studio 需求任务</h2>
          <ProjectTaskBoard
            projectId={ctx.studio.id}
            tasks={studioTasks}
            hasGitHub={!!ctx.studio.githubRepo}
          />
        </section>
      ) : null}

      {!pmBundle && !ctx.studio ? (
        <p className="text-sm text-slate-500">暂无任务数据</p>
      ) : null}
    </div>
  );
}
