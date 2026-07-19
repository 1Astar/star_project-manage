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
    // 未列入标准列的自建状态 → 落「其他」
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

type Props = {
  projectSlug: string;
  requirements: Requirement[];
  onOpen?: (reqId: string) => void;
};

export function RequirementStatusKanban({ projectSlug, requirements: initial, onOpen }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [requirements, setRequirements] = useState(initial);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setRequirements(initial);
  }, [initial]);

  const boardReqs = useMemo(
    () => requirements.filter((r) => isLeafRequirement(r, requirements)),
    [requirements]
  );

  const columns = useMemo(() => {
    const extras = new Set<string>();
    for (const req of boardReqs) {
      const col = requirementColumn(req);
      if (col === "其他") extras.add("其他");
    }
    const list: string[] = [...REQUIREMENT_KANBAN_COLUMNS];
    if (extras.has("其他")) list.push("其他");
    return list;
  }, [boardReqs]);

  const grouped = useMemo(() => {
    const map = new Map<string, Requirement[]>();
    for (const col of columns) map.set(col, []);
    for (const req of boardReqs) {
      const col = requirementColumn(req);
      if (!map.has(col)) map.set(col, []);
      map.get(col)!.push(req);
    }
    return map;
  }, [boardReqs, columns]);

  function moveToColumn(reqId: string, column: string) {
    const req = requirements.find((r) => r.id === reqId);
    if (!req) return;
    if (requirementColumn(req) === column) return;

    const nextTags = applyColumnTag(req.status_tags ?? [], column);
    setRequirements((prev) =>
      prev.map((r) => (r.id === reqId ? { ...r, status_tags: nextTags } : r))
    );
    setMessage(null);
    startTransition(async () => {
      try {
        await saveRequirementDetailAction({
          requirementId: reqId,
          projectSlug,
          updates: { status_tags: nextTags },
        });
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "移动失败");
        setRequirements(initial);
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
          const items = grouped.get(col) ?? [];
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
                  {items.length}
                </span>
              </div>
              <ul className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto p-2">
                {items.length === 0 ? (
                  <li className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
                    拖到此处
                  </li>
                ) : (
                  items.map((req) => (
                    <li key={req.id}>
                      <article
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/req-id", req.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDraggingId(req.id);
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setOverColumn(null);
                        }}
                        className={cn(
                          "cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing",
                          draggingId === req.id ? "opacity-60" : "hover:border-indigo-200"
                        )}
                      >
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => onOpen?.(req.id)}
                        >
                          <div className="text-sm font-medium text-slate-900 hover:text-indigo-700">
                            {req.title}
                          </div>
                          {req.priority ? (
                            <div className="mt-1.5">
                              <StudioBadge tone={req.priority === "P0" ? "p0" : "muted"}>
                                {req.priority}
                              </StudioBadge>
                            </div>
                          ) : null}
                          {req.assignees?.length ? (
                            <p className="mt-1.5 text-[11px] text-slate-400">
                              {req.assignees.join("、")}
                            </p>
                          ) : null}
                          {req.next_step?.trim() ? (
                            <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">
                              {req.next_step}
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
