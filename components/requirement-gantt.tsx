"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isWeekend,
  max as maxDate,
  min as minDate,
  parseISO,
  startOfDay,
} from "date-fns";
import { zhCN } from "date-fns/locale";
import { saveRequirementDetailAction } from "@/lib/actions";
import type { ModuleNode, Requirement } from "@/lib/types";
import { REQUIREMENT_DONE_TAG, requirementIsDone } from "@/lib/types";
import {
  childrenOf,
  displayEstimateHours,
  flattenRequirementTree,
  isLeafRequirement,
  leafRequirementsOf,
} from "@/lib/requirement-tree";
import { cn } from "@/lib/utils";

const DAY_PX = 32;
const LABEL_PX = 220;

type GanttRow = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  statusLabel: string;
  done: boolean;
  depth: number;
  isParent: boolean;
  hasChildren: boolean;
  hoursLabel: string | null;
};

type DragMode = "move" | "resize-start" | "resize-end";

type DragState = {
  id: string;
  mode: DragMode;
  originX: number;
  originStart: Date;
  originEnd: Date;
  moved: boolean;
};

function parseDay(raw: string | null | undefined): Date | null {
  if (!raw?.trim()) return null;
  try {
    const d = startOfDay(parseISO(raw.slice(0, 10)));
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function toIsoDay(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function computeNext(
  drag: DragState,
  clientX: number
): { start: Date; end: Date } {
  const daysDelta = Math.round((clientX - drag.originX) / DAY_PX);
  if (drag.mode === "move") {
    return {
      start: addDays(drag.originStart, daysDelta),
      end: addDays(drag.originEnd, daysDelta),
    };
  }
  if (drag.mode === "resize-start") {
    let start = addDays(drag.originStart, daysDelta);
    if (start > drag.originEnd) start = drag.originEnd;
    return { start, end: drag.originEnd };
  }
  let end = addDays(drag.originEnd, daysDelta);
  if (end < drag.originStart) end = drag.originStart;
  return { start: drag.originStart, end };
}

function toRow(
  req: Requirement,
  all: Requirement[],
  depth: number
): GanttRow | null {
  const isParent = !isLeafRequirement(req, all);
  let start =
    parseDay(req.submitted_at) ?? parseDay(req.created_at) ?? parseDay(req.due_date);
  let end =
    parseDay(req.due_date) ?? parseDay(req.completed_at) ?? (start ? addDays(start, 3) : null);

  if (isParent) {
    const leaves = leafRequirementsOf(req.id, all);
    const leafStarts = leaves
      .map((l) => parseDay(l.submitted_at) ?? parseDay(l.created_at) ?? parseDay(l.due_date))
      .filter(Boolean) as Date[];
    const leafEnds = leaves
      .map(
        (l) =>
          parseDay(l.due_date) ??
          parseDay(l.completed_at) ??
          (parseDay(l.submitted_at) ? addDays(parseDay(l.submitted_at)!, 3) : null)
      )
      .filter(Boolean) as Date[];
    if (leafStarts.length) start = minDate(leafStarts);
    if (leafEnds.length) end = maxDate(leafEnds);
  }

  if (!start) return null;
  if (!end || end < start) end = start;
  const tags = req.status_tags ?? [];
  const statusLabel = tags[0] || (requirementIsDone(req) ? REQUIREMENT_DONE_TAG : "待开始");
  const hours = displayEstimateHours(req, all);
  return {
    id: req.id,
    title: req.title,
    start,
    end,
    statusLabel,
    done: requirementIsDone(req),
    depth,
    isParent,
    hasChildren: isParent,
    hoursLabel: hours != null ? `${hours}h` : null,
  };
}

type Props = {
  projectSlug: string;
  requirements: Requirement[];
  modules?: ModuleNode[];
  onOpen?: (reqId: string) => void;
};

function reqMatchesModuleFilter(
  req: Requirement,
  filterId: string,
  modulesById: Map<string, ModuleNode>
): boolean {
  if (!filterId) return true;
  if (filterId === "__none__") return !req.module_l1_id;
  if (req.module_l1_id === filterId) return true;
  if (req.module_l2_id === filterId) return true;
  let cur = req.module_l2_id ? modulesById.get(req.module_l2_id) : undefined;
  while (cur) {
    if (cur.id === filterId) return true;
    cur = cur.parent_id ? modulesById.get(cur.parent_id) : undefined;
  }
  return false;
}

export function RequirementGantt({
  projectSlug,
  requirements,
  modules = [],
  onOpen,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [onlyWithDates, setOnlyWithDates] = useState(true);
  const [filterModuleId, setFilterModuleId] = useState("");
  const [overrides, setOverrides] = useState<Record<string, { start: Date; end: Date }>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [collapseReady, setCollapseReady] = useState(false);
  const dragRef = useRef<DragState | null>(null);
  const onOpenRef = useRef(onOpen);
  const projectSlugRef = useRef(projectSlug);
  onOpenRef.current = onOpen;
  projectSlugRef.current = projectSlug;

  const modulesById = useMemo(
    () => new Map(modules.map((m) => [m.id, m])),
    [modules]
  );

  const filteredRequirements = useMemo(() => {
    if (!filterModuleId) return requirements;
    const matched = new Set(
      requirements
        .filter((r) => reqMatchesModuleFilter(r, filterModuleId, modulesById))
        .map((r) => r.id)
    );
    const keep = new Set(matched);
    for (const id of matched) {
      let cur = requirements.find((r) => r.id === id);
      while (cur?.parent_id) {
        keep.add(cur.parent_id);
        cur = requirements.find((r) => r.id === cur!.parent_id);
      }
    }
    return requirements.filter((r) => keep.has(r.id));
  }, [requirements, filterModuleId, modulesById]);

  const moduleOptions = useMemo(() => {
    return modules
      .slice()
      .sort(
        (a, b) =>
          a.level - b.level ||
          a.sort_order - b.sort_order ||
          a.name.localeCompare(b.name, "zh")
      );
  }, [modules]);

  useEffect(() => {
    setOverrides({});
  }, [filteredRequirements]);

  // 默认收起深度 ≥ 2 的父节点（与需求表一致）
  useEffect(() => {
    if (collapseReady) return;
    const tree = flattenRequirementTree(filteredRequirements);
    const next = new Set<string>();
    for (const { req, depth } of tree) {
      if (depth >= 2 && childrenOf(req.id, filteredRequirements).length > 0) {
        next.add(req.id);
      }
    }
    setCollapsed(next);
    setCollapseReady(true);
  }, [filteredRequirements, collapseReady]);

  useEffect(() => {
    setCollapseReady(false);
  }, [projectSlug, filterModuleId]);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      if (Math.abs(e.clientX - drag.originX) > 4) drag.moved = true;
      const next = computeNext(drag, e.clientX);
      setOverrides((prev) => ({ ...prev, [drag.id]: next }));
    }

    function onUp(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      setDraggingId(null);
      const next = computeNext(drag, e.clientX);
      setOverrides((prev) => ({ ...prev, [drag.id]: next }));

      if (!drag.moved) {
        onOpenRef.current?.(drag.id);
        return;
      }

      const changed =
        toIsoDay(next.start) !== toIsoDay(drag.originStart) ||
        toIsoDay(next.end) !== toIsoDay(drag.originEnd);
      if (!changed) return;

      setMessage(null);
      startTransition(async () => {
        try {
          await saveRequirementDetailAction({
            requirementId: drag.id,
            projectSlug: projectSlugRef.current,
            updates: {
              submitted_at: toIsoDay(next.start),
              due_date: toIsoDay(next.end),
            },
          });
          router.refresh();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "保存日期失败");
          setOverrides((prev) => {
            const copy = { ...prev };
            delete copy[drag.id];
            return copy;
          });
        }
      });
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [router]);

  const baseRows = useMemo(() => {
    const list: GanttRow[] = [];
    const tree = flattenRequirementTree(filteredRequirements);
    for (const { req, depth } of tree) {
      const row = toRow(req, filteredRequirements, depth);
      if (!row) {
        if (!onlyWithDates) {
          const fallback = startOfDay(new Date());
          list.push({
            id: req.id,
            title: req.title,
            start: fallback,
            end: addDays(fallback, 2),
            statusLabel: (req.status_tags ?? [])[0] || "待开始",
            done: requirementIsDone(req),
            depth,
            isParent: !isLeafRequirement(req, filteredRequirements),
            hasChildren: !isLeafRequirement(req, filteredRequirements),
            hoursLabel: null,
          });
        }
        continue;
      }
      list.push(row);
    }
    return list;
  }, [filteredRequirements, onlyWithDates]);

  const rows = useMemo(
    () =>
      baseRows.map((r) => {
        const o = overrides[r.id];
        return o ? { ...r, start: o.start, end: o.end } : r;
      }),
    [baseRows, overrides]
  );

  const visibleRows = useMemo(() => {
    if (collapsed.size === 0) return rows;
    const hidden = new Set<string>();
    function hideDescendants(id: string) {
      for (const child of childrenOf(id, filteredRequirements)) {
        hidden.add(child.id);
        hideDescendants(child.id);
      }
    }
    for (const id of collapsed) hideDescendants(id);
    return rows.filter((r) => !hidden.has(r.id));
  }, [rows, collapsed, filteredRequirements]);

  const range = useMemo(() => {
    if (visibleRows.length === 0) {
      const today = startOfDay(new Date());
      return { start: addDays(today, -7), end: addDays(today, 21) };
    }
    const starts = visibleRows.map((r) => r.start);
    const ends = visibleRows.map((r) => r.end);
    return {
      start: addDays(minDate(starts), -3),
      end: addDays(maxDate(ends), 5),
    };
  }, [visibleRows]);

  const days = useMemo(
    () => eachDayOfInterval({ start: range.start, end: range.end }),
    [range]
  );

  const totalWidth = days.length * DAY_PX;
  const today = startOfDay(new Date());
  const todayOffset = differenceInCalendarDays(today, range.start);

  function startDrag(e: React.PointerEvent, row: GanttRow, mode: DragMode) {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      id: row.id,
      mode,
      originX: e.clientX,
      originStart: row.start,
      originEnd: row.end,
      moved: false,
    };
    setDraggingId(row.id);
  }

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setCollapsed(new Set());
  }

  function collapseAll() {
    const next = new Set<string>();
    for (const { req } of flattenRequirementTree(filteredRequirements)) {
      if (childrenOf(req.id, filteredRequirements).length > 0) next.add(req.id);
    }
    setCollapsed(next);
  }

  const hasTree = useMemo(
    () =>
      filteredRequirements.some(
        (r) => childrenOf(r.id, filteredRequirements).length > 0
      ),
    [filteredRequirements]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          拖动色条整体平移 · 左右边拖改提出/截止 · 轻点打开详情 · 标题旁可收起子层
          {pending ? " · 保存中…" : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="text-slate-500">模块</span>
            <select
              value={filterModuleId}
              onChange={(e) => setFilterModuleId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
            >
              <option value="">全部</option>
              <option value="__none__">未分组</option>
              {moduleOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {"　".repeat(Math.max(0, m.level - 1))}
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          {message ? <span className="text-xs text-red-600">{message}</span> : null}
          {hasTree ? (
            <>
              <button
                type="button"
                onClick={expandAll}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                全部展开
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                全部收起
              </button>
            </>
          ) : null}
          <label className="flex items-center gap-1.5 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={onlyWithDates}
              onChange={(e) => setOnlyWithDates(e.target.checked)}
              className="rounded border-slate-300"
            />
            仅显示有日期的需求
          </label>
        </div>
      </div>

      {visibleRows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-400">
          暂无可排布的需求。在详情里填写提出时间 / 截止日期后再看甘特。
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <div style={{ minWidth: LABEL_PX + totalWidth }} className="relative select-none">
              <div className="sticky top-0 z-20 flex border-b border-slate-200 bg-slate-50">
                <div
                  className="sticky left-0 z-30 shrink-0 border-r border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500"
                  style={{ width: LABEL_PX }}
                >
                  需求
                </div>
                <div className="relative flex" style={{ width: totalWidth }}>
                  {days.map((day) => {
                    const showLabel =
                      day.getDate() === 1 || differenceInCalendarDays(day, range.start) === 0;
                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "shrink-0 border-r border-slate-100 text-center",
                          isWeekend(day) && "bg-slate-100/80"
                        )}
                        style={{ width: DAY_PX }}
                        title={format(day, "yyyy-MM-dd")}
                      >
                        <div className="py-0.5 text-[9px] text-slate-400">
                          {showLabel ? format(day, "M月", { locale: zhCN }) : ""}
                        </div>
                        <div className="pb-1 text-[10px] text-slate-600">{format(day, "d")}</div>
                      </div>
                    );
                  })}
                  {todayOffset >= 0 && todayOffset < days.length ? (
                    <div
                      className="pointer-events-none absolute bottom-0 top-0 w-px bg-rose-400"
                      style={{ left: todayOffset * DAY_PX + DAY_PX / 2 }}
                      title="今天"
                    />
                  ) : null}
                </div>
              </div>

              <ul>
                {visibleRows.map((row) => {
                  const left = differenceInCalendarDays(row.start, range.start) * DAY_PX;
                  const span = Math.max(1, differenceInCalendarDays(row.end, row.start) + 1);
                  const width = span * DAY_PX - 4;
                  return (
                    <li
                      key={row.id}
                      className="flex border-b border-slate-100 hover:bg-indigo-50/30"
                    >
                      <div
                        className={cn(
                          "sticky left-0 z-10 flex shrink-0 items-center gap-0.5 border-r border-slate-100 bg-white px-1.5 py-2.5 text-sm",
                          row.isParent ? "font-semibold text-slate-900" : "font-medium text-slate-800"
                        )}
                        style={{ width: LABEL_PX, paddingLeft: 8 + row.depth * 14 }}
                      >
                        {row.hasChildren ? (
                          <button
                            type="button"
                            className="w-5 shrink-0 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCollapse(row.id);
                            }}
                            title={collapsed.has(row.id) ? "展开子需求" : "收起子需求"}
                          >
                            {collapsed.has(row.id) ? "▶" : "▼"}
                          </button>
                        ) : (
                          <span className="inline-block w-5 shrink-0 text-center text-slate-200">
                            {row.depth > 0 ? "·" : ""}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpen?.(row.id)}
                          className="min-w-0 flex-1 truncate text-left hover:text-indigo-700"
                          title={row.title}
                        >
                          {row.title}
                          {row.hoursLabel ? (
                            <span className="ml-1 text-[10px] font-normal text-slate-400">
                              {row.hoursLabel}
                            </span>
                          ) : null}
                        </button>
                      </div>
                      <div className="relative h-11" style={{ width: totalWidth }}>
                        {days.map((day) => (
                          <div
                            key={day.toISOString()}
                            className={cn(
                              "absolute bottom-0 top-0 border-r border-slate-50",
                              isWeekend(day) && "bg-slate-50/80"
                            )}
                            style={{
                              left: differenceInCalendarDays(day, range.start) * DAY_PX,
                              width: DAY_PX,
                            }}
                          />
                        ))}
                        {todayOffset >= 0 && todayOffset < days.length ? (
                          <div
                            className="pointer-events-none absolute bottom-0 top-0 z-[1] w-px bg-rose-300/80"
                            style={{ left: todayOffset * DAY_PX + DAY_PX / 2 }}
                          />
                        ) : null}
                        <div
                          role="presentation"
                          onPointerDown={(e) => startDrag(e, row, "move")}
                          className={cn(
                            "absolute top-2 z-[2] flex h-7 items-stretch rounded-md text-[11px] font-medium text-white shadow-sm",
                            row.done
                              ? "bg-emerald-500"
                              : row.isParent
                                ? "bg-slate-500/90"
                                : "bg-indigo-500",
                            draggingId === row.id
                              ? "ring-2 ring-indigo-300 opacity-90"
                              : "hover:brightness-110",
                            "cursor-grab active:cursor-grabbing"
                          )}
                          style={{ left: left + 2, width: Math.max(width, DAY_PX - 4) }}
                          title={`${row.title}\n${format(row.start, "MM/dd")} – ${format(row.end, "MM/dd")}`}
                        >
                          <span
                            onPointerDown={(e) => startDrag(e, row, "resize-start")}
                            className="w-2.5 shrink-0 cursor-ew-resize rounded-l-md bg-black/25 hover:bg-black/40"
                            title="拖改提出日"
                          />
                          <span className="pointer-events-none flex min-w-0 flex-1 items-center truncate px-1.5">
                            {row.statusLabel} · {format(row.start, "M/d")}-{format(row.end, "M/d")}
                          </span>
                          <span
                            onPointerDown={(e) => startDrag(e, row, "resize-end")}
                            className="w-2.5 shrink-0 cursor-ew-resize rounded-r-md bg-black/25 hover:bg-black/40"
                            title="拖改截止日"
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
