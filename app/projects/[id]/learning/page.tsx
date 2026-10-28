import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-button";
import { LearningPoolClient } from "@/components/learning-pool-client";
import { resolveProjectRoute } from "@/lib/project-bridge";
import {
  listLearningAttachmentsForProject,
  listProjectLearningNotes,
} from "@/lib/learning-notes/store";
import { listCompetitorEntries } from "@/lib/competitors/store";
import {
  listHubBugs,
  listHubRequirements,
} from "@/lib/modules/load-module-home-data";

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

  const [notes, hubReqs, attachments, competitors, bugs] = await Promise.all([
    listProjectLearningNotes(project.id),
    listHubRequirements(project.id),
    listLearningAttachmentsForProject(project.id),
    listCompetitorEntries(project.id),
    listHubBugs(project.id),
  ]);

  const requirements = hubReqs.map((r) => ({
    id: r.id,
    title: r.title,
    href: `/projects/${ctx.routeId}/requirements/${r.id}`,
    kind: "requirement" as const,
    fields: [
      { key: "detail", label: "详情", value: "", multiline: true },
    ],
  }));
  const competitorOptions = competitors.map((c) => ({
    id: c.id,
    title: c.title,
    href: `/projects/${ctx.routeId}/competitors`,
    kind: "competitor" as const,
    fields: [
      { key: "summary", label: "摘要", value: c.summary ?? "", multiline: true },
      { key: "url", label: "外链", value: c.url ?? "" },
    ],
  }));
  const bugOptions = bugs.map((b) => ({
    id: b.id,
    title: b.title,
    href: `/projects/${ctx.routeId}/bugs/${b.id}`,
    kind: "bug" as const,
    fields: [
      {
        key: "actual",
        label: "现状 / 实际",
        value: "",
        multiline: true,
      },
      {
        key: "suggestion",
        label: "优化建议",
        value: "",
        multiline: true,
      },
    ],
  }));

  return (
    <LearningPoolClient
      projectId={project.id}
      projectSlug={ctx.routeId}
      initialNotes={notes}
      initialAttachments={attachments}
      requirements={requirements}
      competitorOptions={competitorOptions}
      bugOptions={bugOptions}
    />
  );
}
