import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchPoolData, fetchProjectBoard, fetchProjectBugs } from "@/lib/actions";
import { ProjectModuleTree } from "@/components/project-module-tree";
import { StudioBadge } from "@/components/studio/shell";
import { resolveProjectRoute } from "@/lib/project-bridge";
import { getProjectTasks } from "@/lib/studio/data";
import { listProjectAttachments, listProjectModules } from "@/lib/db/local-store";
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
  const pmProjectId = ctx.pmBundle?.project.id ?? ctx.pmSlug ?? null;

  const [pmBundle, poolBundle, modules] = await Promise.all([
    ctx.pmSlug ? fetchProjectBoard(slug) : Promise.resolve(ctx.pmBundle),
    ctx.pmSlug ? fetchPoolData(slug) : Promise.resolve(null),
    pmProjectId ? listProjectModules(pmProjectId) : Promise.resolve([]),
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

  const reqCounts: Record<string, number> = {};
  for (const r of allReqs) {
    if (r.module_l1_id) reqCounts[r.module_l1_id] = (reqCounts[r.module_l1_id] ?? 0) + 1;
    if (r.module_l2_id) reqCounts[r.module_l2_id] = (reqCounts[r.module_l2_id] ?? 0) + 1;
  }

  const ganttItems = [
    ...allReqs.slice(0, 10).map((r) => ({
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
      .slice(0, 4)
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
  const canEditModules = Boolean(pmProjectId);

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.85fr)]">
      {/* 左：进度 + 模块 + 动态 */}
      <div className="space-y-3">
        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-semibold text-slate-800">需求进度</h2>
            <span className="text-[11px] text-slate-500">
              {doneReq}/{allReqs.length} · {progressPct}%
            </span>
          </div>
          <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <ul className="max-h-[200px] space-y-1.5 overflow-y-auto">
            {ganttItems.length === 0 ? (
              <li className="text-[11px] text-slate-400">暂无需求/任务</li>
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
                    <Link
                      href={item.href}
                      className="block rounded px-0.5 py-0.5 hover:bg-slate-50"
                    >
                      <div className="mb-0.5 flex items-center justify-between gap-2 text-[11px]">
                        <span className="truncate font-medium text-slate-700">
                          {item.title}
                        </span>
                        <span className="shrink-0 text-slate-400">
                          {TASK_STATUS_LABELS[item.status as TaskStatus] ?? item.status}
                        </span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${bar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </Link>
                  </li>
                );
              })
            )}
          </ul>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-3">
          {canEditModules && pmProjectId ? (
            <ProjectModuleTree
              projectId={pmProjectId}
              projectSlug={slug}
              modules={modules}
              reqCounts={reqCounts}
              studioProjectId={ctx.studio?.id ?? null}
            />
          ) : (
            <>
              <h3 className="text-xs font-semibold text-slate-800">模块</h3>
              <p className="mt-1 text-[11px] text-slate-400">
                该项目尚未关联 PM 需求库，无法管理模块。
              </p>
            </>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="mb-2 text-xs font-semibold text-slate-800">最新动态</h3>
          {activities.length === 0 ? (
            <p className="text-[11px] text-slate-400">暂无动态</p>
          ) : (
            <ul className="max-h-[220px] space-y-2 overflow-y-auto">
              {activities.slice(0, 12).map((log) => {
                const row = describeActivity(log, titleByEntityId);
                return (
                  <li key={log.id} className="border-l-2 border-indigo-100 pl-2 text-[11px]">
                    <div className="text-slate-400">{row.time}</div>
                    <div className="text-slate-700">{row.text}</div>
                    {row.note ? (
                      <div className="mt-0.5 text-slate-400">{row.note}</div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* 右：概况侧栏 */}
      <aside className="space-y-3">
        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="text-sm font-bold text-slate-900">{title}</h2>
            <StudioBadge tone="muted">项目</StudioBadge>
          </div>
          <p className="mt-0.5 text-[10px] text-slate-400">创建于 {createdAt}</p>

          <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
            <Link
              href={`/projects/${ctx.routeId}/tasks`}
              className="rounded-md bg-slate-50 px-1.5 py-2 hover:bg-indigo-50"
            >
              <div className="text-base font-semibold text-indigo-700">{allReqs.length}</div>
              <div className="text-[10px] text-slate-500">需求</div>
            </Link>
            <Link
              href={`/projects/${ctx.routeId}/tasks?view=kanban`}
              className="rounded-md bg-slate-50 px-1.5 py-2 hover:bg-indigo-50"
            >
              <div className="text-base font-semibold text-slate-800">{taskCount}</div>
              <div className="text-[10px] text-slate-500">任务</div>
            </Link>
            <Link
              href={`/projects/${ctx.routeId}/bugs`}
              className="rounded-md bg-slate-50 px-1.5 py-2 hover:bg-indigo-50"
            >
              <div className="text-base font-semibold text-amber-700">{bugs.length}</div>
              <div className="text-[10px] text-slate-500">Bug</div>
            </Link>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-slate-400">
            池中 {poolReqs.length} · 已上板 {boardReqs.length} · 未关 Bug {openBugs}
          </p>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="text-xs font-semibold text-slate-800">工时</h3>
          <div className="mt-2 mb-0.5 flex justify-between text-[10px] text-slate-500">
            <span>已消耗 / 预计</span>
            <span>
              {consumed}h / {estimated}h · {hoursPct}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${hoursPct}%` }}
            />
          </div>
          <dl className="mt-2 grid grid-cols-3 gap-1 text-center text-[10px]">
            <div className="rounded-md bg-slate-50 py-1.5">
              <dt className="text-slate-400">预计</dt>
              <dd className="font-semibold text-slate-800">{estimated}</dd>
            </div>
            <div className="rounded-md bg-slate-50 py-1.5">
              <dt className="text-slate-400">消耗</dt>
              <dd className="font-semibold text-slate-800">{consumed}</dd>
            </div>
            <div className="rounded-md bg-slate-50 py-1.5">
              <dt className="text-slate-400">剩余</dt>
              <dd className="font-semibold text-slate-800">{remaining}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-800">成员</h3>
            <Link
              href={`/projects/${slug}/settings`}
              className="text-[10px] text-indigo-600 hover:underline"
            >
              管理
            </Link>
          </div>
          {members.length === 0 ? (
            <p className="mt-1 text-[11px] text-slate-400">暂无成员</p>
          ) : (
            <ul className="mt-1.5 max-h-[120px] space-y-1 overflow-y-auto">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between text-[11px]"
                >
                  <span className="font-medium text-slate-800">{m.name}</span>
                  <span className="text-slate-400">
                    {m.role ? ROLE_LABELS[m.role as RoleType] ?? m.role : "成员"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="text-xs font-semibold text-slate-800">快捷入口</h3>
          <ul className="mt-1.5 space-y-1 text-[11px]">
            <li>
              <Link
                href={`/projects/${ctx.routeId}/resources`}
                className="text-indigo-600 hover:underline"
              >
                资料库
              </Link>
              <span className="ml-1 text-slate-400">{attachments.length}</span>
            </li>
            <li>
              <Link
                href={`/projects/${ctx.routeId}/tasks`}
                className="text-indigo-600 hover:underline"
              >
                需求与任务
              </Link>
            </li>
            <li>
              <Link
                href={`/projects/${ctx.routeId}/bugs`}
                className="text-indigo-600 hover:underline"
              >
                Bug
              </Link>
            </li>
          </ul>
        </section>
      </aside>
    </div>
  );
}
