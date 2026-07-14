import Link from "next/link";
import { WorkbenchShell } from "@/components/workbench-shell";
import { QuickCaptureModal } from "@/components/studio/quick-capture-modal";
import { IdeaStarMap } from "@/components/studio/idea-star-map";
import { ProjectLibraryCard } from "@/components/project-library-card";
import { StudioBadge } from "@/components/studio/shell";
import { buildStarMapLayout } from "@/lib/studio/idea-star-map";
import {
  getTodayFocus,
  getMainlineProject,
  getRecentIdeas,
  getRecentEvolution,
  getAllProjects,
  getAllIdeas,
  getProjectTitle,
  getPendingAlerts,
  getRecentGitUpdates,
} from "@/lib/studio/data";
import {
  IDEA_TYPE_LABELS,
  EVOLUTION_TYPE_LABELS,
  PROJECT_STATUS_LABELS,
} from "@/lib/studio/types";

export default async function WorkbenchPage() {
  const [
    focus,
    mainline,
    recentIdeas,
    recentEvolution,
    allProjects,
    allIdeas,
    alerts,
    gitUpdates,
  ] = await Promise.all([
    getTodayFocus(),
    getMainlineProject(),
    getRecentIdeas(5),
    getRecentEvolution(5),
    getAllProjects(),
    getAllIdeas(),
    getPendingAlerts(),
    getRecentGitUpdates(5),
  ]);

  const starMapLayout = buildStarMapLayout(allIdeas, allProjects);

  const evolutionWithTitles = await Promise.all(
    recentEvolution.map(async (log) => ({
      log,
      projectName: await getProjectTitle(log.projectId),
    }))
  );

  const libraryProjects = [...allProjects]
    .filter((p) => p.status !== "archived")
    .sort((a, b) => {
      const order = { mainline: 0, active: 1, demo: 2, parking: 3, archived: 4 };
      return order[a.status] - order[b.status] || a.priority.localeCompare(b.priority);
    });

  return (
    <WorkbenchShell title="今日工作台" subtitle="灵感 · 项目 · 任务 · 恢复现场">
      <QuickCaptureModal projects={allProjects.map((p) => ({ id: p.id, label: p.title }))} />

      <div className="mt-6">
        <IdeaStarMap layout={starMapLayout} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-500">今日只做什么</h2>
          {focus ? (
            <div className="mt-3">
              <div className="text-lg font-bold text-slate-900">
                → {focus.project.title}{" "}
                <StudioBadge tone={focus.project.priority === "P0" ? "p0" : "default"}>
                  {focus.project.priority}
                </StudioBadge>
              </div>
              <p className="mt-2 text-sm text-slate-600">
                {focus.task?.title ?? focus.project.nextAction}
              </p>
              <Link
                href={`/projects/${focus.project.id}`}
                className="mt-3 inline-block text-sm text-indigo-600 hover:underline"
              >
                打开项目恢复 →
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">暂无主线任务</p>
          )}
        </section>

        <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-6">
          <h2 className="text-sm font-semibold text-amber-800">当前主线</h2>
          {mainline ? (
            <Link href={`/projects/${mainline.id}`} className="mt-3 block group">
              <StudioBadge tone="mainline">{PROJECT_STATUS_LABELS.mainline}</StudioBadge>
              <div className="mt-2 text-lg font-bold text-slate-900 group-hover:text-amber-900">
                {mainline.title}
              </div>
              <p className="mt-1 text-sm text-slate-600">{mainline.positioning}</p>
              <p className="mt-2 text-sm text-slate-500">下一步：{mainline.nextAction}</p>
            </Link>
          ) : (
            <p className="mt-3 text-sm text-slate-400">未设置主线项目</p>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-500">待处理提醒</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li>
              收件箱新灵感：
              <Link href="/stream" className="ml-1 font-medium text-indigo-600 hover:underline">
                {alerts.inboxCount} 条
              </Link>
            </li>
            {alerts.blockers.slice(0, 3).map((t) => (
              <li key={t.id} className="text-red-600">
                阻塞：{t.title}
              </li>
            ))}
            {alerts.blockers.length === 0 && alerts.inboxCount === 0 ? (
              <li className="text-slate-400">暂无紧急提醒</li>
            ) : null}
            <li>
              <Link href="/todos" className="text-indigo-600 hover:underline">
                打开我的待办 →
              </Link>
            </li>
          </ul>
        </section>
      </div>

      <section className="mt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-500">项目库</h2>
          <Link href="/projects" className="text-xs text-indigo-600 hover:underline">
            查看全部
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {libraryProjects.slice(0, 4).map((p) => (
            <ProjectLibraryCard key={p.id} project={p} />
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-500">最近灵感</h2>
            <Link href="/stream" className="text-xs text-indigo-600 hover:underline">
              收件箱
            </Link>
          </div>
          <ul className="mt-3 space-y-3">
            {recentIdeas.map((idea) => (
              <li key={idea.id} className="border-b border-slate-50 pb-3 last:border-0">
                <div className="font-medium text-slate-800">{idea.title}</div>
                <p className="mt-0.5 text-xs text-slate-500">{idea.oneLineIdea}</p>
                <div className="mt-1 flex gap-2">
                  <StudioBadge>{IDEA_TYPE_LABELS[idea.type]}</StudioBadge>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-500">最近演进</h2>
            <Link href="/evolution" className="text-xs text-indigo-600 hover:underline">
              全部
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-slate-100">
            {evolutionWithTitles.map(({ log, projectName }) => (
              <li key={log.id} className="py-3">
                <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                  <StudioBadge>{EVOLUTION_TYPE_LABELS[log.logType]}</StudioBadge>
                  {projectName}
                </div>
                <div className="mt-1 text-sm font-medium text-slate-800">{log.title}</div>
                <p className="mt-1 text-xs text-slate-500">
                  {log.before} → {log.after}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-500">最近 Git 更新</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {gitUpdates.map((item) => (
              <li key={item.projectId}>
                <Link
                  href={`/projects/${item.projectId}`}
                  className="font-medium text-slate-800 hover:text-indigo-700"
                >
                  {item.title}
                </Link>
                <p className="mt-0.5 text-xs text-slate-500">{item.message}</p>
              </li>
            ))}
            {gitUpdates.length === 0 ? (
              <li className="text-slate-400">暂无 Git 记录</li>
            ) : null}
          </ul>
        </section>
      </div>
    </WorkbenchShell>
  );
}
