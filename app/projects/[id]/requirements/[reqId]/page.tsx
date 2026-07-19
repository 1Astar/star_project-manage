import Link from "next/link";
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

  const backHref = `/projects/${ctx.routeId}/tasks?req=${requirement.id}`;

  return (
    <div className="space-y-10">
      <RequirementNotionPage
        projectSlug={slug}
        requirement={requirement}
        backHref={backHref}
      />

      <div className="mx-auto grid max-w-3xl gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="space-y-3">
          <h3 className="font-semibold text-slate-800">角色任务（可选）</h3>
          {tasks.length === 0 ? (
            <p className="text-sm text-slate-500">未拆任务亦可直接推进需求状态标签</p>
          ) : (
            tasks.map((task) => (
              <div key={task.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium">
                    {ROLE_LABELS[task.role]}
                    {task.assignee ? ` · ${task.assignee}` : ""}
                  </div>
                  <StatusBadge status={task.status} />
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  {task.estimate_hours != null ? `预估 ${task.estimate_hours}h` : null}
                  {task.notes ? ` · ${task.notes}` : null}
                </div>
              </div>
            ))
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
      </div>

      <div className="mx-auto max-w-3xl">
        <Link href={backHref} className="text-sm text-indigo-600 hover:underline">
          ← 返回需求列表
        </Link>
      </div>
    </div>
  );
}
