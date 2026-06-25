import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchProjectBoard } from "@/lib/actions";
import { RequirementDetailClient } from "@/components/requirement-detail";
import { AppShell, StatusBadge } from "@/components/ui";
import { ProjectNavLoader } from "@/components/project-nav-loader";
import { ROLE_LABELS } from "@/lib/types";

export default async function RequirementDetailPage({
  params,
}: {
  params: Promise<{ id: string; reqId: string }>;
}) {
  const { id, reqId } = await params;
  const bundle = await fetchProjectBoard(id);
  if (!bundle) notFound();

  const requirement = bundle.requirements.find((r) => r.id === reqId);
  if (!requirement) notFound();

  const tasks = bundle.role_tasks.filter((t) => t.requirement_id === reqId);
  const acceptanceItems = bundle.acceptance_items.filter(
    (a) => a.requirement_id === reqId
  );

  return (
    <AppShell
      title={requirement.title}
      subtitle={requirement.sub_function ?? bundle.iterations[0]?.name}
      nav={<ProjectNavLoader projectId={bundle.project.id} slug={bundle.project.slug} />}
      actions={<StatusBadge status={requirement.status} />}
    >
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <section className="card p-5 space-y-3">
            <h2 className="font-semibold">需求信息</h2>
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
            <h2 className="font-semibold">角色任务</h2>
            {tasks.map((task) => (
              <div key={task.id} className="card p-4">
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

        <RequirementDetailClient
          projectId={bundle.project.id}
          requirementId={requirement.id}
          acceptanceItems={acceptanceItems}
        />
      </div>

      <div className="mt-6">
        <Link href={`/projects/${bundle.project.slug}/board`} className="text-sm text-blue-600">
          ← 返回看板
        </Link>
      </div>
    </AppShell>
  );
}
