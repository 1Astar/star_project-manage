import Link from "next/link";
import { WorkbenchShell } from "@/components/workbench-shell";
import { QuickCaptureModal } from "@/components/studio/quick-capture-modal";
import { WorkbenchStarOrCalendar } from "@/components/workbench-star-or-calendar";
import { StudioBadge } from "@/components/studio/shell";
import { WorkbenchProjectLibrary } from "@/components/workbench-project-library";
import { WorkbenchBlockers } from "@/components/workbench-blockers";
import { WorkbenchPmToday } from "@/components/workbench-pm-today";
import { WorkbenchFocusScroll } from "@/components/workbench-focus-scroll";
import { buildStarMapLayout } from "@/lib/studio/idea-star-map";
import { buildImprovementCalendar } from "@/lib/studio/improvement-calendar";
import { getAdminSession } from "@/lib/auth/session";
import {
  getAllProjects,
  getAllIdeas,
  getAllEvolutionLogs,
  getAllChangeSessions,
  getPendingAlerts,
  getNextActionDrafts,
} from "@/lib/studio/data";
import { getTomorrowAgenda } from "@/lib/workbench/tomorrow-agenda";
import {
  filterTomorrowDueOnly,
  getOpenBugsAcrossProjects,
  getPmAcceptanceQueue,
  getPmFollowUps,
} from "@/lib/workbench/pm-inbox";
import { getSuggestedMainline } from "@/lib/workbench/mainline-score";
import { PROJECT_STATUS_LABELS } from "@/lib/studio/types";
import { runWithDurableReadMemo } from "@/lib/runtime/durable-read-memo";

export default async function WorkbenchPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; focus?: string }>;
}) {
  return runWithDurableReadMemo(() => renderWorkbenchPage(searchParams));
}

async function renderWorkbenchPage(
  searchParams?: Promise<{ error?: string; focus?: string }>
) {
  const params = searchParams ? await searchParams : {};
  const session = await getAdminSession();
  const [
    suggestedMainline,
    allProjects,
    allIdeas,
    allEvolution,
    allChangeSessions,
    alerts,
    nextActionDrafts,
    tomorrowAgenda,
    acceptanceQueue,
    followUps,
    openBugs,
  ] = await Promise.all([
    getSuggestedMainline(),
    getAllProjects(),
    getAllIdeas(),
    getAllEvolutionLogs(),
    getAllChangeSessions(),
    getPendingAlerts(),
    getNextActionDrafts(),
    getTomorrowAgenda(),
    getPmAcceptanceQueue(),
    getPmFollowUps(),
    getOpenBugsAcrossProjects(),
  ]);

  const focus = suggestedMainline
    ? { project: suggestedMainline.project, task: suggestedMainline.focusTask }
    : null;

  const starMapLayout = buildStarMapLayout(allIdeas, allProjects);
  const projectTitleById = new Map(allProjects.map((p) => [p.id, p.title]));
  const improvementByDayMap = buildImprovementCalendar({
    evolution: allEvolution,
    changeSessions: allChangeSessions,
    projectTitleById,
  });
  const improvementByDay = Object.fromEntries(improvementByDayMap);

  const libraryProjects = allProjects.filter((p) => p.status !== "archived");
  const blockerItems = alerts.blockers.map((t) => ({
    taskId: t.id,
    title: t.title,
    blocker: t.blocker?.trim() || "",
    projectId: t.projectId,
    projectTitle: projectTitleById.get(t.projectId) ?? "未知项目",
  }));

  const tomorrowDue = filterTomorrowDueOnly(tomorrowAgenda.items);

  return (
    <WorkbenchShell
      title="今日工作台"
      subtitle="日历 · 项目 · 今日 / 明日"
      role={session?.role ?? "guest"}
    >
      <WorkbenchFocusScroll focus={params.focus} />
      {params.error === "keys-forbidden" ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          密钥区仅管理员可见。公开演示不展示密钥入口；需要时请右上角登录。
        </p>
      ) : null}
      <QuickCaptureModal projects={allProjects.map((p) => ({ id: p.id, label: p.title }))} />

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs font-medium text-slate-400">今日只做什么</div>
          {focus ? (
            <Link href={`/projects/${focus.project.id}`} className="mt-1 block">
              <div className="truncate text-sm font-semibold text-slate-900">
                {focus.project.title}
              </div>
              {(() => {
                const next =
                  focus.task?.title?.trim() ||
                  focus.project.nextAction?.trim() ||
                  focus.project.body?.nextStep?.trim() ||
                  "";
                const draft = nextActionDrafts[focus.project.id];
                if (next) {
                  return (
                    <p className="mt-0.5 truncate text-xs text-slate-500">{next}</p>
                  );
                }
                return (
                  <p className="mt-0.5 truncate text-xs text-amber-700/80">
                    未写下一步
                    {draft ? ` · 可参考：${draft}` : ""}
                  </p>
                );
              })()}
            </Link>
          ) : (
            <p className="mt-1 text-xs text-slate-400">暂无主线任务</p>
          )}
        </section>

        <section className="rounded-xl border border-amber-200 bg-amber-50/40 px-4 py-3">
          <div className="text-xs font-medium text-amber-700/80">当前主线 · 算法</div>
          {suggestedMainline ? (
            <Link href={`/projects/${suggestedMainline.project.id}`} className="mt-1 block">
              <div className="flex flex-wrap items-center gap-1.5">
                <StudioBadge tone="mainline">
                  {suggestedMainline.pinned
                    ? "钉主线加权"
                    : PROJECT_STATUS_LABELS[suggestedMainline.project.status]}
                </StudioBadge>
                <span className="text-[10px] text-amber-800/70">
                  分 {suggestedMainline.score}
                </span>
              </div>
              <div className="mt-1 truncate text-sm font-semibold text-slate-900">
                {suggestedMainline.project.title}
              </div>
              {suggestedMainline.reasons.length > 0 ? (
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {suggestedMainline.reasons.join(" · ")}
                </p>
              ) : null}
            </Link>
          ) : (
            <p className="mt-1 text-xs text-slate-400">暂无候选项目</p>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="text-xs font-medium text-slate-400">待处理</div>
          <p className="mt-1 text-sm text-slate-700">
            待验收{" "}
            <a href="#pm-today" className="font-semibold text-orange-700 hover:underline">
              {acceptanceQueue.bundles.length} 板块
              {acceptanceQueue.items.length
                ? `（${acceptanceQueue.items.length}）`
                : ""}
            </a>
            <span className="mx-1 text-slate-300">·</span>
            Bug{" "}
            <a href="#pm-today" className="font-semibold text-rose-700 hover:underline">
              {openBugs.length}
            </a>
            <span className="mx-1 text-slate-300">·</span>
            跟进{" "}
            <a href="#pm-today" className="font-semibold text-amber-700 hover:underline">
              {followUps.items.length}
            </a>
            <span className="mx-1 text-slate-300">·</span>
            收件箱{" "}
            <Link href="/stream" className="font-semibold text-indigo-600 hover:underline">
              {alerts.inboxCount}
            </Link>
            {blockerItems.length > 0 ? <WorkbenchBlockers items={blockerItems} /> : null}
          </p>
        </section>
      </div>

      {/* 1) 星球 / 日历 */}
      <div className="mt-6">
        <WorkbenchStarOrCalendar
          layout={starMapLayout}
          improvementByDay={improvementByDay}
        />
      </div>

      {/* 2) 项目（默认收缩） */}
      <WorkbenchProjectLibrary
        projects={libraryProjects}
        nextActionDrafts={nextActionDrafts}
      />

      {/* 3) 今日清单 + 明日待办 */}
      <div className="mt-6">
        <WorkbenchPmToday
          acceptance={acceptanceQueue.items}
          acceptanceBundles={acceptanceQueue.bundles}
          followUps={followUps.items}
          openBugs={openBugs}
          lookbackDays={acceptanceQueue.lookbackDays}
          todayDay={tomorrowAgenda.todayDay}
          tomorrowDay={tomorrowAgenda.tomorrowDay}
          tomorrowItems={tomorrowDue}
        />
      </div>
    </WorkbenchShell>
  );
}
