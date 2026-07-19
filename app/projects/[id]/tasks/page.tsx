import { Suspense } from "react";
import { notFound } from "next/navigation";
import { fetchPoolDataWithIdeaSync, fetchProjectBoard } from "@/lib/actions";
import { ProjectTasksViews } from "@/components/project-tasks-views";
import { resolveProjectRoute } from "@/lib/project-bridge";
import { getProjectEvolution, getProjectIdeas, getProjectReleases, getProjectTasks } from "@/lib/studio/data";

export default async function ProjectTasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ req?: string; view?: string }>;
}) {
  const { id } = await params;
  await searchParams;
  const ctx = await resolveProjectRoute(id);
  if (!ctx.studio && !ctx.pmBundle) notFound();

  const pmSlug = ctx.pmSlug ?? null;
  const ideas = ctx.studio ? await getProjectIdeas(ctx.studio.id) : [];
  const evolutions = ctx.studio ? await getProjectEvolution(ctx.studio.id) : [];
  const [pmBundle, poolSync, studioTasks] = await Promise.all([
    pmSlug ? fetchProjectBoard(pmSlug) : Promise.resolve(ctx.pmBundle),
    pmSlug
      ? fetchPoolDataWithIdeaSync(
          pmSlug,
          ideas.map((i) => ({
            id: i.id,
            title: i.title,
            oneLineIdea: i.oneLineIdea,
            whyItMatters: i.whyItMatters,
            triggerSource: i.triggerSource,
            suggestedNextStep: i.suggestedNextStep,
            priority: i.priority,
            occurredAt: i.occurredAt,
            completedAt: i.completedAt,
            status: i.status,
          })),
          evolutions.map((e) => ({
            id: e.id,
            title: e.title,
            before: e.before,
            after: e.after,
            reason: e.reason,
            decision: e.decision,
            createdAt: e.createdAt,
          }))
        )
      : Promise.resolve(null),
    ctx.studio ? getProjectTasks(ctx.studio.id) : Promise.resolve([]),
  ]);

  const studioReleases = ctx.studio ? await getProjectReleases(ctx.studio.id) : [];

  const poolBundle = poolSync?.bundle ?? null;
  const syncInfo = poolSync?.sync ?? null;

  if (!poolBundle || !pmBundle) {
    return <p className="text-sm text-slate-500">暂无任务数据</p>;
  }

  return (
    <div className="space-y-8">
      <Suspense fallback={<div className="h-40 rounded-xl bg-slate-50" />}>
        <ProjectTasksViews
          routeId={ctx.routeId}
          projectId={poolBundle.project.id}
          projectSlug={poolBundle.project.slug}
          poolRequirements={poolBundle.poolRequirements}
          poolModules={poolBundle.poolModules}
          activeIterations={poolBundle.activeIterations}
          columnDefs={poolBundle.poolColumnDefs}
          tagOptions={poolBundle.tagOptions}
          attachments={poolBundle.attachments ?? []}
          members={poolBundle.project_members ?? []}
          boardRequirements={pmBundle.requirements}
          boardTasks={pmBundle.role_tasks}
          syncInfo={syncInfo}
          links={poolBundle.links ?? []}
          timelineEntities={[
            ...ideas.map((i) => ({
              id: i.id,
              kind: "idea" as const,
              title: i.title,
              at: i.occurredAt ?? i.createdAt ?? null,
              note: i.oneLineIdea ?? i.whyItMatters ?? null,
            })),
            ...evolutions.map((e) => ({
              id: e.id,
              kind: "evolution" as const,
              title: e.title,
              at: e.createdAt ?? null,
              note: e.reason ?? e.decision ?? null,
            })),
            ...studioTasks.map((t) => ({
              id: t.id,
              kind: "studio_task" as const,
              title: t.title,
              at: t.dueDate ?? t.endDate ?? t.startDate ?? t.completedAt ?? null,
              note: t.progressNote ?? null,
            })),
          ]}
          studioProjectId={ctx.studio?.id ?? null}
          studioTasks={studioTasks}
          studioHasGitHub={!!ctx.studio?.githubRepo}
          studioReleases={studioReleases}
        />
      </Suspense>
    </div>
  );
}
