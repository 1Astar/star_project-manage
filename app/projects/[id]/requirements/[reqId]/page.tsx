import { notFound } from "next/navigation";
import { RequirementNotionPage } from "@/components/requirement-notion-page";
import { RequirementCollabPanel } from "@/components/requirement-collab";
import { StatusBadge } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/types";
import { resolveProjectRoute } from "@/lib/project-bridge";
import { getRequirementDetail } from "@/lib/db/local-store";

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
