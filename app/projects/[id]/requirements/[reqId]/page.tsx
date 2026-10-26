import { notFound } from "next/navigation";
import { RequirementNotionPage } from "@/components/requirement-notion-page";
import { RequirementCollabPanel } from "@/components/requirement-collab";
import { RequirementCrossLinks } from "@/components/requirement-cross-links";
import { StatusBadge } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/types";
import { resolveProjectRoute } from "@/lib/project-bridge";
import { getRequirementDetail, listBugsByProject } from "@/lib/db/local-store";
import { listProjectLearningNotes } from "@/lib/learning-notes/store";
import { listCompetitorEntries } from "@/lib/competitors/store";

const LEARNING_KIND_BADGE: Record<string, string> = {
  section: "板块",
  topic: "主题",
  point: "子知识",
};

export default async function RequirementDetailPage({
  params,
}: {
  params: Promise<{ id: string; reqId: string }>;
}) {
  const { id, reqId } = await params;
  const ctx = await resolveProjectRoute(id);
  const detail = await getRequirementDetail(reqId);
  if (!detail?.requirement || !detail.project) notFound();

  const { requirement, project } = detail;
  const slug = ctx.pmSlug ?? project.slug;
  const tasks = detail.role_tasks;
  const acceptanceItems = detail.acceptance_items;
  const comments = detail.comments;
  const relatedBugs = detail.bugs.map((b) => ({
    id: b.id,
    title: b.title,
    status: b.status,
  }));

  const [learnings, competitors, allBugs] = await Promise.all([
    listProjectLearningNotes(project.id),
    listCompetitorEntries(project.id),
    listBugsByProject(project.id),
  ]);

  const linkedLearningIds = learnings
    .filter((n) => (n.linked_requirement_ids ?? []).includes(requirement.id))
    .map((n) => n.id);
  const linkedCompetitorIds = competitors
    .filter((n) => (n.linked_requirement_ids ?? []).includes(requirement.id))
    .map((n) => n.id);
  const linkedBugIds = allBugs
    .filter((b) => b.requirement_id === requirement.id)
    .map((b) => b.id);

  const competitorLinkedReqIds: Record<string, string[]> = {};
  for (const c of competitors) {
    competitorLinkedReqIds[c.id] = c.linked_requirement_ids ?? [];
  }

  const learningOptions = learnings
    .filter((n) => n.kind !== "section")
    .map((n) => ({
      id: n.id,
      title: n.title,
      kind: "learning" as const,
      badge: LEARNING_KIND_BADGE[n.kind] ?? n.kind,
      href: `/projects/${ctx.routeId}/learning`,
      fields: [
        { key: "why_text", label: "为什么", value: n.why_text ?? "", multiline: true },
        { key: "principle", label: "原理", value: n.principle ?? "", multiline: true },
      ],
    }));
  const competitorOptions = competitors.map((n) => ({
    id: n.id,
    title: n.title,
    kind: "competitor" as const,
    href: `/projects/${ctx.routeId}/competitors`,
    fields: [
      {
        key: "summary",
        label: "摘要",
        value: n.summary ?? "",
        multiline: true,
      },
    ],
  }));
  const bugOptions = allBugs.map((b) => ({
    id: b.id,
    title: b.title,
    kind: "bug" as const,
    href: `/projects/${ctx.routeId}/bugs/${b.id}`,
    fields: [
      {
        key: "description",
        label: "描述",
        value: b.description ?? "",
        multiline: true,
      },
    ],
  }));

  const backHref = `/projects/${ctx.routeId}/tasks?req=${requirement.id}`;

  return (
    <RequirementNotionPage
      projectSlug={slug}
      projectRouteId={ctx.routeId}
      projectName={project.name}
      requirement={requirement}
      backHref={backHref}
      iterationName={detail.iteration?.name ?? null}
      moduleL1Name={detail.moduleL1?.name ?? null}
      moduleL2Name={detail.moduleL2?.name ?? null}
      relatedBugs={relatedBugs}
      sidebar={
        <>
          <RequirementCrossLinks
            projectSlug={slug}
            projectRouteId={ctx.routeId}
            requirementId={requirement.id}
            linkedLearningIds={linkedLearningIds}
            linkedCompetitorIds={linkedCompetitorIds}
            linkedBugIds={linkedBugIds}
            learningOptions={learningOptions}
            competitorOptions={competitorOptions}
            bugOptions={bugOptions}
            competitorLinkedReqIds={competitorLinkedReqIds}
          />

          <section className="rounded-xl border border-slate-200 bg-white p-3">
            <h3 className="mb-2 text-xs font-semibold text-slate-500">角色任务</h3>
            {tasks.length === 0 ? (
              <p className="text-xs text-slate-500">未拆任务亦可直接推进状态</p>
            ) : (
              <ul className="space-y-1.5">
                {tasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-1.5"
                  >
                    <div className="min-w-0 text-xs">
                      <div className="font-medium text-slate-800">
                        {ROLE_LABELS[task.role]}
                        {task.assignee ? ` · ${task.assignee}` : ""}
                      </div>
                      <div className="mt-0.5 text-slate-500">
                        {task.estimate_hours != null ? `预估 ${task.estimate_hours}h` : null}
                        {task.notes ? ` · ${task.notes}` : null}
                      </div>
                    </div>
                    <StatusBadge status={task.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <RequirementCollabPanel
            projectId={project.id}
            requirementId={requirement.id}
            acceptanceItems={acceptanceItems}
            comments={comments}
            actorName="管理员"
            actorRole="admin"
            canSubmitTest
            canEditAcceptance
          />
        </>
      }
    />
  );
}
