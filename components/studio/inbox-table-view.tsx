"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { StudioBadge } from "@/components/studio/shell";
import { ConvertIdeaButton } from "@/components/studio/convert-idea-button";
import { formatIdeaDateTime, ideaOccurredAt } from "@/lib/studio/idea-stream-utils";
import {
  IDEA_TYPE_LABELS,
  IDEA_STATUS_LABELS,
  type Idea,
  type IdeaPriority,
  type IdeaStatus,
  type IdeaType,
} from "@/lib/studio/types";
import { cn } from "@/lib/utils";
import { ResizableTh, useColWidths } from "@/lib/ui/col-widths";

export type InboxTableRow = {
  idea: Idea;
  projectName: string | null;
  parentIdeaTitle: string | null;
};

const WIDTHS_KEY = "star-pm:idea-table-widths-v1";

const DEFAULT_WIDTHS: Record<string, number> = {
  title: 180,
  oneLine: 220,
  type: 88,
  priority: 72,
  status: 88,
  occurred: 140,
  completed: 140,
  related: 120,
  actions: 100,
};

const TYPE_OPTIONS = Object.keys(IDEA_TYPE_LABELS) as IdeaType[];
const PRIORITY_OPTIONS: IdeaPriority[] = ["P0", "P1", "P2", "P3"];
const STATUS_OPTIONS = Object.keys(IDEA_STATUS_LABELS) as IdeaStatus[];

function priorityTone(priority: string) {
  if (priority === "P0") return "p0" as const;
  if (priority === "P1") return "p1" as const;
  return "default" as const;
}

function toggleInList<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

export function InboxTableView({
  rows,
  emptyMessage = "暂无灵感",
}: {
  rows: InboxTableRow[];
  emptyMessage?: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { colW, onResizeStart } = useColWidths(WIDTHS_KEY, DEFAULT_WIDTHS, {
    syncKey: "idea-table-widths-v1",
  });
  const [query, setQuery] = useState("");
  const [priorities, setPriorities] = useState<IdeaPriority[]>([]);
  const [types, setTypes] = useState<IdeaType[]>([]);
  const [statuses, setStatuses] = useState<IdeaStatus[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(({ idea, projectName }) => {
      if (priorities.length && !priorities.includes(idea.priority)) return false;
      if (types.length && !types.includes(idea.type)) return false;
      if (statuses.length && !statuses.includes(idea.status)) return false;
      if (q) {
        const hay = `${idea.title} ${idea.oneLineIdea} ${projectName ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, query, priorities, types, statuses]);

  const visibleIds = useMemo(() => filteredRows.map((r) => r.idea.id), [filteredRows]);
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const activeFilterCount =
    priorities.length + types.length + statuses.length + (query.trim() ? 1 : 0);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(visibleIds));
  }

  async function bulkArchive() {
    const ids = [...selected];
    if (!ids.length) return;
    if (!confirm(`将选中的 ${ids.length} 条灵感归档？不会从数据库硬删除。`)) return;

    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/ideas/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive", ids }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "归档失败");
        return;
      }
      setSelected(new Set());
      router.refresh();
    } catch {
      setError("网络错误");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索标题 / 一句话 / 项目"
          className="min-w-[12rem] flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 sm:max-w-xs"
        />
        <button
          type="button"
          onClick={() => setFilterOpen((v) => !v)}
          className={cn(
            "rounded-lg border px-3 py-1.5 text-xs font-medium",
            filterOpen || activeFilterCount > 0
              ? "border-indigo-200 bg-indigo-50 text-indigo-700"
              : "border-slate-200 bg-white text-slate-600"
          )}
        >
          筛选{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
        </button>
        <span className="text-xs text-slate-400">
          显示 {filteredRows.length}/{rows.length}
        </span>
      </div>

      {filterOpen ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <div>
            <div className="mb-1.5 text-xs font-medium text-slate-500">优先级</div>
            <div className="flex flex-wrap gap-1.5">
              {PRIORITY_OPTIONS.map((p) => {
                const on = priorities.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriorities(toggleInList(priorities, p))}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs",
                      on
                        ? "bg-indigo-600 text-white"
                        : "bg-white text-slate-600 ring-1 ring-slate-200"
                    )}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-medium text-slate-500">类型</div>
            <div className="flex flex-wrap gap-1.5">
              {TYPE_OPTIONS.map((t) => {
                const on = types.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTypes(toggleInList(types, t))}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs",
                      on
                        ? "bg-indigo-600 text-white"
                        : "bg-white text-slate-600 ring-1 ring-slate-200"
                    )}
                  >
                    {IDEA_TYPE_LABELS[t]}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-xs font-medium text-slate-500">状态</div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((s) => {
                const on = statuses.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatuses(toggleInList(statuses, s))}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs",
                      on
                        ? "bg-indigo-600 text-white"
                        : "bg-white text-slate-600 ring-1 ring-slate-200"
                    )}
                  >
                    {IDEA_STATUS_LABELS[s]}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setPriorities([]);
              setTypes([]);
              setStatuses([]);
            }}
            className="text-xs text-slate-500 hover:text-slate-800 hover:underline"
          >
            清空表格筛选
          </button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {selected.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2">
            <span className="text-xs text-slate-600">已选 {selected.size} 条</span>
            <button
              type="button"
              disabled={pending}
              onClick={bulkArchive}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              {pending ? "归档中…" : "批量归档"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setSelected(new Set())}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              取消选择
            </button>
            {error ? <span className="text-xs text-red-600">{error}</span> : null}
          </div>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm" style={{ tableLayout: "fixed" }}>
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="sticky left-0 z-10 w-10 bg-slate-50 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    disabled={filteredRows.length === 0}
                    title="全选当前列表"
                    aria-label="全选"
                  />
                </th>
                <ResizableTh
                  colKey="title"
                  width={colW("title")}
                  onResizeStart={onResizeStart}
                  sticky
                  className="left-10 px-4"
                >
                  标题
                </ResizableTh>
                <ResizableTh colKey="oneLine" width={colW("oneLine")} onResizeStart={onResizeStart} className="px-4">
                  一句话想法
                </ResizableTh>
                <ResizableTh colKey="type" width={colW("type")} onResizeStart={onResizeStart} className="px-4">
                  类型
                </ResizableTh>
                <ResizableTh colKey="priority" width={colW("priority")} onResizeStart={onResizeStart} className="px-4">
                  优先级
                </ResizableTh>
                <ResizableTh colKey="status" width={colW("status")} onResizeStart={onResizeStart} className="px-4">
                  状态
                </ResizableTh>
                <ResizableTh colKey="occurred" width={colW("occurred")} onResizeStart={onResizeStart} className="px-4">
                  发生时间
                </ResizableTh>
                <ResizableTh colKey="completed" width={colW("completed")} onResizeStart={onResizeStart} className="px-4">
                  完成时间
                </ResizableTh>
                <ResizableTh colKey="related" width={colW("related")} onResizeStart={onResizeStart} className="px-4">
                  关联
                </ResizableTh>
                <ResizableTh colKey="actions" width={colW("actions")} onResizeStart={onResizeStart} className="px-4">
                  操作
                </ResizableTh>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-sm text-slate-500">
                    {rows.length === 0 ? emptyMessage : "没有符合表格筛选的灵感"}
                  </td>
                </tr>
              ) : (
                filteredRows.map(({ idea, projectName, parentIdeaTitle }) => (
                  <tr key={idea.id} className="hover:bg-slate-50">
                    <td className="sticky left-0 z-[1] bg-white px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(idea.id)}
                        onChange={() => toggleOne(idea.id)}
                        aria-label={`选择 ${idea.title}`}
                      />
                    </td>
                    <td
                      className="sticky left-10 z-[1] bg-white px-4 py-3 font-medium text-slate-800"
                      style={{ width: colW("title") }}
                    >
                      {idea.title}
                    </td>
                    <td className="px-4 py-3 text-slate-600" style={{ width: colW("oneLine") }}>
                      <span className="line-clamp-2">{idea.oneLineIdea}</span>
                    </td>
                    <td className="px-4 py-3" style={{ width: colW("type") }}>
                      <StudioBadge>{IDEA_TYPE_LABELS[idea.type]}</StudioBadge>
                    </td>
                    <td className="px-4 py-3" style={{ width: colW("priority") }}>
                      <StudioBadge tone={priorityTone(idea.priority)}>{idea.priority}</StudioBadge>
                    </td>
                    <td className="px-4 py-3" style={{ width: colW("status") }}>
                      <StudioBadge
                        tone={
                          idea.status === "converted" || idea.status === "done"
                            ? "success"
                            : "muted"
                        }
                      >
                        {IDEA_STATUS_LABELS[idea.status]}
                      </StudioBadge>
                    </td>
                    <td
                      className="px-4 py-3 tabular-nums text-slate-500"
                      style={{ width: colW("occurred") }}
                    >
                      {formatIdeaDateTime(ideaOccurredAt(idea))}
                    </td>
                    <td
                      className="px-4 py-3 tabular-nums text-slate-500"
                      style={{ width: colW("completed") }}
                    >
                      {idea.completedAt ? formatIdeaDateTime(idea.completedAt) : "—"}
                    </td>
                    <td className="px-4 py-3" style={{ width: colW("related") }}>
                      {idea.relatedProjectId ? (
                        <Link
                          href={`/projects/${idea.relatedProjectId}`}
                          className="text-indigo-600 hover:underline"
                        >
                          {projectName}
                        </Link>
                      ) : idea.relatedIdeaId ? (
                        <span className="text-slate-600">↳ {parentIdeaTitle}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3" style={{ width: colW("actions") }}>
                      <ConvertIdeaButton
                        ideaId={idea.id}
                        ideaTitle={idea.title}
                        status={idea.status}
                        relatedProjectId={idea.relatedProjectId}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
