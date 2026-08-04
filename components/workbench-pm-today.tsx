"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StudioBadge } from "@/components/studio/shell";
import { WorkbenchAcceptancePeek } from "@/components/workbench-acceptance-peek";
import { WorkbenchAcceptanceBrowserNudge } from "@/components/workbench-acceptance-browser-nudge";
import {
  productReviewChangeSessionAction,
  productReviewRequirementAction,
} from "@/lib/actions";
import type {
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
  followUps: PmFollowUpItem[];
  openBugs: PmOpenBugItem[];
  lookbackDays: number;
  todayDay: string;
  tomorrowDay: string;
  tomorrowItems: TomorrowAgendaItem[];
};

function sourceTone(source: PmAcceptanceItem["source"]) {
  if (source === "formal") return "p0" as const;
  return "p1" as const;
}

export function WorkbenchPmToday({
  acceptance,
  followUps,
  openBugs,
  lookbackDays,
  todayDay,
  tomorrowDay,
  tomorrowItems,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [bugTitle, setBugTitle] = useState("");
  const [bugSeverity, setBugSeverity] = useState<BugSeverity>(3);
  const [createBug, setCreateBug] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [filterProject, setFilterProject] = useState("");
  const [filterSource, setFilterSource] = useState<"" | "formal" | "change_session">(
    ""
  );
  const [peekItem, setPeekItem] = useState<PmAcceptanceItem | null>(null);

  const projects = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of acceptance) map.set(i.projectId, i.projectTitle);
    return [...map.entries()]
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));
  }, [acceptance]);

  const visibleAcceptance = useMemo(() => {
    return acceptance.filter((i) => {
      if (hidden.has(i.id)) return false;
      if (filterProject && i.projectId !== filterProject) return false;
      if (filterSource && i.source !== filterSource) return false;
      return true;
    });
  }, [acceptance, hidden, filterProject, filterSource]);

  function hide(id: string) {
    setHidden((prev) => new Set(prev).add(id));
  }

  function openReject(item: PmAcceptanceItem) {
    setRejectId(item.id);
    setRejectNote("");
    setBugTitle(`验收打回：${item.title}`);
    setBugSeverity(3);
    setCreateBug(true);
    setError(null);
  }

  function runPass(item: PmAcceptanceItem) {
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
        hide(item.id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  function runReject(item: PmAcceptanceItem) {
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
        setRejectId(null);
        setRejectNote("");
        hide(item.id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败");
      }
    });
  }

  return (
    <div id="pm-today" className="scroll-mt-20 space-y-4">
      <WorkbenchAcceptanceBrowserNudge
        count={visibleAcceptance.length}
        todayDay={todayDay}
      />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">今日清单</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            验收∥跟进 · Bug∥明日 · 打回可记 Bug · 会话回看 {lookbackDays} 天
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {/* 验收 ∥ 跟进 */}
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <section className="rounded-xl border border-orange-200 bg-orange-50/30">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-orange-100 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                待你验收
                <span className="ml-2 text-xs font-normal text-slate-500">
                  {visibleAcceptance.length}
                  {acceptance.length !== visibleAcceptance.length
                    ? ` / ${acceptance.length}`
                    : ""}
                </span>
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                正式待验 + 未收口会话 · 打回默认建 Bug
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <label className="flex items-center gap-1 text-slate-600">
                项目
                <select
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1"
                  value={filterProject}
                  onChange={(e) => setFilterProject(e.target.value)}
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
                来源
                <select
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1"
                  value={filterSource}
                  onChange={(e) =>
                    setFilterSource(e.target.value as "" | "formal" | "change_session")
                  }
                >
                  <option value="">全部</option>
                  <option value="formal">正式待验</option>
                  <option value="change_session">变更会话</option>
                </select>
              </label>
            </div>
          </div>
          {visibleAcceptance.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">
              {acceptance.length === 0 ? "暂无待你过目的验收" : "当前筛选无结果"}
            </p>
          ) : (
            <ul className="max-h-[28rem] divide-y divide-orange-100/80 overflow-y-auto">
              {visibleAcceptance.map((item) => (
                <li key={item.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StudioBadge tone={sourceTone(item.source)}>
                          {item.sourceLabel}
                        </StudioBadge>
                        <button
                          type="button"
                          onClick={() => setPeekItem(item)}
                          className="text-left font-medium text-slate-900 hover:text-indigo-700"
                        >
                          {item.title}
                        </button>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {item.liveSiteUrl ? (
                          <button
                            type="button"
                            title="打开站点（同站复用标签）"
                            className="text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
                            onClick={() => openLiveSite(item.liveSiteUrl!)}
                          >
                            {item.projectTitle}
                          </button>
                        ) : (
                          item.projectTitle
                        )}
                        {item.note ? ` · ${item.note}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => runPass(item)}
                        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        通过
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => openReject(item)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:border-rose-300 hover:text-rose-700 disabled:opacity-50"
                      >
                        打回·提 Bug
                      </button>
                    </div>
                  </div>
                  {rejectId === item.id ? (
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
                            onChange={(e) =>
                              setBugSeverity(Number(e.target.value) as BugSeverity)
                            }
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
                          onClick={() => runReject(item)}
                          className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
                        >
                          确认打回
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectId(null)}
                          className="text-xs text-slate-500 hover:underline"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
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

      {/* Bug ∥ 明日待办 */}
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
            runPass(item);
            setPeekItem(null);
          }}
          onReject={() => {
            openReject(peekItem);
            setPeekItem(null);
          }}
        />
      ) : null}
    </div>
  );
}
