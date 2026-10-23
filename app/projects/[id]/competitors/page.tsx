import { notFound } from "next/navigation";
import { CompetitorsHubClient } from "@/components/competitors-hub-client";
import { resolveProjectRoute } from "@/lib/project-bridge";
import { listCompetitorEntries } from "@/lib/competitors/store";
import { listProjectLearningNotes } from "@/lib/learning-notes/store";
import {
  getPoolBundle,
  listBugsByProject,
} from "@/lib/db/local-store";

export default async function ProjectCompetitorsPage({
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
        <h2 className="text-base font-semibold text-slate-900">竞品分析</h2>
        <p className="mt-2 text-sm text-slate-600">
          当前项目尚未接入 PM 需求库，暂无竞品条目可写。市场/功能工具入口需接入后可用。
        </p>
      </div>
    );
  }

  const [entries, notes, pool, bugs] = await Promise.all([
    listCompetitorEntries(project.id),
    listProjectLearningNotes(project.id),
    getPoolBundle(project.id),
    listBugsByProject(project.id),
  ]);

  const learningOptions = notes.map((n) => ({
    id: n.id,
    title: n.title,
    href: `/projects/${ctx.routeId}/learning`,
  }));
  const requirementOptions = (pool?.poolRequirements ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    href: `/projects/${ctx.routeId}/requirements/${r.id}`,
  }));
  const bugOptions = bugs.map((b) => ({
    id: b.id,
    title: b.title,
    href: `/projects/${ctx.routeId}/bugs/${b.id}`,
  }));

  return (
    <CompetitorsHubClient
      routeId={ctx.routeId}
      projectId={project.id}
      entries={entries}
      learningOptions={learningOptions}
      requirementOptions={requirementOptions}
      bugOptions={bugOptions}
    />
  );
}
