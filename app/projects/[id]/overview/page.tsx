import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchPoolData, fetchProjectBoard, fetchProjectBugs } from "@/lib/actions";
import { StudioBadge } from "@/components/studio/shell";
import { PortfolioPromptPanel } from "@/components/studio/portfolio-prompt-panel";
import { resolveProjectRoute } from "@/lib/project-bridge";
import { getProjectTasks } from "@/lib/studio/data";
import { listProjectAttachments } from "@/lib/db/local-store";
import { describeActivity } from "@/lib/activity";
import {
  ROLE_LABELS,
  TASK_STATUS_LABELS,
  requirementIsDone,
  type RoleType,
  type TaskStatus,
} from "@/lib/types";

function statusProgress(status: string) {
  if (status === "done") return 100;
  if (status === "acceptance") return 85;
  if (status === "testing") return 70;
  if (status === "integration") return 55;
  if (status === "in_progress") return 40;
  if (status === "blocked") return 25;
  return 10;
}

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await resolveProjectRoute(id);
  if (!ctx.studio && !ctx.pmBundle) notFound();

  const slug = ctx.pmSlug ?? id;
  const [pmBundle, poolBundle] = await Promise.all([
    ctx.pmSlug ? fetchProjectBoard(slug) : Promise.resolve(ctx.pmBundle),
    ctx.pmSlug ? fetchPoolData(slug) : Promise.resolve(null),
  ]);
  const studioTasks = ctx.studio ? await getProjectTasks(ctx.studio.id) : [];
  const bugs = pmBundle ? await fetchProjectBugs(pmBundle.project.id) : [];
  const attachments = pmBundle ? await listProjectAttachments(pmBundle.project.id) : [];

  const boardReqs = pmBundle?.requirements ?? [];
  const poolReqs = poolBundle?.poolRequirements ?? [];
  const allReqs = [...boardReqs, ...poolReqs];
  const roleTasks = pmBundle?.role_tasks ?? [];
  const members = (pmBundle?.project_members ?? []).filter((m) => m.is_active);
  const activities = pmBundle?.activity_logs ?? [];
  const titleByEntityId = new Map<string, string>();
  for (const r of allReqs) titleByEntityId.set(r.id, r.title);
  for (const b of bugs) titleByEntityId.set(b.id, b.title);

  const doneReq = allReqs.filter((r) => requirementIsDone(r)).length;
  const totalReq = allReqs.length || 1;
  const progressPct = Math.round((doneReq / totalReq) * 100);

  const estimated =
    roleTasks.reduce((s, t) => s + (t.estimate_hours ?? 0), 0) +
    allReqs.reduce((s, r) => s + (r.product_estimate_hours ?? 0), 0);
  const consumed = roleTasks.reduce((s, t) => s + (t.actual_hours ?? 0), 0);
  const remaining = Math.max(0, estimated - consumed);
  const hoursPct = estimated > 0 ? Math.min(100, Math.round((consumed / estimated) * 100)) : 0;

  const openBugs = bugs.filter((b) => b.status !== "done").length;
  const taskCount = roleTasks.length + studioTasks.length;

  const ganttItems = [
    ...allReqs.slice(0, 16).map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      href: r.in_pool
        ? `/projects/${ctx.routeId}/tasks?req=${r.id}`
        : `/projects/${ctx.routeId}/requirements/${r.id}`,
      kind: r.in_pool ? ("pool" as const) : ("pm" as const),
    })),
    ...studioTasks
      .filter((t) => t.status !== "done")
      .slice(0, 6)
      .map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        href: `/projects/${ctx.routeId}/tasks`,
        kind: "studio" as const,
      })),
  ];

  const title = ctx.studio?.title ?? pmBundle?.project.name ?? "项目";
  const createdAt = pmBundle?.project.created_at?.replace("T", " ").slice(0, 19) ?? "—";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        {/* 左：进度 + 动态 */}
        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-800">{title} · 需求进度</h2>
              <span className="text-xs text-slate-500">
                完成 {doneReq}/{allReqs.length} · {progressPct}%
              </span>
            </div>
            <div className="mb-4 h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <ul className="space-y-2.5">
              {ganttItems.length === 0 ? (
                <li className="text-sm text-slate-400">暂无需求/任务</li>
              ) : (
                ganttItems.map((item) => {
                  const pct = statusProgress(item.status);
                  const bar =
                    item.kind === "studio"
                      ? "bg-violet-400"
                      : item.kind === "pool"
                        ? "bg-amber-400"
                        : "bg-indigo-400";
                  return (
                    <li key={`${item.kind}-${item.id}`}>
                      <Link href={item.href} className="block rounded-md px-1 py-0.5 hover:bg-slate-50">
                        <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                          <span className="truncate font-medium text-slate-700">{item.title}</span>
                          <span className="shrink-0 text-slate-400">
                            {TASK_STATUS_LABELS[item.status as TaskStatus] ?? item.status}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                        </div>
                      </Link>
                    </li>
                  );
                })
              )}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">最新动态</h3>
            <p className="mb-3 text-xs text-slate-400">
              记录「谁 · 何时 · 做了什么」。白昼＝本助手，星辰＝ChatGPT；灰字为对话窗口备注。
            </p>
            {activities.length === 0 ? (
              <p className="text-sm text-slate-400">
                暂无动态。在「需求与任务」里新建需求或改指派/状态后，会出现在这里。
              </p>
            ) : (
              <ul className="space-y-2.5">
                {activities.slice(0, 20).map((log) => {
                  const row = describeActivity(log, titleByEntityId);
                  return (
                    <li key={log.id} className="border-l-2 border-indigo-200 pl-3 text-sm">
                      <div className="text-[11px] text-slate-400">{row.time}</div>
                      <div className="text-slate-700">{row.text}</div>
                      {row.note ? (
                        <div className="mt-0.5 text-[11px] text-slate-400">{row.note}</div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* 右：侧栏统计（仿禅道概况） */}
        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">{title}</h2>
              <StudioBadge tone="muted">项目</StudioBadge>
            </div>
            <p className="mt-1 text-xs text-slate-400">创建于 {createdAt}</p>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Link
                href={`/projects/${ctx.routeId}/tasks`}
                className="rounded-lg bg-slate-50 px-2 py-3 hover:bg-indigo-50"
              >
                <div className="text-lg font-semibold text-indigo-700">{allReqs.length}</div>
                <div className="text-[11px] text-slate-500">需求</div>
              </Link>
              <Link
                href={`/projects/${ctx.routeId}/tasks?view=kanban`}
                className="rounded-lg bg-slate-50 px-2 py-3 hover:bg-indigo-50"
              >
                <div className="text-lg font-semibold text-slate-800">{taskCount}</div>
                <div className="text-[11px] text-slate-500">任务</div>
              </Link>
              <Link
                href={`/projects/${ctx.routeId}/bugs`}
                className="rounded-lg bg-slate-50 px-2 py-3 hover:bg-indigo-50"
              >
                <div className="text-lg font-semibold text-amber-700">{bugs.length}</div>
                <div className="text-[11px] text-slate-500">Bug</div>
              </Link>
            </div>
            <p className="mt-2 text-center text-[11px] text-slate-400">
              池中 {poolReqs.length} · 已上板 {boardReqs.length} · 未关 Bug {openBugs}
            </p>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-800">工时统计</h3>
            <div className="mt-3 mb-1 flex justify-between text-xs text-slate-500">
              <span>已消耗 / 预计</span>
              <span>
                {consumed}h / {estimated}h · {hoursPct}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${hoursPct}%` }}
              />
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-slate-50 py-2">
                <dt className="text-slate-400">预计</dt>
                <dd className="font-semibold text-slate-800">{estimated}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 py-2">
                <dt className="text-slate-400">消耗</dt>
                <dd className="font-semibold text-slate-800">{consumed}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 py-2">
                <dt className="text-slate-400">剩余</dt>
                <dd className="font-semibold text-slate-800">{remaining}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">相关成员</h3>
              <Link
                href={`/projects/${slug}/settings`}
                className="text-xs text-indigo-600 hover:underline"
              >
                + 团队管理
              </Link>
            </div>
            {members.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">暂无成员，可在项目设置中添加</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-800">{m.name}</span>
                    <span className="text-xs text-slate-400">
                      {m.role ? ROLE_LABELS[m.role as RoleType] ?? m.role : "成员"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-800">文档库</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link
                  href={`/projects/${ctx.routeId}/resources`}
                  className="text-indigo-600 hover:underline"
                >
                  项目资料 / 附件库 →
                </Link>
                <span className="ml-2 text-xs text-slate-400">{attachments.length} 个附件</span>
              </li>
              <li>
                <Link
                  href={`/projects/${ctx.routeId}/tasks`}
                  className="text-indigo-600 hover:underline"
                >
                  需求池 →
                </Link>
              </li>
              <li>
                <Link
                  href={`/projects/${ctx.routeId}/bugs`}
                  className="text-indigo-600 hover:underline"
                >
                  Bug 列表 →
                </Link>
              </li>
            </ul>
          </section>

          <PortfolioPromptPanel projectTitle={title} compact />
        </aside>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs text-slate-400">
        历史 · 项目创建于 {createdAt}
        {pmBundle?.project.description ? ` · ${pmBundle.project.description}` : null}
      </section>
    </div>
  );
}
