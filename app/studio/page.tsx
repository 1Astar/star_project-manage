import Link from "next/link";
import { StudioShell, StudioBadge } from "@/components/studio/shell";
import { NotionImportPanel } from "@/components/studio/notion-import-panel";
import {
  getMainlineProject,
  getTodayFocus,
  getRecentIdeas,
  getRecentEvolution,
  getParkedIdeas,
  getActiveProjects,
  getProjectTitle,
} from "@/lib/studio/data";
import {
  IDEA_TYPE_LABELS,
  EMOTION_LABELS,
  EVOLUTION_TYPE_LABELS,
  PROJECT_STATUS_LABELS,
} from "@/lib/studio/types";

export default async function StudioDashboardPage() {
  const [focus, mainline, recentIdeas, recentEvolution, parkedIdeas, activeProjects] =
    await Promise.all([
      getTodayFocus(),
      getMainlineProject(),
      getRecentIdeas(5),
      getRecentEvolution(5),
      getParkedIdeas(),
      getActiveProjects(),
    ]);

  const evolutionWithTitles = await Promise.all(
    recentEvolution.map(async (log) => ({
      log,
      projectName: await getProjectTitle(log.projectId),
    }))
  );

  return (
    <StudioShell title="Dashboard" subtitle="今日聚焦 · 主线 · 灵感 · 演进">
      <NotionImportPanel />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-stone-500">今日只做什么</h2>
          {focus ? (
            <div className="mt-3">
              <div className="text-lg font-bold text-stone-900">
                → {focus.project.title} {focus.project.priority}
              </div>
              <p className="mt-1 text-sm text-stone-600">
                {focus.task?.title ?? focus.project.nextAction}
              </p>
              <Link
                href={`/studio/projects/${focus.project.id}`}
                className="mt-3 inline-block text-sm text-blue-600 hover:underline"
              >
                打开项目恢复卡 →
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-sm text-stone-400">暂无主线任务</p>
          )}
        </section>

        <section className="rounded-lg border border-amber-200 bg-amber-50/30 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-amber-700">当前主线</h2>
          {mainline ? (
            <Link href={`/studio/projects/${mainline.id}`} className="mt-3 block group">
              <div className="flex items-center gap-2">
                <StudioBadge tone="mainline">{PROJECT_STATUS_LABELS.mainline}</StudioBadge>
                <StudioBadge tone="p0">{mainline.priority}</StudioBadge>
              </div>
              <div className="mt-2 text-lg font-bold text-stone-900 group-hover:text-amber-800">
                {mainline.title}
              </div>
              <p className="mt-1 text-sm text-stone-600">{mainline.positioning}</p>
              <p className="mt-2 text-sm text-stone-500">下一步：{mainline.nextAction}</p>
            </Link>
          ) : null}
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-500">灵感收件箱</h2>
            <Link href="/studio/inbox" className="text-xs text-blue-600 hover:underline">
              查看全部
            </Link>
          </div>
          <ul className="mt-3 space-y-3">
            {recentIdeas.map((idea) => (
              <li key={idea.id} className="border-b border-stone-50 pb-3 last:border-0">
                <div className="font-medium text-stone-800">{idea.title}</div>
                <p className="mt-0.5 text-xs text-stone-500">{idea.oneLineIdea}</p>
                <div className="mt-1 flex gap-2">
                  <StudioBadge>{IDEA_TYPE_LABELS[idea.type]}</StudioBadge>
                  <StudioBadge tone="warning">{EMOTION_LABELS[idea.emotionLevel]}</StudioBadge>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-stone-500">项目恢复入口</h2>
          <ul className="mt-3 space-y-3">
            {activeProjects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/studio/projects/${p.id}`}
                  className="block rounded-md border border-stone-100 p-3 hover:bg-stone-50"
                >
                  <div className="font-medium text-stone-800">{p.title}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-stone-500">
                    {p.demoUrl ? (
                      <span>🔗 {p.demoUrl.replace(/^https?:\/\//, "").slice(0, 30)}…</span>
                    ) : null}
                    {p.localRunGuide ? <span>💻 本地启动</span> : null}
                    {p.codePath ? <span>📁 代码目录</span> : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-500">灵感停车场</h2>
            <Link href="/studio/parking" className="text-xs text-blue-600 hover:underline">
              查看全部
            </Link>
          </div>
          <p className="mt-1 text-xs text-stone-400">被关起来的小怪物们</p>
          <ul className="mt-3 space-y-2">
            {parkedIdeas.slice(0, 4).map((idea) => (
              <li key={idea.id} className="text-sm text-stone-600">
                ⏸ {idea.title}
              </li>
            ))}
            {parkedIdeas.length === 0 ? (
              <li className="text-sm text-stone-400">停车场空空如也</li>
            ) : null}
          </ul>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-500">最近演进记录</h2>
            <Link href="/studio/evolution" className="text-xs text-blue-600 hover:underline">
              查看全部
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-stone-100">
            {evolutionWithTitles.map(({ log, projectName }) => (
              <li key={log.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StudioBadge>{EVOLUTION_TYPE_LABELS[log.logType]}</StudioBadge>
                  <span className="text-xs text-stone-400">{projectName}</span>
                  <span className="text-xs text-stone-300">
                    {new Date(log.createdAt).toLocaleDateString("zh-CN")}
                  </span>
                </div>
                <div className="mt-1 font-medium text-stone-800">{log.title}</div>
                <p className="mt-1 text-sm text-stone-500">
                  {log.before} → {log.after}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </StudioShell>
  );
}
