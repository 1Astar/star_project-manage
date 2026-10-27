"use client";

import Link from "next/link";
import { Fragment, useMemo, useState, useTransition } from "react";
import {
  LINKED_VIEW_OP_LABELS,
  LINKED_VIEW_OPS,
  newFilterId,
  type LinkedViewConfig,
  type LinkedViewFilter,
  type LinkedViewOp,
  type LinkedViewSourceId,
} from "@/lib/linked-views/config";
import {
  linkedViewSourceMeta,
  linkedViewSources,
  type LinkedViewSourceMeta,
} from "@/lib/linked-views/catalog";
import {
  prepareLinkedViewRows,
  type LinkedViewRow,
} from "@/lib/linked-views/query";
import { createLinkedViewRowAction } from "@/lib/linked-views/actions";
import { moduleHintFromFilters } from "@/lib/linked-views/filter-hints";
import { linkedViewTitleHint } from "@/lib/linked-views/title-hints";

export function LinkedViewBlock({
  projectId,
  projectSlug,
  config,
  rows,
  source,
  canEdit = false,
  onChange,
  onDelete,
  onOpenRow,
  moduleOptions = [],
}: {
  projectId?: string;
  projectSlug: string;
  config: LinkedViewConfig;
  rows: LinkedViewRow[];
  source?: LinkedViewSourceMeta;
  canEdit?: boolean;
  onChange?: (next: LinkedViewConfig) => void;
  onDelete?: () => void;
  onOpenRow?: (row: LinkedViewRow) => void;
  moduleOptions?: string[];
}) {
  const allSources = useMemo(() => linkedViewSources(projectSlug), [projectSlug]);
  const meta = source ?? linkedViewSourceMeta(projectSlug, config.source);
  const [panel, setPanel] = useState<"none" | "filter" | "sort" | "group">("none");
  const [extra, setExtra] = useState<LinkedViewRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const merged = useMemo(() => {
    const seen = new Set(rows.map((r) => r.id));
    return [...rows, ...extra.filter((r) => !seen.has(r.id))];
  }, [rows, extra]);
  const groups = useMemo(
    () =>
      prepareLinkedViewRows(merged, {
        filters: config.filters,
        sort: config.sort,
        groupBy: config.groupBy,
      }),
    [merged, config.filters, config.sort, config.groupBy]
  );
  const shownCount = groups.reduce((n, g) => n + g.rows.length, 0);
  const canCreate = Boolean(canEdit && projectId);
  const title = config.title.trim() || meta?.label || "关联视图";
  const columns = meta?.columns ?? [];
  const fieldOptions = meta?.fields ?? [];
  const naming = linkedViewTitleHint(
    config.source,
    moduleHintFromFilters(config.filters)
  );
  const sortLabel = config.sort?.field
    ? `${fieldOptions.find((f) => f.key === config.sort?.field)?.label ?? config.sort.field}${
        config.sort.direction === "desc" ? " ↓" : " ↑"
      }`
    : null;
  const groupLabel = config.groupBy
    ? fieldOptions.find((f) => f.key === config.groupBy)?.label ?? config.groupBy
    : null;

  function patch(partial: Partial<LinkedViewConfig>) {
    onChange?.({ ...config, ...partial });
  }

  function updateFilter(id: string, next: Partial<LinkedViewFilter>) {
    patch({
      filters: config.filters.map((f) => (f.id === id ? { ...f, ...next } : f)),
    });
  }

  function changeSource(nextSource: LinkedViewSourceId) {
    if (nextSource === config.source) return;
    const nextMeta = linkedViewSourceMeta(projectSlug, nextSource);
    patch({
      source: nextSource,
      title: config.title.trim() || nextMeta?.label || "关联视图",
      filters: [],
      sort: null,
      groupBy: null,
    });
    setExtra([]);
  }

  async function createRow() {
    if (!projectId || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const row = await createLinkedViewRowAction({
        projectId,
        projectSlug,
        source: config.source,
        filters: config.filters,
      });
      setExtra((prev) => [row, ...prev]);
      onOpenRow?.(row);
      startTransition(() => {
        /* refresh comes from Peek 保存 or 父级 router.refresh */
      });
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "新建失败");
    } finally {
      setCreating(false);
    }
  }

  function renderRow(row: LinkedViewRow) {
    return (
      <tr key={row.id} className="border-b border-slate-50 last:border-0">
        <td className="px-3 py-2">
          {row.peekKind && onOpenRow ? (
            <button
              type="button"
              onClick={() => onOpenRow(row)}
              className="text-left text-sm text-indigo-700 hover:underline"
            >
              {row.title}
            </button>
          ) : (
            <Link
              href={row.href}
              className="text-sm text-indigo-700 hover:underline"
            >
              {row.title}
            </Link>
          )}
        </td>
        {columns.map((col) => (
          <td key={col.key} className="px-3 py-2 text-xs text-slate-600">
            {row.cells[col.key] || "—"}
          </td>
        ))}
      </tr>
    );
  }

  return (
    <section className="my-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
        <span className="text-slate-400" aria-hidden>
          ▦
        </span>
        {canEdit && onChange ? (
          <>
            <select
              value={config.source}
              onChange={(e) =>
                changeSource(e.target.value as LinkedViewSourceId)
              }
              className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1 text-xs text-slate-700"
              title="切换数据源"
            >
              {allSources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <input
              value={config.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder={meta?.label ?? "关联视图"}
              className="min-w-[8rem] flex-1 border-0 bg-transparent text-sm font-medium text-slate-800 outline-none"
            />
          </>
        ) : (
          <h4 className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
            {title}
          </h4>
        )}
        <button
          type="button"
          onClick={() => setPanel((v) => (v === "filter" ? "none" : "filter"))}
          className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
        >
          {config.filters.length > 0
            ? `筛选 ${config.filters.length}`
            : "筛选"}
        </button>
        <button
          type="button"
          onClick={() => setPanel((v) => (v === "sort" ? "none" : "sort"))}
          className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
        >
          {sortLabel ? `排序 · ${sortLabel}` : "排序"}
        </button>
        <button
          type="button"
          onClick={() => setPanel((v) => (v === "group" ? "none" : "group"))}
          className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
        >
          {groupLabel ? `分组 · ${groupLabel}` : "分组"}
        </button>
        {canCreate ? (
          <button
            type="button"
            disabled={creating}
            onClick={() => void createRow()}
            className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-40"
          >
            {creating ? "新建中…" : "新建"}
          </button>
        ) : meta ? (
          <Link
            href={meta.newHref}
            className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white"
          >
            新建
          </Link>
        ) : null}
        {canEdit && onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="text-xs text-slate-400 hover:text-red-600"
          >
            移除
          </button>
        ) : null}
      </div>

      {panel === "filter" && meta ? (
        <div className="border-b border-slate-100 bg-slate-50/60 px-3 py-3">
          <p className="mb-2 text-xs text-slate-500">
            {config.filters.length} 条规则 · 同时满足
            {canEdit && onChange ? "" : "（只读）"}
          </p>
          <div className="space-y-2">
            {config.filters.map((f, i) => (
              <div key={f.id} className="flex flex-wrap items-center gap-1.5">
                <span className="w-6 text-[11px] text-slate-400">
                  {i === 0 ? "当" : "且"}
                </span>
                <select
                  value={f.field}
                  disabled={!canEdit || !onChange}
                  onChange={(e) => updateFilter(f.id, { field: e.target.value })}
                  className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs disabled:opacity-60"
                >
                  {meta.fields.map((field) => (
                    <option key={field.key} value={field.key}>
                      {field.label}
                    </option>
                  ))}
                </select>
                <select
                  value={f.op}
                  disabled={!canEdit || !onChange}
                  onChange={(e) =>
                    updateFilter(f.id, { op: e.target.value as LinkedViewOp })
                  }
                  className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs disabled:opacity-60"
                >
                  {LINKED_VIEW_OPS.map((op) => (
                    <option key={op} value={op}>
                      {LINKED_VIEW_OP_LABELS[op]}
                    </option>
                  ))}
                </select>
                {f.op !== "is_empty" && f.op !== "is_not_empty" ? (
                  f.field === "module" && moduleOptions.length > 0 ? (
                    <select
                      value={f.value}
                      disabled={!canEdit || !onChange}
                      onChange={(e) =>
                        updateFilter(f.id, { value: e.target.value })
                      }
                      className="min-w-[6rem] flex-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs disabled:opacity-60"
                    >
                      <option value="">选择模块</option>
                      {(moduleOptions.includes(f.value) || !f.value
                        ? moduleOptions
                        : [f.value, ...moduleOptions]
                      ).map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={f.value}
                      disabled={!canEdit || !onChange}
                      onChange={(e) =>
                        updateFilter(f.id, { value: e.target.value })
                      }
                      placeholder="值"
                      className="min-w-[6rem] flex-1 rounded-md border border-slate-200 px-1.5 py-1 text-xs disabled:opacity-60"
                    />
                  )
                ) : null}
                {canEdit && onChange ? (
                  <button
                    type="button"
                    onClick={() =>
                      patch({
                        filters: config.filters.filter((x) => x.id !== f.id),
                      })
                    }
                    className="text-xs text-slate-400 hover:text-red-600"
                  >
                    删除
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {canEdit && onChange ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      filters: [
                        ...config.filters,
                        {
                          id: newFilterId(),
                          field: "module",
                          op: "contains",
                          value: "",
                        },
                      ],
                    })
                  }
                  className="text-xs text-indigo-600 hover:underline"
                >
                  + 添加筛选规则
                </button>
                {config.filters.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => patch({ filters: [] })}
                    className="text-xs text-slate-400 hover:text-red-600"
                  >
                    清空筛选
                  </button>
                ) : null}
              </>
            ) : null}
            <button
              type="button"
              onClick={() => setPanel("none")}
              className="ml-auto text-xs text-slate-400"
            >
              关闭
            </button>
          </div>
        </div>
      ) : null}

      {panel === "sort" && meta ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-3 py-3">
          <span className="text-xs text-slate-500">排序字段</span>
          <select
            value={config.sort?.field ?? ""}
            disabled={!canEdit || !onChange}
            onChange={(e) => {
              const field = e.target.value;
              if (!field) {
                patch({ sort: null });
                return;
              }
              patch({
                sort: {
                  field,
                  direction: config.sort?.direction ?? "asc",
                },
              });
            }}
            className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs disabled:opacity-60"
          >
            <option value="">不排序</option>
            {meta.fields.map((field) => (
              <option key={field.key} value={field.key}>
                {field.label}
              </option>
            ))}
          </select>
          <select
            value={config.sort?.direction ?? "asc"}
            disabled={!canEdit || !onChange || !config.sort?.field}
            onChange={(e) =>
              patch({
                sort: config.sort?.field
                  ? {
                      field: config.sort.field,
                      direction: e.target.value === "desc" ? "desc" : "asc",
                    }
                  : null,
              })
            }
            className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs disabled:opacity-60"
          >
            <option value="asc">升序</option>
            <option value="desc">降序</option>
          </select>
          <button
            type="button"
            onClick={() => setPanel("none")}
            className="ml-auto text-xs text-slate-400"
          >
            关闭
          </button>
        </div>
      ) : null}

      {panel === "group" && meta ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-3 py-3">
          <span className="text-xs text-slate-500">分组字段</span>
          <select
            value={config.groupBy ?? ""}
            disabled={!canEdit || !onChange}
            onChange={(e) =>
              patch({ groupBy: e.target.value.trim() || null })
            }
            className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs disabled:opacity-60"
          >
            <option value="">不分组</option>
            {meta.fields.map((field) => (
              <option key={field.key} value={field.key}>
                {field.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setPanel("none")}
            className="ml-auto text-xs text-slate-400"
          >
            关闭
          </button>
        </div>
      ) : null}

      {panel === "none" &&
      (config.filters.length > 0 || sortLabel || groupLabel) ? (
        <div className="flex flex-wrap gap-1 border-b border-slate-50 px-3 py-1.5">
          {config.filters.map((f) => (
            <span
              key={f.id}
              className="rounded-md bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600"
            >
              {meta?.fields.find((x) => x.key === f.field)?.label ?? f.field}{" "}
              {LINKED_VIEW_OP_LABELS[f.op]}
              {f.op !== "is_empty" && f.op !== "is_not_empty"
                ? ` ${f.value}`
                : ""}
            </span>
          ))}
          {sortLabel ? (
            <span className="rounded-md bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
              排序 {sortLabel}
            </span>
          ) : null}
          {groupLabel ? (
            <span className="rounded-md bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
              分组 {groupLabel}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] text-slate-400">
              <th className="px-3 py-2 font-medium">名称</th>
              {columns.map((col) => (
                <th key={col.key} className="px-3 py-2 font-medium">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shownCount === 0 ? (
              <tr>
                <td
                  colSpan={1 + columns.length}
                  className="px-3 py-6 text-center text-xs text-slate-400"
                >
                  没有匹配的条目。
                  {canCreate ? "可点新建，或改筛选。" : "可改筛选，或到总库新增。"}
                </td>
              </tr>
            ) : (
              groups.map((group) => (
                <Fragment key={`g-${group.key}`}>
                  {group.label ? (
                    <tr className="bg-slate-50/80">
                      <td
                        colSpan={1 + columns.length}
                        className="px-3 py-1.5 text-[11px] font-medium text-slate-600"
                      >
                        {group.label}
                        <span className="ml-2 font-normal text-slate-400">
                          {group.rows.length}
                        </span>
                      </td>
                    </tr>
                  ) : null}
                  {group.rows.map((row) => renderRow(row))}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
      {canCreate ? (
        <div className="border-t border-slate-50">
          <button
            type="button"
            disabled={creating}
            onClick={() => void createRow()}
            className="w-full px-3 py-2 text-left text-xs text-slate-400 hover:bg-slate-50 hover:text-indigo-700 disabled:opacity-40"
          >
            + 新页面
            <span className="ml-2 font-normal text-slate-300">
              {naming.placeholder}
            </span>
            <span className="mt-0.5 block font-normal text-slate-300">
              例：{naming.example}
            </span>
          </button>
        </div>
      ) : null}
      {createError ? (
        <p className="px-3 py-1 text-[11px] text-red-600">{createError}</p>
      ) : null}
      <p className="px-3 py-1.5 text-[11px] text-slate-400">
        {shownCount} / {merged.length} · 数据在总库，此处为链接视图
        {canEdit ? " · 可再插一块新视图" : ""}
      </p>
    </section>
  );
}
