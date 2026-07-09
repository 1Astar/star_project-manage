import Link from "next/link";
import { getMyTodos, getProjects } from "@/lib/db/local-store";
import { WorkbenchShell } from "@/components/workbench-shell";
import { StatusBadge } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/types";

export default async function TodosPage() {
  const { pendingTasks, pendingAcceptance, unreadNotifications } = await getMyTodos();
  const projects = await getProjects();
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  return (
    <WorkbenchShell
      title="我的待办"
      subtitle="任务、待验收与未读通知 — 全局唯一入口"
      actions={
        <Link href="/notifications" className="text-sm text-indigo-600 hover:underline">
          通知中心 →
        </Link>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-800">进行中任务</h2>
          <div className="mt-3 space-y-2">
            {pendingTasks.slice(0, 20).map((t) => (
              <div key={t.id} className="text-sm">
                <div className="font-medium">
                  {ROLE_LABELS[t.role]}
                  {t.assignee ? ` · ${t.assignee}` : ""}
                </div>
                <StatusBadge status={t.status} />
              </div>
            ))}
            {pendingTasks.length === 0 ? (
              <p className="text-sm text-slate-500">暂无待办任务</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-800">待产品验收</h2>
          <div className="mt-3 space-y-2">
            {pendingAcceptance.map((r) => {
              const project = projectMap.get(r.project_id);
              return (
                <Link
                  key={r.id}
                  href={`/projects/${project?.slug ?? r.project_id}/requirements/${r.id}`}
                  className="block rounded-xl border border-slate-100 p-2 text-sm hover:border-indigo-200"
                >
                  <div className="font-medium">{r.title}</div>
                  <div className="text-slate-500">{project?.name}</div>
                </Link>
              );
            })}
            {pendingAcceptance.length === 0 ? (
              <p className="text-sm text-slate-500">暂无待验收</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-800">未读通知</h2>
          <div className="mt-3 space-y-2">
            {unreadNotifications.slice(0, 10).map((n) => (
              <div key={n.id} className="text-sm">
                <div className="font-medium">{n.title}</div>
                {n.body ? <div className="text-slate-500">{n.body}</div> : null}
                {n.link ? (
                  <Link href={n.link} className="text-indigo-600 hover:underline">
                    查看
                  </Link>
                ) : null}
              </div>
            ))}
            {unreadNotifications.length === 0 ? (
              <p className="text-sm text-slate-500">暂无未读</p>
            ) : null}
          </div>
        </section>
      </div>
    </WorkbenchShell>
  );
}
