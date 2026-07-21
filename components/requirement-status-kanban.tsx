"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveRequirementDetailAction } from "@/lib/actions";
import { StudioBadge } from "@/components/studio/shell";
import { REQUIREMENT_DONE_TAG, type Requirement } from "@/lib/types";
import { isLeafRequirement } from "@/lib/requirement-tree";
import { cn } from "@/lib/utils";

/** 看板固定列顺序（状态标签） */
export const REQUIREMENT_KANBAN_COLUMNS = [
  "待开始",
  "评审",
  "开发中",
  "待测试",
  "待验收",
  "完成",
  "阻塞",
] as const;

const KNOWN_STATUS = new Set<string>([
  ...REQUIREMENT_KANBAN_COLUMNS,
  "已完成",
  "已做",
  "进行中",
  "待联调",
  "搁置",
  "已记录",
]);

function normalizeDone(tag: string) {
  if (tag === "已完成" || tag === "已做") return REQUIREMENT_DONE_TAG;
  if (tag === "进行中") return "开发中";
  return tag;
}

export function requirementColumn(req: Requirement): string {
  const tags = (req.status_tags ?? []).map(normalizeDone);
  for (const col of REQUIREMENT_KANBAN_COLUMNS) {
    if (tags.includes(col)) return col;
  }
  if (tags.some((t) => KNOWN_STATUS.has(t) || t.length > 0)) {
    return "其他";
  }
  return "待开始";
}

function applyColumnTag(prev: string[], column: string): string[] {
  const retained = (prev ?? [])
    .map(normalizeDone)
    .filter((t) => !KNOWN_STATUS.has(t) && t !== column);
  if (column === "其他") return retained.length ? retained : ["待开始"];
  return [column, ...retained];
}

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

  useEffect(() => {
    setItems(buildItems(projectSlug, initialReqs, initialItems));
  }, [projectSlug, initialReqs, initialItems]);

  const boardItems = useMemo(() => {
    if (initialItems?.length) return items;
    const reqs = items.map((i) => i.req);
    return items.filter((i) => isLeafRequirement(i.req, reqs));
  }, [items, initialItems]);

  const columns = useMemo(() => {
    const extras = new Set<string>();
    for (const item of boardItems) {
      if (requirementColumn(item.req) === "其他") extras.add("其他");
    }
    const list: string[] = [...REQUIREMENT_KANBAN_COLUMNS];
    if (extras.has("其他")) list.push("其他");
    return list;
  }, [boardItems]);

  const grouped = useMemo(() => {
    const map = new Map<string, RequirementKanbanItem[]>();
    for (const col of columns) map.set(col, []);
    for (const item of boardItems) {
      const col = requirementColumn(item.req);
      if (!map.has(col)) map.set(col, []);
      map.get(col)!.push(item);
    }
    return map;
  }, [boardItems, columns]);

  function moveToColumn(reqId: string, column: string) {
    const item = items.find((i) => i.req.id === reqId);
    if (!item) return;
    if (requirementColumn(item.req) === column) return;

    const nextTags = applyColumnTag(item.req.status_tags ?? [], column);
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
          需求看板 · 按状态标签分列 · 拖卡片到其他列即可改状态
          {pending ? " · 保存中…" : null}
        </p>
        {message ? <span className="text-xs text-red-600">{message}</span> : null}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((col) => {
          const colItems = grouped.get(col) ?? [];
          const isOver = overColumn === col;
          return (
            <div
              key={col}
              className={cn(
                "flex w-64 shrink-0 flex-col rounded-xl border bg-slate-50",
                isOver ? "border-indigo-400 ring-2 ring-indigo-200" : "border-slate-200"
              )}
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
              <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                <span className="text-sm font-semibold text-slate-800">{col}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-500 ring-1 ring-slate-200">
                  {colItems.length}
                </span>
              </div>
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
