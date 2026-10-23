import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-button";
import { LearningPoolClient } from "@/components/learning-pool-client";
import { resolveProjectRoute } from "@/lib/project-bridge";
import { listProjectLearningNotes } from "@/lib/learning-notes/store";
import { getPoolBundle } from "@/lib/db/local-store";

export default async function ProjectLearningPoolPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await resolveProjectRoute(id);
  if (!ctx.studio && !ctx.pmProject && !ctx.pmSlug) notFound();

  const project = ctx.pmProject;

  if (!project) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8">
        <h2 className="text-base font-semibold text-slate-900">学习池</h2>
        <p className="mt-2 text-sm text-slate-600">
          当前项目「{ctx.studio?.title ?? id}」尚未接入 PM 需求库，暂无学习池可写。
        </p>
        <BackLink
          fallback={`/projects/${ctx.routeId}/tasks`}
          label="← 返回需求与任务"
          className="mt-4 inline-block text-sm text-indigo-600 hover:underline"
        />
      </div>
    );
  }

  const [notes, pool] = await Promise.all([
    listProjectLearningNotes(project.id),
    getPoolBundle(project.id),
  ]);

  const requirements = (pool?.poolRequirements ?? []).map((r) => ({
    id: r.id,
    title: r.title,
  }));

  return (
    <LearningPoolClient
      projectId={project.id}
      projectSlug={ctx.routeId}
      initialNotes={notes}
      requirements={requirements}
    />
  );
}
