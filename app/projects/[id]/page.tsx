import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchProjectBoard } from "@/lib/actions";
import { AppShell, StatCard } from "@/components/ui";
import { ProjectNavLoader } from "@/components/project-nav-loader";
import { calcProjectStats } from "@/lib/utils";
import { StatusBadge } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/types";

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bundle = await fetchProjectBoard(id);
  if (!bundle) notFound();

  const stats = calcProjectStats(bundle.role_tasks);
  const pendingAcceptance = bundle.requirements.filter((r) => r.status === "acceptance");

  return (
    <AppShell
      title={bundle.project.name}
      subtitle={bundle.iterations[0]?.name ?? "当前迭代"}
      nav={<ProjectNavLoader projectId={bundle.project.id} slug={bundle.project.slug} />}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="整体进度" value={`${stats.progressPercent}%`} />
        <StatCard label="阻塞项" value={stats.blockedTasks} tone="danger" />
        <StatCard label="待测试" value={stats.testingTasks} tone="warning" />
        <StatCard label="待验收" value={stats.acceptanceTasks} tone="warning" />
        <StatCard label="已完成" value={stats.doneTasks} tone="success" />
      </div>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">待你验收</h2>
          <Link href={`/projects/${bundle.project.slug}/board`} className="text-sm text-blue-600">
            查看全部
          </Link>
        </div>
        <div className="space-y-3">
          {pendingAcceptance.length === 0 ? (
            <div className="card p-6 text-sm text-slate-500">暂无待验收需求</div>
          ) : (
            pendingAcceptance.map((req) => (
              <Link
                key={req.id}
                href={`/projects/${bundle.project.slug}/requirements/${req.id}`}
                className="card flex items-center justify-between p-4 hover:border-blue-200"
              >
                <div>
                  <div className="font-medium">{req.title}</div>
                  {req.sub_function ? (
                    <div className="text-sm text-slate-500">{req.sub_function}</div>
                  ) : null}
                </div>
                <StatusBadge status={req.status} />
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-semibold">需求列表</h2>
        <div className="card overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">需求</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">角色任务</th>
              </tr>
            </thead>
            <tbody>
              {bundle.requirements.map((req) => {
                const tasks = bundle.role_tasks.filter((t) => t.requirement_id === req.id);
                return (
                  <tr key={req.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <Link
                        href={`/projects/${bundle.project.slug}/requirements/${req.id}`}
                        className="font-medium text-slate-900 hover:text-blue-600"
                      >
                        {req.title}
                      </Link>
                      {req.sub_function ? (
                        <div className="text-slate-500">{req.sub_function}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {tasks.map((t) => ROLE_LABELS[t.role]).join("、") || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
