import { notFound } from "next/navigation";
import { fetchBugDetail } from "@/lib/actions";
import { BugDetailEditor } from "@/components/bug-side-form";
import { resolveProjectRoute } from "@/lib/project-bridge";
import {
  getProjectMembers,
  listProjectIterations,
  listProjectRequirementOptions,
} from "@/lib/db/local-store";
import { listBugTestPlans } from "@/lib/bugs/test-plans";
import { resolveFeatureModules } from "@/lib/studio/project-modules";
import { listProjectLearningNotes } from "@/lib/learning-notes/store";
import { listCompetitorEntries } from "@/lib/competitors/store";

export default async function BugDetailPage({
  params,
}: {
  params: Promise<{ id: string; bugId: string }>;
}) {
  const { id, bugId } = await params;
  const ctx = await resolveProjectRoute(id);
  const detail = await fetchBugDetail(bugId);
  if (!detail?.bug || !detail.project) notFound();

  const [
    members,
    requirements,
    testPlans,
    iterations,
    learningNotes,
    competitors,
  ] = await Promise.all([
    getProjectMembers(detail.project.id),
    listProjectRequirementOptions(detail.project.id),
    listBugTestPlans(detail.project.id, { includeArchived: true }),
    listProjectIterations(detail.project.id),
    listProjectLearningNotes(detail.project.id),
    listCompetitorEntries(detail.project.id),
  ]);
  const featureModules = resolveFeatureModules(
    ctx.studio?.id ?? detail.project.id,
    ctx.studio?.featureModules,
    ctx.studio?.githubRepo
  );

  const kindBadge =
    { section: "板块", topic: "主题", point: "子知识" } as const;
  const learningOptions = learningNotes.map((n) => ({
    id: n.id,
    title: n.title,
    href: `/projects/${ctx.routeId}/learning`,
    kind: "learning" as const,
    badge: kindBadge[n.kind] ?? n.kind,
    fields: [
      { key: "why_text", label: "为什么", value: n.why_text ?? "", multiline: true },
      { key: "principle", label: "原理", value: n.principle ?? "", multiline: true },
      { key: "protocol", label: "协议", value: n.protocol ?? "", multiline: true },
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

  return (
    <BugDetailEditor
      bug={detail.bug}
      projectId={detail.project.id}
      projectSlug={ctx.routeId}
      projectName={detail.project.name}
      requirementTitle={detail.requirement?.title ?? null}
      members={members.map((m) => ({ name: m.name }))}
      requirements={requirements}
      featureModules={featureModules}
      testPlans={testPlans}
      iterations={iterations}
      comments={detail.comments ?? []}
      attachments={detail.attachments ?? []}
      learningOptions={learningOptions}
      competitorOptions={competitorOptions}
    />
  );
}
