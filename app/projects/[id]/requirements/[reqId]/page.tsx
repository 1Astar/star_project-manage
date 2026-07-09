import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchProjectBoard } from "@/lib/actions";
import { RequirementCollabPanel } from "@/components/requirement-collab";
import { StatusBadge } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/types";
import { resolveProjectRoute } from "@/lib/project-bridge";

export default async function RequirementDetailPage({
  params,
}: {
  params: Promise<{ id: string; reqId: string }>;
}) {
  const { id, reqId } = await params;
  const ctx = await resolveProjectRoute(id);
  const slug = ctx.pmSlug ?? id;
  const bundle = await fetchProjectBoard(slug);
  if (!bundle) notFound();

  const requirement = bundle.requirements.find((r) => r.id === reqId);
  if (!requirement) notFound();

  const tasks = bundle.role_tasks.filter((t) => t.requirement_id === reqId);
  const acceptanceItems = bundle.acceptance_items.filter(
    (a) => a.requirement_id === reqId
  );
  const comments = (bundle.comments ?? []).filter((c) => c.requirement_id === reqId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{requirement.title}</h2>
          <p className="text-sm text-slate-500">
            {requirement.sub_function ?? bundle.iterations[0]?.name}
          </p>
        </div>
        <StatusBadge status={requirement.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
            <h3 className="font-semibold">需求信息</h3>
            {requirement.detail_work ? (
              <p className="text-sm text-slate-600">{requirement.detail_work}</p>
            ) : null}
            {requirement.acceptance_criteria ? (
              <div>
                <div className="text-xs font-semibold uppercase text-slate-400">验收标准</div>
                <p className="mt-1 text-sm">{requirement.acceptance_criteria}</p>
              </div>
            ) : null}
          </section>

          <section className="space-y-3">
            <h3 className="font-semibold">角色任务</h3>
            {tasks.map((task) => (
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
            ))}
          </section>
        </div>

        <RequirementCollabPanel
          projectId={bundle.project.id}
          requirementId={requirement.id}
          acceptanceItems={acceptanceItems}
          comments={comments}
          actorName="管理员"
          actorRole="admin"
          canSubmitTest
          canEditAcceptance
        />
      </div>

      <div>
        <Link
          href={`/projects/${ctx.routeId}/tasks`}
          className="text-sm text-indigo-600 hover:underline"
        >
          ← 返回需求与任务
        </Link>
      </div>
    </div>
  );
}
