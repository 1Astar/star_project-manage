import { notFound } from "next/navigation";
import { validateShareToken } from "@/lib/actions";
import { getRequirementDetail, getBugById } from "@/lib/db";
import { AppShell, StatusBadge } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/types";

export default async function ShareItemPage({
  params,
}: {
  params: Promise<{ token: string; itemId: string }>;
}) {
  const { token, itemId } = await params;
  const shareData = await validateShareToken(token);
  if (!shareData?.bundle) notFound();

  const requirementDetail = await getRequirementDetail(itemId);
  const bugDetail = itemId.startsWith("bug-") ? await getBugById(itemId) : null;

  if (requirementDetail?.project?.id !== shareData.bundle.project.id && !bugDetail) {
    notFound();
  }

  if (bugDetail?.bug) {
    return (
      <AppShell
        title={`Bug #${bugDetail.bug.id.slice(-6)}`}
        subtitle={bugDetail.project?.name}
      >
        <div className="card space-y-4 p-6">
          <h2 className="text-lg font-bold">{bugDetail.bug.title}</h2>
          <StatusBadge status={bugDetail.bug.status} />
          {bugDetail.bug.description ? (
            <p className="text-sm text-slate-600">{bugDetail.bug.description}</p>
          ) : null}
          {bugDetail.bug.repro_steps ? (
            <div>
              <div className="text-xs font-semibold text-slate-400">复现步骤</div>
              <pre className="mt-1 whitespace-pre-wrap text-sm">{bugDetail.bug.repro_steps}</pre>
            </div>
          ) : null}
          <div className="text-sm text-slate-500">
            责任人：{bugDetail.bug.assignee ?? "未分配"}
          </div>
          {bugDetail.requirement ? (
            <div className="text-sm">
              关联需求：
              <span className="font-medium">{bugDetail.requirement.title}</span>
            </div>
          ) : null}
        </div>
      </AppShell>
    );
  }

  if (!requirementDetail?.requirement) notFound();

  const { requirement, role_tasks, acceptance_items, test_records } = requirementDetail;

  return (
    <AppShell
      title={requirement.title}
      subtitle={`${shareData.link.label} · 需求详情`}
      actions={<StatusBadge status={requirement.status} />}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5 space-y-3">
          <h2 className="font-semibold">需求描述</h2>
          {requirement.sub_function ? (
            <p className="text-sm">{requirement.sub_function}</p>
          ) : null}
          {requirement.acceptance_criteria ? (
            <div>
              <div className="text-xs font-semibold text-slate-400">验收标准</div>
              <p className="mt-1 text-sm">{requirement.acceptance_criteria}</p>
            </div>
          ) : null}
        </section>

        <section className="card p-5 space-y-3">
          <h2 className="font-semibold">角色任务</h2>
          {role_tasks.map((t) => (
            <div key={t.id} className="flex items-center justify-between text-sm">
              <span>
                {ROLE_LABELS[t.role]}
                {t.assignee ? ` · ${t.assignee}` : ""}
              </span>
              <StatusBadge status={t.status} />
            </div>
          ))}
        </section>

        <section className="card p-5 space-y-3 lg:col-span-2">
          <h2 className="font-semibold">验收项</h2>
          {acceptance_items.map((a) => (
            <div key={a.id} className="text-sm">
              {a.description}
              {a.passed === true ? (
                <span className="ml-2 text-green-600">✓ 通过</span>
              ) : a.passed === false ? (
                <span className="ml-2 text-red-600">✗ 退回</span>
              ) : (
                <span className="ml-2 text-slate-400">待验收</span>
              )}
            </div>
          ))}
        </section>

        {test_records.length > 0 ? (
          <section className="card p-5 space-y-3 lg:col-span-2">
            <h2 className="font-semibold">测试记录</h2>
            {test_records.map((t) => (
              <div key={t.id} className="text-sm">
                <span className={t.passed ? "text-green-600" : "text-red-600"}>
                  {t.passed ? "通过" : "不通过"}
                </span>
                {" · "}
                {t.tester_name}
                {t.issue_description ? ` — ${t.issue_description}` : ""}
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
