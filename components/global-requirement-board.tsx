"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  RequirementStatusKanban,
  REQUIREMENT_KANBAN_COLUMNS,
  requirementColumn,
  type RequirementKanbanItem,
} from "@/components/requirement-status-kanban";
import { GlobalRequirementTable } from "@/components/global-requirement-table";
import type { RequirementBoardItem } from "@/lib/db/local-store";
import { REQUIREMENT_DONE_TAG } from "@/lib/types";
import {
  DEFAULT_REQ_BOARD_FILTERS,
  filtersEqual,
  newViewId,
  readReqBoardViewsState,
  writeReqBoardViewsState,
  type ReqBoardFilters,
  type ReqBoardSavedView,
} from "@/lib/workbench/requirement-board-views";
import { cn } from "@/lib/utils";

const PRIORITY_OPTIONS = ["P0", "P1", "P2", "P3"] as const;

type Props = {
  initialItems: RequirementBoardItem[];
  projects: Array<{ id: string; name: string; slug: string }>;
};

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

export function GlobalRequirementBoard({ initialItems, projects }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "table" ? "table" : "board";

  const [filters, setFilters] = useState<ReqBoardFilters>(DEFAULT_REQ_BOARD_FILTERS);
  const [savedViews, setSavedViews] = useState<ReqBoardSavedView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    const state = readReqBoardViewsState();
    setSavedViews(state.views);
    setActiveViewId(state.activeViewId);
    if (state.activeViewId) {
      const found = state.views.find((v) => v.id === state.activeViewId);
      if (found) setFilters(found.filters);
    }
  }, []);

  function persistViews(nextViews: ReqBoardSavedView[], nextActive: string | null) {
    setSavedViews(nextViews);
    setActiveViewId(nextActive);
    writeReqBoardViewsState({ views: nextViews, activeViewId: nextActive });
  }

  function patchFilters(patch: Partial<ReqBoardFilters>) {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      if (activeViewId) {
        const current = savedViews.find((v) => v.id === activeViewId);
        if (current && !filtersEqual(next, current.filters)) {
          setActiveViewId(null);
          writeReqBoardViewsState({ views: savedViews, activeViewId: null });
        }
      }
      return next;
    });
  }

  function applyView(viewRow: ReqBoardSavedView | null) {
    if (!viewRow) {
      setFilters({ ...DEFAULT_REQ_BOARD_FILTERS });
      persistViews(savedViews, null);
      return;
    }
    setFilters({ ...viewRow.filters });
    persistViews(savedViews, viewRow.id);
  }

  function saveCurrentAsView() {
    const name = window.prompt("视图名称", "我的筛选");
    if (!name?.trim()) return;
    const row: ReqBoardSavedView = {
      id: newViewId(),
      name: name.trim(),
      filters: { ...filters },
    };
    persistViews([...savedViews, row], row.id);
  }

  function renameActiveView() {
    if (!activeViewId) return;
    const current = savedViews.find((v) => v.id === activeViewId);
    if (!current) return;
    const name = window.prompt("重命名视图", current.name);
    if (!name?.trim()) return;
    const next = savedViews.map((v) =>
      v.id === activeViewId ? { ...v, name: name.trim() } : v
    );
    persistViews(next, activeViewId);
  }

  function updateActiveViewFilters() {
    if (!activeViewId) return;
    const next = savedViews.map((v) =>
      v.id === activeViewId ? { ...v, filters: { ...filters } } : v
    );
    persistViews(next, activeViewId);
  }

  function deleteActiveView() {
    if (!activeViewId) return;
    if (!window.confirm("删除该视图？")) return;
    const next = savedViews.filter((v) => v.id !== activeViewId);
    persistViews(next, null);
  }

  const kanbanItems: RequirementKanbanItem[] = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return initialItems
      .filter((item) => {
        if (filters.projectId && item.project_id !== filters.projectId) return false;
        const col = requirementColumn(item.requirement);
        if (filters.hideDone && (col === REQUIREMENT_DONE_TAG || col === "完成")) {
          return false;
        }
        if (filters.statuses.length > 0 && !filters.statuses.includes(col)) {
          return false;
        }
        const pri = (item.requirement.priority || "").toUpperCase();
        if (filters.priorities.length > 0 && !filters.priorities.includes(pri)) {
          return false;
        }
        if (q) {
          const hay = `${item.requirement.title} ${item.project_name}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .map((item) => ({
        req: item.requirement,
        projectSlug: item.project_slug,
        projectName: item.project_name,
      }));
  }, [initialItems, filters]);

  const activeFilterCount =
    (filters.projectId ? 1 : 0) +
    filters.statuses.length +
    filters.priorities.length +
    (filters.query.trim() ? 1 : 0) +
    (filters.hideDone ? 0 : 1);

  function hrefFor(next: "board" | "table") {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "board") params.delete("view");
    else params.set("view", "table");
    const qs = params.toString();
    return qs ? `/boards/requirements?${qs}` : "/boards/requirements";
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => applyView(null)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium",
            !activeViewId
              ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
              : "text-slate-600 hover:bg-slate-50"
          )}
        >
          全部
        </button>
        {savedViews.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => applyView(v)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium",
              activeViewId === v.id
                ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200"
                : "text-slate-600 hover:bg-slate-50"
            )}
          >
            {v.name}
          </button>
        ))}
        <button
          type="button"
          onClick={saveCurrentAsView}
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
        >
          + 保存当前筛选
        </button>
        {activeViewId ? (
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <button type="button" onClick={renameActiveView} className="hover:text-slate-700">
              重命名
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={updateActiveViewFilters}
              className="hover:text-slate-700"
            >
              更新筛选
            </button>
            <span>·</span>
            <button type="button" onClick={deleteActiveView} className="hover:text-red-600">
              删除
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
          <Link
            href={hrefFor("board")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium",
              view === "board"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-800"
            )}
          >
            看板
          </Link>
          <Link
            href={hrefFor("table")}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium",
              view === "table"
                ? "bg-white text-indigo-700 shadow-sm"
                : "text-slate-600 hover:text-slate-800"
            )}
          >
            表格
          </Link>
        </div>

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

        <input
          value={filters.query}
          onChange={(e) => patchFilters({ query: e.target.value })}
          placeholder="搜索标题 / 项目"
          className="min-w-[10rem] flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 sm:max-w-xs"
        />

        <span className="text-xs text-slate-400">共 {kanbanItems.length} 条</span>
      </div>

      {filterOpen ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="flex flex-wrap items-end gap-4">
            <label className="space-y-1 text-xs text-slate-600">
              <span className="block font-medium text-slate-500">项目</span>
              <select
                value={filters.projectId}
                onChange={(e) => patchFilters({ projectId: e.target.value })}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
              >
                <option value="">全部项目</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex cursor-pointer items-center gap-1.5 pb-1.5 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={filters.hideDone}
                onChange={(e) => patchFilters({ hideDone: e.target.checked })}
                className="rounded border-slate-300"
              />
              隐藏已完成
            </label>

            <button
              type="button"
              onClick={() => {
                setFilters({ ...DEFAULT_REQ_BOARD_FILTERS });
                persistViews(savedViews, null);
              }}
              className="pb-1.5 text-xs text-slate-500 hover:text-slate-800 hover:underline"
            >
              清空筛选
            </button>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-slate-500">状态</div>
            <div className="flex flex-wrap gap-1.5">
              {REQUIREMENT_KANBAN_COLUMNS.map((status) => {
                const on = filters.statuses.includes(status);
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() =>
                      patchFilters({ statuses: toggleInList(filters.statuses, status) })
                    }
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs",
                      on
                        ? "bg-indigo-600 text-white"
                        : "bg-white text-slate-600 ring-1 ring-slate-200"
                    )}
                  >
                    {status}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-slate-500">优先级</div>
            <div className="flex flex-wrap gap-1.5">
              {PRIORITY_OPTIONS.map((pri) => {
                const on = filters.priorities.includes(pri);
                return (
                  <button
                    key={pri}
                    type="button"
                    onClick={() =>
                      patchFilters({ priorities: toggleInList(filters.priorities, pri) })
                    }
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs",
                      on
                        ? "bg-indigo-600 text-white"
                        : "bg-white text-slate-600 ring-1 ring-slate-200"
                    )}
                  >
                    {pri}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {view === "table" ? (
        <GlobalRequirementTable items={kanbanItems} />
      ) : (
        <RequirementStatusKanban
          items={kanbanItems}
          showProjectName
          onOpen={(reqId, slug) => {
            router.push(`/projects/${slug}/requirements/${reqId}`);
          }}
        />
      )}
    </div>
  );
}
