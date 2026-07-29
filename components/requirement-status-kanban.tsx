"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveRequirementDetailAction } from "@/lib/actions";
import { StudioBadge } from "@/components/studio/shell";
import type { Requirement } from "@/lib/types";
import { isLeafRequirement } from "@/lib/requirement-tree";
import {
  REQUIREMENT_KANBAN_COLUMNS,
  REQUIREMENT_STATUS_HINT,
  applyLifecycleStatus,
  requirementKanbanColumn,
  type RequirementLifecycleStatus,
} from "@/lib/requirement-status";
import { cn } from "@/lib/utils";

export { REQUIREMENT_KANBAN_COLUMNS, requirementKanbanColumn as requirementColumn };

export type RequirementKanbanItem = {
  req: Requirement;
  projectSlug: string;
  projectName: string;
};

type Props = {
  /** 单项目模式（兼容旧用法） */
  projectSlug?: string;
  requirements?: Requirement[];
  /** 跨项目模式 */
  items?: RequirementKanbanItem[];
  showProjectName?: boolean;
  onOpen?: (reqId: string, projectSlug: string) => void;
};

const COLUMN_TONE: Record<RequirementLifecycleStatus, string> = {
  想法: "text-amber-800",
  已规划: "text-sky-800",
  AI开发中: "text-violet-800",
  开发中: "text-blue-800",
  待验收: "text-orange-800",
  完成: "text-emerald-800",
  放弃: "text-slate-500",
};

export function RequirementStatusKanban({
  projectSlug,
  requirements: initialReqs,
  items: initialItems,
  showProjectName = false,
  onOpen,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState<RequirementKanbanItem[]>(() =>
    buildItems(projectSlug, initialReqs, initialItems)
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  /** 点列头筛选到该状态；点旁边空白取消 */
  const [focusColumn, setFocusColumn] = useState<RequirementLifecycleStatus | null>(null);

  useEffect(() => {
    setItems(buildItems(projectSlug, initialReqs, initialItems));
  }, [projectSlug, initialReqs, initialItems]);

  const boardItems = useMemo(() => {
    if (initialItems?.length) return items;
    const reqs = items.map((i) => i.req);
    return items.filter((i) => isLeafRequirement(i.req, reqs));
  }, [items, initialItems]);

  const columns = useMemo(() => {
    const all = [...REQUIREMENT_KANBAN_COLUMNS];
    if (!focusColumn) return all;
    return all.filter((c) => c === focusColumn);
  }, [focusColumn]);

  const grouped = useMemo(() => {
    const map = new Map<string, RequirementKanbanItem[]>();
    for (const col of REQUIREMENT_KANBAN_COLUMNS) map.set(col, []);
    for (const item of boardItems) {
      const col = requirementKanbanColumn(item.req);
      map.get(col)!.push(item);
    }
    return map;
  }, [boardItems]);

  function moveToColumn(reqId: string, column: string) {
    const item = items.find((i) => i.req.id === reqId);
    if (!item) return;
    if (requirementKanbanColumn(item.req) === column) return;

    const nextTags = applyLifecycleStatus(item.req.status_tags ?? [], column);
    const snapshot = items;
    setItems((prev) =>
      prev.map((i) =>
        i.req.id === reqId ? { ...i, req: { ...i.req, status_tags: nextTags } } : i
      )
    );
    setMessage(null);
    startTransition(async () => {
      try {
        await saveRequirementDetailAction({
          requirementId: reqId,
          projectSlug: item.projectSlug,
          updates: { status_tags: nextTags },
        });
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "移动失败");
        setItems(snapshot);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          需求看板 · {REQUIREMENT_STATUS_HINT}
          {pending ? " · 保存中…" : null}
          {focusColumn ? (
            <span className="ml-1 text-indigo-600">
              · 仅看「{focusColumn}」· 点旁边空白取消筛选
            </span>
          ) : (
            <span className="ml-1 text-slate-400">· 点列名可只看该状态</span>
          )}
        </p>
        {message ? <span className="text-xs text-red-600">{message}</span> : null}
      </div>

      <div
        className="flex min-h-[12rem] gap-3 overflow-x-auto pb-2"
        onClick={() => {
          if (focusColumn) setFocusColumn(null);
        }}
      >
        {columns.map((col) => {
          const colItems = grouped.get(col) ?? [];
          const isOver = overColumn === col;
          const isFocused = focusColumn === col;
          return (
            <div
              key={col}
              className={cn(
                "flex w-64 shrink-0 flex-col rounded-xl border bg-slate-50",
                isOver ? "border-indigo-400 ring-2 ring-indigo-200" : "border-slate-200",
                isFocused ? "ring-2 ring-indigo-200" : ""
              )}
              onClick={(e) => e.stopPropagation()}
              onDragOver={(e) => {
                e.preventDefault();
                setOverColumn(col);
              }}
              onDragLeave={() => {
                setOverColumn((c) => (c === col ? null : c));
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/req-id") || draggingId;
                setOverColumn(null);
                setDraggingId(null);
                if (id) moveToColumn(id, col);
              }}
            >
              <button
                type="button"
                className="flex w-full items-center justify-between border-b border-slate-200 px-3 py-2 text-left hover:bg-white/70"
                title={isFocused ? "再次点击取消筛选" : "只看此状态"}
                onClick={() =>
                  setFocusColumn((prev) => (prev === col ? null : col))
                }
              >
                <span
                  className={cn(
                    "text-sm font-semibold",
                    COLUMN_TONE[col as RequirementLifecycleStatus] ?? "text-slate-800"
                  )}
                >
                  {col}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-500 ring-1 ring-slate-200">
                  {colItems.length}
                </span>
              </button>
              <ul className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto p-2">
                {colItems.length === 0 ? (
                  <li className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
                    拖到此处
                  </li>
                ) : (
                  colItems.map((item) => (
                    <li key={item.req.id}>
                      <article
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/req-id", item.req.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDraggingId(item.req.id);
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setOverColumn(null);
                        }}
                        className={cn(
                          "cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing",
                          draggingId === item.req.id ? "opacity-60" : "hover:border-indigo-200"
                        )}
                      >
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => onOpen?.(item.req.id, item.projectSlug)}
                        >
                          {showProjectName ? (
                            <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-indigo-600">
                              {item.projectName}
                            </div>
                          ) : null}
                          <div className="text-sm font-medium text-slate-900 hover:text-indigo-700">
                            {item.req.title}
                          </div>
                          {item.req.priority ? (
                            <div className="mt-1.5">
                              <StudioBadge
                                tone={item.req.priority === "P0" ? "p0" : "muted"}
                              >
                                {item.req.priority}
                              </StudioBadge>
                            </div>
                          ) : null}
                          {item.req.assignees?.length ? (
                            <p className="mt-1.5 text-[11px] text-slate-400">
                              {item.req.assignees.join("、")}
                            </p>
                          ) : null}
                          {item.req.next_step?.trim() ? (
                            <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">
                              {item.req.next_step}
                            </p>
                          ) : null}
                        </button>
                      </article>
                    </li>
                  ))
                )}
              </ul>
            </div>
          );
        })}
        {/* 右侧留白，方便点空白取消筛选 */}
        {focusColumn ? (
          <div
            className="min-w-[4rem] flex-1 self-stretch rounded-xl border border-dashed border-slate-200/80"
            title="点击取消筛选"
            aria-label="取消筛选"
          />
        ) : null}
      </div>
    </div>
  );
}

function buildItems(
  projectSlug: string | undefined,
  requirements: Requirement[] | undefined,
  items: RequirementKanbanItem[] | undefined
): RequirementKanbanItem[] {
  if (items?.length) return items;
  const slug = projectSlug ?? "";
  return (requirements ?? []).map((req) => ({
    req,
    projectSlug: slug,
    projectName: "",
  }));
}
