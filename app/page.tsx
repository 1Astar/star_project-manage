import Link from "next/link";
import { fetchDashboardData } from "@/lib/actions";
import { DbStatusBanner } from "@/components/db-status";
import { DemoDataNotice } from "@/components/demo-data-notice";
import { AppShell, ProgressRing, StatCard } from "@/components/ui";

export default async function HomePage() {
  const summaries = await fetchDashboardData();

  return (
    <AppShell
      title="项目总览"
      subtitle="按项目切换，查看完成度、阻塞项与待验收数量"
      showHomeLink={false}
      actions={
        <div className="flex gap-2">
          <Link
            href="/todos"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
          >
            我的待办
          </Link>
          <Link
            href="/notifications"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50"
          >
            通知中心
          </Link>
        </div>
      }
    >
      <div className="mb-6 space-y-3">
        <DbStatusBanner />
        <DemoDataNotice />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {summaries.map((item) =>
          item ? (
            <section key={item.project.id} className="card p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{item.project.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">{item.project.description}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/projects/${item.project.slug}`}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      进入项目
                    </Link>
                    <Link
                      href={`/projects/${item.project.slug}/board`}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
                    >
                      需求看板
                    </Link>
                    <Link
                      href={`/projects/${item.project.slug}/pool`}
                      className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-800 hover:bg-violet-100"
                    >
                      需求池
                    </Link>
                  </div>
                </div>
                <ProgressRing percent={item.stats.progressPercent} />
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="任务总数" value={item.stats.totalTasks} />
                <StatCard label="已完成" value={item.stats.doneTasks} tone="success" />
                <StatCard label="阻塞" value={item.stats.blockedTasks} tone="danger" />
                <StatCard label="待验收" value={item.stats.acceptanceTasks} tone="warning" />
              </div>

              <div className="mt-4 text-sm text-slate-500">
                {item.requirementCount} 条需求 · {item.pendingAcceptance} 项验收待核对
              </div>
            </section>
          ) : null
        )}
      </div>
    </AppShell>
  );
}
