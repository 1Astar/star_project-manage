"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StudioBadge } from "@/components/studio/shell";
import { WorkbenchAcceptancePeek } from "@/components/workbench-acceptance-peek";
import { WorkbenchAcceptanceBrowserNudge } from "@/components/workbench-acceptance-browser-nudge";
import {
  productReviewAcceptanceBundleAction,
  productReviewChangeSessionAction,
  productReviewRequirementAction,
} from "@/lib/actions";
import type {
  PmAcceptanceBundle,
  PmAcceptanceItem,
  PmFollowUpItem,
  PmOpenBugItem,
} from "@/lib/workbench/pm-inbox";
import type { TomorrowAgendaItem } from "@/lib/workbench/tomorrow-agenda";
import type { BugSeverity } from "@/lib/types";
import { BUG_SEVERITY_LABELS } from "@/lib/types";
import { openLiveSite } from "@/lib/project-live-url";

type Props = {
  acceptance: PmAcceptanceItem[];
  acceptanceBundles: PmAcceptanceBundle[];
  followUps: PmFollowUpItem[];
  openBugs: PmOpenBugItem[];
  lookbackDays: number;
  todayDay: string;
  tomorrowDay: string;
  tomorrowItems: TomorrowAgendaItem[];
};

export function WorkbenchPmToday({
  acceptance,
  acceptanceBundles,
  followUps,
  openBugs,
  lookbackDays,
  todayDay,
  tomorrowDay,
  tomorrowItems,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejectBundleId, setRejectBundleId] = useState<string | null>(null);
  const [rejectItemId, setRejectItemId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [bugTitle, setBugTitle] = useState("");
  const [bugSeverity, setBugSeverity] = useState<BugSeverity>(3);
  const [createBug, setCreateBug] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hiddenBundles, setHiddenBundles] = useState<Set<string>>(new Set());
  const [hiddenItems, setHiddenItems] = useState<Set<string>>(new Set());
  const [filterProject, setFilterProject] = useState("");
  const [filterModule, setFilterModule] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [peekItem, setPeekItem] = useState<PmAcceptanceItem | null>(null);

  const projects = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of acceptanceBundles) map.set(b.projectId, b.projectTitle);
    return [...map.entries()]
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));
  }, [acceptanceBundles]);

  const modules = useMemo(() => {
    const set = new Set<string>();
    for (const b of acceptanceBundles) {
      if (!filterProject || b.projectId === filterProject) set.add(b.module);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "zh-CN"));
  }, [acceptanceBundles, filterProject]);

  const visibleBundles = useMemo(() => {
    return acceptanceBundles
      .filter((b) => {
        if (hiddenBundles.has(b.id)) return false;
        if (filterProject && b.projectId !== filterProject) return false;
        if (filterModule && b.module !== filterModule) return false;
        const left = b.items.filter((i) => !hiddenItems.has(i.id));
        return left.length > 0;
      })
      .map((b) => ({
        ...b,
        items: b.items.filter((i) => !hiddenItems.has(i.id)),
        itemCount: b.items.filter((i) => !hiddenItems.has(i.id)).length,
      }));
  }, [acceptanceBundles, hiddenBundles, hiddenItems, filterProject, filterModule]);

  const visibleItemCount = visibleBundles.reduce((n, b) => n + b.itemCount, 0);

  function hideBundle(id: string) {
    setHiddenBundles((prev) => new Set(prev).add(id));
  }

  function hideItem(id: string) {
    setHiddenItems((prev) => new Set(prev).add(id));
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openRejectBundle(bundle: PmAcceptanceBundle) {
    setRejectBundleId(bundle.id);
    setRejectItemId(null);
    setRejectNote("");
    setBugTitle(`验收打回：${bundle.projectTitle} / ${bundle.module}`);
    setBugSeverity(3);
    setCreateBug(true);
    setError(null);
  }

  function openRejectItem(item: PmAcceptanceItem) {
    setRejectItemId(item.id);
    setRejectBundleId(null);
    setRejectNote("");
    setBugTitle(`验收打回：${item.title}`);
    setBugSeverity(3);
    setCreateBug(true);
    setError(null);
  }

  function runPassBundle(bundle: PmAcceptanceBundle) {
    setError(null);
    startTransition(async () => {
      try {
        await productReviewAcceptanceBundleAction({
          items: bundle.items.map((i) => ({
            requirementId: i.requirementId,
            changeSessionId: i.changeSessionId,
            pmProjectId: i.pmProjectId,
          })),
          passed: true,
        });
        hideBundle(bundle.id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  function runWaiveBundle(bundle: PmAcceptanceBundle) {
    setError(null);
    startTransition(async () => {
      try {
        await productReviewAcceptanceBundleAction({
          items: bundle.items.map((i) => ({
            requirementId: i.requirementId,
            changeSessionId: i.changeSessionId,
            pmProjectId: i.pmProjectId,
          })),
          passed: true,
          note: "用户免验本包",
        });
        hideBundle(bundle.id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  function runRejectBundle(bundle: PmAcceptanceBundle) {
    const note = rejectNote.trim();
    if (!note) {
      setError("请填写打回补充（会记为 Bug）");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await productReviewAcceptanceBundleAction({
          items: bundle.items.map((i) => ({
            requirementId: i.requirementId,
            changeSessionId: i.changeSessionId,
            pmProjectId: i.pmProjectId,
            title: i.title,
          })),
          passed: false,
          note,
          createBug,
          bugTitle: bugTitle.trim() || undefined,
          bugSeverity,
          bugType: "other",
        });
        setRejectBundleId(null);
        setRejectNote("");
        hideBundle(bundle.id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  function runPassItem(item: PmAcceptanceItem) {
    setError(null);
    startTransition(async () => {
      try {
        if (item.requirementId) {
          await productReviewRequirementAction({
            requirementId: item.requirementId,
            passed: true,
          });
        } else if (item.changeSessionId) {
          await productReviewChangeSessionAction({
            sessionId: item.changeSessionId,
            passed: true,
          });
        }
        hideItem(item.id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  function runRejectItem(item: PmAcceptanceItem) {
    const note = rejectNote.trim();
    if (!note) {
      setError("请填写打回补充（会记为 Bug）");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        if (item.requirementId) {
          await productReviewRequirementAction({
            requirementId: item.requirementId,
            passed: false,
            note,
            createBug,
            bugTitle: bugTitle.trim() || undefined,
            bugSeverity,
            bugType: "other",
          });
        } else if (item.changeSessionId) {
          await productReviewChangeSessionAction({
            sessionId: item.changeSessionId,
            passed: false,
            note,
            pmProjectId: item.pmProjectId,
            createBug,
            bugTitle: bugTitle.trim() || undefined,
            bugSeverity,
            bugType: "other",
          });
        }
        setRejectItemId(null);
        setRejectNote("");
        hideItem(item.id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  const rejectForm = (onConfirm: () => void, onCancel: () => void) => (
    <div className="mt-3 space-y-2 rounded-lg border border-rose-100 bg-white p-3">
      <label className="block text-xs text-slate-600">
        Bug 标题
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          value={bugTitle}
          onChange={(e) => setBugTitle(e.target.value)}
        />
      </label>
      <label className="block text-xs text-slate-600">
        补充 / 修改意见（必填，写入 Bug 描述）
        <textarea
          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          rows={3}
          placeholder="哪里不对、期望怎样、复现步骤…"
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-1 text-slate-600">
          严重度
          <select
            className="rounded-lg border border-slate-200 bg-white px-2 py-1"
            value={bugSeverity}
            onChange={(e) => setBugSeverity(Number(e.target.value) as BugSeverity)}
          >
            {([1, 2, 3, 4] as BugSeverity[]).map((s) => (
              <option key={s} value={s}>
                {BUG_SEVERITY_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-slate-700">
          <input
            type="checkbox"
            checked={createBug}
            onChange={(e) => setCreateBug(e.target.checked)}
          />
          同时记为 Bug
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={onConfirm}
          className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          确认打回
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-slate-500 hover:underline"
        >
          取消
        </button>
      </div>
    </div>
  );

  return (
    <div id="pm-today" className="scroll-mt-20 space-y-4">
      <WorkbenchAcceptanceBrowserNudge
        count={visibleBundles.length}
        todayDay={todayDay}
      />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">今日清单</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            按板块汇总验收 · Bug∥明日 · 会话回看 {lookbackDays} 天
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <section className="rounded-xl border border-orange-200 bg-orange-50/30">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-orange-100 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                待你验收
                <span className="ml-2 text-xs font-normal text-slate-500">
                  {visibleBundles.length} 板块
                  {visibleItemCount !== visibleBundles.length
                    ? ` · ${visibleItemCount} 项`
                    : ""}
                  {acceptance.length !== visibleItemCount && acceptance.length > 0
                    ? ` / 原 ${acceptance.length} 项`
                    : ""}
                </span>
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                为何 · 结果 · 怎么验 · 可整板块通过/打回
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <label className="flex items-center gap-1 text-slate-600">
                项目
                <select
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1"
                  value={filterProject}
                  onChange={(e) => {
                    setFilterProject(e.target.value);
                    setFilterModule("");
                  }}
                >
                  <option value="">全部</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1 text-slate-600">
                板块
                <select
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1"
                  value={filterModule}
                  onChange={(e) => setFilterModule(e.target.value)}
                >
                  <option value="">全部</option>
                  {modules.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          {visibleBundles.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">
              {acceptanceBundles.length === 0
                ? "暂无待你过目的验收"
                : "当前筛选无结果"}
            </p>
          ) : (
            <ul className="max-h-[32rem] divide-y divide-orange-100/80 overflow-y-auto">
              {visibleBundles.map((bundle) => {
                const open = expanded.has(bundle.id);
                return (
                  <li key={bundle.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <StudioBadge tone="p0">{bundle.module}</StudioBadge>
                          <button
                            type="button"
                            onClick={() => toggleExpand(bundle.id)}
                            className="text-left font-medium text-slate-900 hover:text-indigo-700"
                          >
                            {bundle.liveSiteUrl ? (
                              <span
                                className="text-indigo-600 underline underline-offset-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openLiveSite(bundle.liveSiteUrl!);
                                }}
                              >
                                {bundle.projectTitle}
                              </span>
                            ) : (
                              bundle.projectTitle
                            )}
                            <span className="ml-1 font-normal text-slate-500">
                              · {bundle.itemCount} 项
                              {open ? " ▾" : " ▸"}
                            </span>
                          </button>
                        </div>
                        <p className="mt-1 text-xs text-slate-700">
                          <span className="font-medium text-slate-500">为何 </span>
                          {bundle.why}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-700">
                          <span className="font-medium text-slate-500">结果 </span>
                          {bundle.result}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-700">
                          <span className="font-medium text-slate-500">怎么验 </span>
                          {bundle.howToVerify.length
                            ? bundle.howToVerify.join(" · ")
                            : "（未写，展开看明细）"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => runPassBundle(bundle)}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          整板块通过
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => openRejectBundle(bundle)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:border-rose-300 hover:text-rose-700 disabled:opacity-50"
                        >
                          整板块打回
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => runWaiveBundle(bundle)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500 hover:border-slate-400 disabled:opacity-50"
                        >
                          免验
                        </button>
                      </div>
                    </div>

                    {rejectBundleId === bundle.id
                      ? rejectForm(
                          () => runRejectBundle(bundle),
                          () => setRejectBundleId(null)
                        )
                      : null}

                    {open ? (
                      <ul className="mt-3 space-y-2 border-l-2 border-orange-100 pl-3">
                        {bundle.items.map((item) => (
                          <li key={item.id} className="text-sm">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <StudioBadge
                                    tone={item.source === "formal" ? "p0" : "p1"}
                                  >
                                    {item.sourceLabel}
                                  </StudioBadge>
                                  <button
                                    type="button"
                                    onClick={() => setPeekItem(item)}
                                    className="text-left font-medium text-slate-800 hover:text-indigo-700"
                                  >
                                    {item.title}
                                  </button>
                                </div>
                                {item.note ? (
                                  <p className="mt-0.5 text-xs text-slate-500">
                                    {item.note}
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                <button
                                  type="button"
                                  disabled={pending}
                                  onClick={() => runPassItem(item)}
                                  className="rounded-md bg-emerald-600/90 px-2 py-0.5 text-[11px] font-medium text-white disabled:opacity-50"
                                >
                                  通过
                                </button>
                                <button
                                  type="button"
                                  disabled={pending}
                                  onClick={() => openRejectItem(item)}
                                  className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 disabled:opacity-50"
                                >
                                  退回
                                </button>
                              </div>
                            </div>
                            {rejectItemId === item.id
                              ? rejectForm(
                                  () => runRejectItem(item),
                                  () => setRejectItemId(null)
                                )
                              : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-amber-200 bg-amber-50/20">
          <div className="border-b border-amber-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">
              需你跟进
              <span className="ml-2 text-xs font-normal text-slate-500">
                {followUps.length}
              </span>
            </h3>
          </div>
          {followUps.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">暂无跟进项</p>
          ) : (
            <ul className="max-h-[28rem] divide-y divide-amber-100/80 overflow-y-auto">
              {followUps.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="block px-4 py-3 hover:bg-amber-50/50"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StudioBadge tone="muted">{item.kindLabel}</StudioBadge>
                      <span className="font-medium text-slate-900">{item.title}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {item.projectTitle}
                      {item.note ? ` · ${item.note}` : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <section className="rounded-xl border border-rose-200 bg-rose-50/20">
          <div className="border-b border-rose-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">
              未关 Bug
              <span className="ml-2 text-xs font-normal text-slate-500">
                {openBugs.length}
              </span>
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              来自验收打回 / 项目 Bug 页
            </p>
          </div>
          {openBugs.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">暂无未关 Bug</p>
          ) : (
            <ul className="max-h-[28rem] divide-y divide-rose-100/80 overflow-y-auto">
              {openBugs.map((bug) => (
                <li key={bug.id}>
                  <Link
                    href={bug.href}
                    className="block px-4 py-3 hover:bg-rose-50/50"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StudioBadge tone="p0">S{bug.severity}</StudioBadge>
                      <span className="font-medium text-slate-900">{bug.title}</span>
                      <span className="text-xs text-slate-400">{bug.statusLabel}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {bug.projectTitle}
                      {bug.note ? ` · ${bug.note}` : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-indigo-100 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">
              明日待办
              <span className="ml-2 text-xs font-normal text-slate-500">
                {tomorrowItems.length}
              </span>
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              只收到期=明天 · 基准 {todayDay} · 目标 {tomorrowDay}
            </p>
          </div>
          {tomorrowItems.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">
              明天暂无到期事项
            </p>
          ) : (
            <ul className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto">
              {tomorrowItems.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex flex-wrap items-start gap-2 px-4 py-3 hover:bg-indigo-50/40"
                  >
                    <StudioBadge tone="muted">{item.priority || "—"}</StudioBadge>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-900">{item.title}</div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {item.projectTitle} · {item.reasonLabel}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {peekItem ? (
        <WorkbenchAcceptancePeek
          item={peekItem}
          pending={pending}
          onClose={() => setPeekItem(null)}
          onPass={() => {
            const item = peekItem;
            runPassItem(item);
            setPeekItem(null);
          }}
          onReject={() => {
            openRejectItem(peekItem);
            setPeekItem(null);
          }}
        />
      ) : null}
    </div>
  );
}
