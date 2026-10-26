"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  EntitySidePeek,
  type EntityPeekPayload,
} from "@/components/entity-side-peek";
import { OverviewRelationLayer } from "@/components/overview-relation-layer";
import {
  OVERVIEW_TYPE_CARDS,
  OVERVIEW_TYPE_FILTERS,
  type OverviewFilterType,
  type OverviewMatrixRow,
  type OverviewRowType,
} from "@/lib/overview/matrix-rows";
import {
  overviewRelationKey,
  type OverviewRelationBundle,
  type OverviewRelationItem,
} from "@/lib/overview/relations";
import {
  WORKBENCH_SHELL_TABS,
  buildWorkbenchPending,
  buildWorkbenchRecent,
  buildWorkbenchStats,
  countRowsByType,
  type WorkbenchPendingItem,
  type WorkbenchShellView,
} from "@/lib/overview/workbench";
import { encodeModuleKey } from "@/lib/modules/product-module-home";
import type { Bug, Requirement } from "@/lib/types";
import {
  saveRequirementDetailAction,
  updateBugAction,
  updateCompetitorEntryAction,
  updateLearningNoteAction,
} from "@/lib/actions";

const TYPE_PILL: Record<OverviewRowType, string> = {
  知识点: "bg-sky-50 text-sky-800",
  Bug: "bg-rose-50 text-rose-800",
  优化建议: "bg-amber-50 text-amber-900",
  需求: "bg-indigo-50 text-indigo-800",
  竞品: "bg-emerald-50 text-emerald-800",
  聊天参考: "bg-violet-50 text-violet-800",
};

const TYPE_CARD_STYLE: Record<
  OverviewFilterType,
  { idle: string; active: string }
> = {
  Bug: {
    idle: "border-rose-100 hover:border-rose-200 hover:bg-rose-50/50",
    active: "border-rose-300 bg-rose-50 ring-1 ring-rose-200",
  },
  需求: {
    idle: "border-indigo-100 hover:border-indigo-200 hover:bg-indigo-50/50",
    active: "border-indigo-300 bg-indigo-50 ring-1 ring-indigo-200",
  },
  优化建议: {
    idle: "border-amber-100 hover:border-amber-200 hover:bg-amber-50/40",
    active: "border-amber-300 bg-amber-50 ring-1 ring-amber-200",
  },
  知识点: {
    idle: "border-sky-100 hover:border-sky-200 hover:bg-sky-50/50",
    active: "border-sky-300 bg-sky-50 ring-1 ring-sky-200",
  },
  竞品: {
    idle: "border-emerald-100 hover:border-emerald-200 hover:bg-emerald-50/50",
    active: "border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200",
  },
  聊天参考: {
    idle: "border-violet-100 hover:border-violet-200 hover:bg-violet-50/40",
    active: "border-violet-300 bg-violet-50 ring-1 ring-violet-200",
  },
};

function formatUpdatedAt(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RowList({
  items,
  emptyHint,
  onOpen,
}: {
  items: Array<OverviewMatrixRow | WorkbenchPendingItem>;
  emptyHint: string;
  onOpen: (row: OverviewMatrixRow) => void;
}) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-xs text-slate-400">{emptyHint}</p>;
  }
  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
      {items.map((row) => {
        const reason = "reason" in row ? row.reason : undefined;
        return (
          <li key={row.id} className="flex flex-wrap items-start gap-3 px-3 py-2.5">
            <span
              className={`mt-0.5 inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_PILL[row.rowType]}`}
            >
              {row.rowType}
            </span>
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onOpen(row)}
                className="text-left text-sm font-medium text-indigo-700 hover:underline"
              >
                {row.title}
              </button>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {row.section}
                {" · "}
                {formatUpdatedAt(row.updatedAt)}
                {reason ? ` · ${reason}` : ""}
              </p>
              {row.summary ? (
                <p className="mt-1 line-clamp-2 text-xs text-slate-500 whitespace-pre-wrap">
                  {row.summary}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ProjectResearchWorkbench({
  projectSlug,
  projectTitle,
  rows: initialRows,
  bugs,
  requirements,
  relationIndex = {},
}: {
  projectSlug: string;
  projectTitle?: string;
  rows: OverviewMatrixRow[];
  bugs: Bug[];
  requirements: Requirement[];
  /** 服务端预计算的关联包 peekKind:entityId → bundle */
  relationIndex?: Record<string, OverviewRelationBundle>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [peekPending, setPeekPending] = useState(false);
  const [rows, setRows] = useState(initialRows);
  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const [shell, setShell] = useState<WorkbenchShellView>("overview");
  const [sectionFilter, setSectionFilter] = useState<string>("全部");
  const [typeFilter, setTypeFilter] = useState<(typeof OVERVIEW_TYPE_FILTERS)[number]>(
    "全部"
  );
  const [q, setQ] = useState("");
  const [peek, setPeek] = useState<EntityPeekPayload | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedBundle = selectedKey ? relationIndex[selectedKey] ?? null : null;

  const pendingItems = useMemo(
    () => buildWorkbenchPending({ rows, bugs, requirements }),
    [rows, bugs, requirements]
  );
  const stats = useMemo(
    () => buildWorkbenchStats(rows, pendingItems),
    [rows, pendingItems]
  );
  const recent = useMemo(() => buildWorkbenchRecent(rows, 20), [rows]);
  const typeCounts = useMemo(() => countRowsByType(rows), [rows]);
  const countByType = useMemo(() => {
    const m = new Map<OverviewFilterType, number>();
    for (const c of typeCounts) m.set(c.type, c.count);
    return m;
  }, [typeCounts]);

  const sections = useMemo(() => {
    const set = new Set(rows.map((r) => r.section));
    return ["全部", ...Array.from(set).sort((a, b) => a.localeCompare(b, "zh"))];
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (sectionFilter !== "全部" && r.section !== sectionFilter) return false;
      if (typeFilter !== "全部" && r.rowType !== typeFilter) return false;
      if (!needle) return true;
      return (
        r.title.toLowerCase().includes(needle) ||
        r.summary.toLowerCase().includes(needle) ||
        r.section.toLowerCase().includes(needle)
      );
    });
  }, [rows, sectionFilter, typeFilter, q]);

  function openRow(row: OverviewMatrixRow) {
    setError(null);
    setSelectedKey(overviewRelationKey(row.peekKind, row.entityId));
    setShell("overview");
    setPeek({
      kind: row.peekKind,
      id: row.entityId,
      title: row.title,
      href: row.href,
      badge: row.badge ?? row.rowType,
      fields: row.fields,
    });
  }

  function openRelationItem(item: OverviewRelationItem) {
    if (!item.peekKind) return;
    const matched = rows.find(
      (r) => r.peekKind === item.peekKind && r.entityId === item.id
    );
    if (matched) {
      openRow(matched);
      return;
    }
    setError(null);
    setPeek({
      kind: item.peekKind,
      id: item.id,
      title: item.title,
      href: item.href,
      badge: item.badge,
      fields: item.fields,
    });
  }

  function selectTypeCard(type: OverviewFilterType) {
    setShell("overview");
    setTypeFilter((prev) => (prev === type ? "全部" : type));
  }

  function patchLocalRow(
    entityId: string,
    peekKind: OverviewMatrixRow["peekKind"],
    patch: { title: string; fields: Record<string, string> }
  ) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.entityId !== entityId || r.peekKind !== peekKind) return r;
        const fields = r.fields.map((f) => ({
          ...f,
          value: patch.fields[f.key] ?? f.value,
        }));
        const summaryBits = fields
          .filter((f) => f.multiline)
          .map((f) => f.value.trim())
          .filter(Boolean);
        return {
          ...r,
          title: patch.title,
          fields,
          summary: summaryBits.join("\n").slice(0, 200),
        };
      })
    );
  }

  async function savePeek(patch: {
    title: string;
    fields: Record<string, string>;
  }) {
    if (!peek) return;
    setPeekPending(true);
    setError(null);
    try {
      if (peek.kind === "learning") {
        await updateLearningNoteAction({
          noteId: peek.id,
          projectSlug,
          title: patch.title,
          whyText: patch.fields.why_text,
          principle: patch.fields.principle,
          protocol: patch.fields.protocol,
          techBackground: patch.fields.tech_background,
          productThinking: patch.fields.product_thinking,
        });
      } else if (peek.kind === "bug") {
        await updateBugAction({
          bugId: peek.id,
          projectSlug,
          updates: {
            title: patch.title,
            reproSteps: patch.fields.repro_steps,
            expectedResult: patch.fields.expected_result,
            actualResult: patch.fields.actual_result,
            description: patch.fields.description || null,
            suggestion: patch.fields.suggestion || null,
            modulePath: patch.fields.module_path || null,
          },
        });
      } else if (peek.kind === "competitor") {
        await updateCompetitorEntryAction({
          entryId: peek.id,
          projectSlug,
          title: patch.title,
          summary: patch.fields.summary,
          url: patch.fields.url || null,
          modulePath: patch.fields.module_path || null,
        });
      } else {
        await saveRequirementDetailAction({
          requirementId: peek.id,
          projectSlug,
          updates: {
            title: patch.title,
            detail_work: patch.fields.detail_work || null,
            acceptance_criteria: patch.fields.acceptance_criteria || null,
            priority: patch.fields.priority || null,
          },
        });
      }
      patchLocalRow(peek.id, peek.kind, patch);
      setPeek(null);
      setSelectedKey(null);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setPeekPending(false);
    }
  }

  function closePeek() {
    setPeek(null);
    setSelectedKey(null);
  }

  const peekOpen = Boolean(peek);

  return (
    <div
      className={`flex items-stretch gap-0 ${
        peekOpen ? "min-h-[calc(100vh-8rem)]" : ""
      }`}
    >
      <div
        className={`min-w-0 space-y-4 ${
          peekOpen ? "w-[min(100%,42%)] shrink-0 pr-3" : "w-full"
        }`}
      >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {projectTitle ? `${projectTitle} · 调研工作台` : "调研工作台"}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            点行右侧分栏打开（Notion Side Peek），左侧总览仍可见
            {pending ? " · 刷新中…" : ""}
          </p>
        </div>
        <p className="text-xs text-slate-400">
          共 {stats.total} 条 · 待处理 {stats.pendingCount}
        </p>
      </div>

      <nav className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-2">
        {WORKBENCH_SHELL_TABS.map((tab) => {
          const active = shell === tab.id;
          const badge =
            tab.id === "pending"
              ? stats.pendingCount
              : tab.id === "stats"
                ? stats.total
                : tab.id === "recent"
                  ? Math.min(20, rows.length)
                  : null;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setShell(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {tab.label}
              {badge !== null ? (
                <span
                  className={`ml-1.5 tabular-nums ${
                    active ? "text-slate-300" : "text-slate-400"
                  }`}
                >
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {shell === "stats" ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">按类型</h3>
            <ul className="mt-3 space-y-2">
              {stats.byType.map((t) => (
                <li
                  key={t.type}
                  className="flex items-center justify-between text-sm text-slate-700"
                >
                  <button
                    type="button"
                    onClick={() => selectTypeCard(t.type)}
                    className="text-left hover:text-indigo-700 hover:underline"
                  >
                    {t.type}
                    {t.stub ? (
                      <span className="ml-1 text-[10px] text-slate-400">
                        （后期）
                      </span>
                    ) : null}
                  </button>
                  <span className="tabular-nums text-slate-500">{t.count}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">按板块</h3>
            {stats.bySection.length === 0 ? (
              <p className="mt-3 text-xs text-slate-400">暂无数据</p>
            ) : (
              <ul className="mt-3 max-h-72 space-y-2 overflow-auto">
                {stats.bySection.map((s) => (
                  <li
                    key={s.section}
                    className="flex items-center justify-between gap-2 text-sm text-slate-700"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setShell("overview");
                        setSectionFilter(s.section);
                      }}
                      className="min-w-0 truncate text-left hover:text-indigo-700 hover:underline"
                    >
                      {s.section}
                    </button>
                    <span className="shrink-0 tabular-nums text-slate-500">
                      {s.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {shell === "pending" ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            未完成 Bug/优化/需求、缺板块、竞品无摘要等。点标题侧栏可改。
          </p>
          <RowList
            items={pendingItems}
            emptyHint="暂无待处理项。"
            onOpen={openRow}
          />
        </div>
      ) : null}

      {shell === "recent" ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">按更新时间最近 20 条。</p>
          <RowList items={recent} emptyHint="暂无更新。" onOpen={openRow} />
        </div>
      ) : null}

      {shell === "overview" ? (
        <div className="space-y-3">
          {!peekOpen ? (
            <div>
              <p className="mb-2 text-xs text-slate-500">
                同一数据库，不同类型的条目，通过筛选形成不同视图。再点一次同一卡片可取消筛选。
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {OVERVIEW_TYPE_CARDS.map((type) => {
                  const active = typeFilter === type;
                  const count = countByType.get(type) ?? 0;
                  const stub = type === "聊天参考";
                  const style = TYPE_CARD_STYLE[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => selectTypeCard(type)}
                      className={`rounded-xl border bg-white px-3 py-3 text-left transition ${
                        active ? style.active : style.idle
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900">
                          {type}
                        </span>
                        <span className="text-xs tabular-nums text-slate-400">
                          {count}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {stub
                          ? "入口占位，独立类型后期接入"
                          : active
                            ? "已筛选 · 再点取消"
                            : "点此筛进总览表"}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">总览表</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                按板块 + 类型分行。点标题在右侧打开，不遮挡左侧列表。
              </p>
            </div>
            <p className="text-xs text-slate-400">
              显示 {filtered.length} / {rows.length}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
            >
              {sections.map((s) => (
                <option key={s} value={s}>
                  {s === "全部" ? "全部板块" : s}
                </option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(
                  e.target.value as (typeof OVERVIEW_TYPE_FILTERS)[number]
                )
              }
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
            >
              {OVERVIEW_TYPE_FILTERS.map((t) => (
                <option key={t} value={t}>
                  {t === "全部" ? "全部类型" : t}
                </option>
              ))}
            </select>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索标题 / 摘要…"
              className="min-w-[12rem] flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
            />
            {sectionFilter !== "全部" && sectionFilter !== "未分板块" ? (
              <Link
                href={`/projects/${projectSlug}/modules/${encodeModuleKey(sectionFilter)}`}
                className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs text-indigo-700 hover:bg-indigo-100"
              >
                打开「{sectionFilter}」模块主页
              </Link>
            ) : (
              <Link
                href={`/projects/${projectSlug}/modules`}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                模块列表
              </Link>
            )}
          </div>

          {typeFilter === "聊天参考" ? (
            <p className="rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2 text-xs text-violet-800">
              「聊天参考」独立类型尚未入库。对话证据可先写在竞品摘要或 Bug
              描述里；类型落地后会自动出现在此筛选。
            </p>
          ) : null}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div
              className={`overflow-auto ${
                peekOpen ? "max-h-[calc(100vh-10rem)]" : "max-h-[calc(100vh-16rem)]"
              }`}
            >
              <table
                className={`w-full border-collapse text-sm ${
                  peekOpen ? "min-w-[420px]" : "min-w-[800px]"
                }`}
              >
                <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="px-3 py-2.5 font-medium" style={{ width: "7rem" }}>
                      板块
                    </th>
                    <th
                      className="px-3 py-2.5 font-medium"
                      style={{ width: "5.5rem" }}
                    >
                      类型
                    </th>
                    <th
                      className="px-3 py-2.5 font-medium"
                      style={{ width: "5.5rem" }}
                    >
                      附图
                    </th>
                    <th
                      className="px-3 py-2.5 font-medium"
                      style={{ width: "14rem" }}
                    >
                      标题
                    </th>
                    <th className="px-3 py-2.5 font-medium">摘要 / 参考</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-10 text-center text-xs text-slate-400"
                      >
                        {typeFilter === "聊天参考"
                          ? "暂无聊天参考条目（类型后期接入）。"
                          : "暂无条目。可先到学习池 / Bug 用「总表 Excel 导入」灌入调研表。"}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((row) => {
                      const thumbs = row.thumbnails ?? [];
                      const extra =
                        (row.attachmentCount ?? thumbs.length) - thumbs.length;
                      const rowKey = overviewRelationKey(
                        row.peekKind,
                        row.entityId
                      );
                      const selected = selectedKey === rowKey;
                      return (
                        <tr
                          key={row.id}
                          className={`border-b border-slate-100 hover:bg-slate-50/80 ${
                            selected ? "bg-indigo-50/70" : ""
                          }`}
                        >
                          <td className="px-3 py-2.5 align-top text-xs text-slate-600">
                            {row.section}
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${TYPE_PILL[row.rowType]}`}
                            >
                              {row.rowType}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            {thumbs.length === 0 ? (
                              <span className="text-[10px] text-slate-300">—</span>
                            ) : (
                              <div className="flex items-center gap-1">
                                {thumbs.map((t) => (
                                  <a
                                    key={t.url}
                                    href={t.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    title={t.title}
                                    className="block h-10 w-10 overflow-hidden rounded border border-slate-200 bg-slate-100"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={t.url}
                                      alt={t.title}
                                      className="h-full w-full object-cover"
                                      loading="lazy"
                                    />
                                  </a>
                                ))}
                                {extra > 0 ? (
                                  <span className="text-[10px] text-slate-400">
                                    +{extra}
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <button
                              type="button"
                              onClick={() => openRow(row)}
                              className="text-left text-sm font-medium text-indigo-700 hover:underline"
                            >
                              {row.badge ? (
                                <span className="mr-1 text-[10px] font-normal text-slate-400">
                                  [{row.badge}]
                                </span>
                              ) : null}
                              {row.title}
                            </button>
                          </td>
                          <td className="px-3 py-2.5 align-top">
                            <button
                              type="button"
                              onClick={() => openRow(row)}
                              className="line-clamp-3 w-full text-left text-xs leading-relaxed text-slate-600"
                            >
                              {row.summary || "—"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {!peekOpen ? (
            <p className="text-[11px] text-slate-400">
              点一行 → 右侧分栏打开详情与关联表；左侧总览保持可见可点换行。
            </p>
          ) : null}
        </div>
      ) : null}
      </div>

      {peek ? (
        <div className="sticky top-2 flex h-[calc(100vh-5.5rem)] min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <EntitySidePeek
            variant="panel"
            item={peek}
            pending={peekPending}
            onClose={closePeek}
            onSave={savePeek}
          >
            {selectedBundle ? (
              <OverviewRelationLayer
                variant="embed"
                bundle={selectedBundle}
                onOpenItem={openRelationItem}
              />
            ) : (
              <p className="text-xs text-slate-400">暂无关联数据。</p>
            )}
          </EntitySidePeek>
        </div>
      ) : null}
    </div>
  );
}
