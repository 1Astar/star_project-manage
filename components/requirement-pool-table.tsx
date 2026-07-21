"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StudioBadge } from "@/components/studio/shell";
import type { PoolColumnDef, PoolColumnType, Requirement, RequirementAttachment, RequirementType } from "@/lib/types";
import { REQUIREMENT_DONE_TAG, REQUIREMENT_TYPE_LABELS } from "@/lib/types";
import { createPoolColumnAction, deletePoolColumnAction } from "@/lib/actions";
import {
  childrenOf,
  displayEstimateHours,
  flattenRequirementTree,
  isLeafRequirement,
} from "@/lib/requirement-tree";
import { cn } from "@/lib/utils";
import { parseAgentSourceLabel } from "@/lib/cursor-actor";

export type PoolColumnKey =
  | "title"
  | "req_type"
  | "status_tags"
  | "next_step"
  | "summary"
  | "detail_work"
  | "acceptance_criteria"
  | "assignees"
  | "priority"
  | "req_source"
  | "req_source_note"
  | "inspiration_source"
  | "hours"
  | "submitted_at"
  | "due_date"
  | "completed_at"
  | "optimization_notes"
  | "known_issues"
  | "difficulty_notes"
  | "scenario"
  | "prd_link"
  | "prototype_link"
  | "attachments";

const ALL_COLUMNS: { key: PoolColumnKey; label: string; sortable?: boolean }[] = [
  { key: "title", label: "需求名称", sortable: true },
  { key: "req_type", label: "类型", sortable: true },
  { key: "next_step", label: "下一步" },
  { key: "status_tags", label: "状态", sortable: true },
  { key: "summary", label: "内容摘要" },
  { key: "detail_work", label: "需求内容" },
  { key: "acceptance_criteria", label: "验收标准" },
  { key: "optimization_notes", label: "AI补充" },
  { key: "assignees", label: "指派" },
  { key: "priority", label: "优先级", sortable: true },
  { key: "req_source", label: "需求来源" },
  { key: "req_source_note", label: "来源备注" },
  { key: "inspiration_source", label: "灵感来源" },
  { key: "hours", label: "工时", sortable: true },
  { key: "submitted_at", label: "提出时间", sortable: true },
  { key: "due_date", label: "结束时间", sortable: true },
  { key: "completed_at", label: "完成时间", sortable: true },
  { key: "known_issues", label: "已知问题" },
  { key: "difficulty_notes", label: "难点说明" },
  { key: "scenario", label: "使用场景" },
  { key: "prd_link", label: "PRD链接" },
  { key: "prototype_link", label: "原型链接" },
  { key: "attachments", label: "附图" },
];

const DEFAULT_VISIBLE: PoolColumnKey[] = [
  "title",
  "req_type",
  "next_step",
  "status_tags",
  "summary",
  "optimization_notes",
  "assignees",
  "priority",
  "req_source",
  "inspiration_source",
  "hours",
  "submitted_at",
  "due_date",
  "attachments",
];

/** 列 id：内置 key，或 `custom:${PoolColumnDef.key}` */
type ColumnId = string;

/** 仅名称固定靠左；其余可隐藏、可调序 */
function pinLeadingColumns(order: ColumnId[]): ColumnId[] {
  const rest = order.filter((k) => k !== "title");
  return ["title", ...rest];
}

function isValidColumnId(id: string, customKeys: Set<string>): boolean {
  if (isBuiltinColumn(id)) return true;
  const ck = parseCustomColumnKey(id);
  return ck != null && customKeys.has(ck);
}

const COLUMN_TYPES: { value: PoolColumnType; label: string }[] = [
  { value: "text", label: "文本" },
  { value: "number", label: "数字" },
  { value: "date", label: "日期" },
  { value: "checkbox", label: "勾选" },
  { value: "select", label: "单选" },
  { value: "url", label: "链接" },
];

const TITLE_STICKY_PX = 220;
const CHECKBOX_PX = 88;
const TITLE_LEFT = CHECKBOX_PX;

type SortKey =
  | "title"
  | "req_type"
  | "priority"
  | "hours"
  | "submitted_at"
  | "due_date"
  | "completed_at"
  | "status_tags"
  | "sort_order";
type SortDir = "asc" | "desc";

type Props = {
  projectId: string;
  projectSlug: string;
  requirements: Requirement[];
  attachments: RequirementAttachment[];
  columnDefs: PoolColumnDef[];
  tagOptions?: string[];
  drawerReqId: string | null;
  pending: boolean;
  onOpenReq: (id: string) => void;
  onOpenLightbox: (url: string) => void;
  onAddChild: (parentId: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onDedupe: () => void;
  onInlineSave: (
    requirementId: string,
    updates: Partial<{
      title: string;
      type: RequirementType;
      next_step: string | null;
      priority: string | null;
      product_estimate_hours: number | null;
      direct_hours: number | null;
      sort_order: number;
      parent_id: string | null;
      due_date: string | null;
      submitted_at: string | null;
      detail_work: string | null;
      acceptance_criteria: string | null;
      optimization_notes: string | null;
      known_issues: string | null;
      difficulty_notes: string | null;
      scenario: string | null;
      req_source_note: string | null;
      prd_link: string | null;
      prototype_link: string | null;
      custom_fields: Record<string, string | number | boolean | null>;
    }>
  ) => void;
  onReorder: (orderedIds: string[]) => void;
  /** 拖拽：排序 + 可选改父（挂子 / 同级） */
  onTreeDrop?: (input: {
    dragId: string;
    overId: string;
    place: "before" | "after" | "child";
    orderedIds: string[];
    nextParentId: string | null;
  }) => void;
};

type DisplayColumn =
  | {
      id: ColumnId;
      kind: "builtin";
      key: PoolColumnKey;
      label: string;
      sortable?: boolean;
    }
  | {
      id: ColumnId;
      kind: "custom";
      label: string;
      def: PoolColumnDef;
    };

function isImage(mime: string | null, url: string) {
  if (mime?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url);
}

function summaryOf(req: Requirement) {
  return (
    req.detail_work?.trim() ||
    req.acceptance_criteria?.trim() ||
    req.next_step?.trim() ||
    ""
  );
}

function storageKey(projectId: string) {
  return `star-pm:pool-cols:${projectId}`;
}

function storageOrderKey(projectId: string) {
  return `star-pm:pool-col-order:${projectId}`;
}

function storageWidthsKey(projectId: string) {
  return `star-pm:pool-col-widths:${projectId}`;
}

const DEFAULT_POOL_COL_WIDTHS: Record<string, number> = {
  title: 220,
  req_type: 96,
  next_step: 220,
  status_tags: 110,
  summary: 200,
  detail_work: 200,
  acceptance_criteria: 180,
  assignees: 100,
  priority: 72,
  req_source: 96,
  req_source_note: 120,
  inspiration_source: 120,
  hours: 72,
  submitted_at: 110,
  due_date: 110,
  completed_at: 110,
  optimization_notes: 160,
  known_issues: 160,
  difficulty_notes: 160,
  scenario: 160,
  prd_link: 120,
  prototype_link: 120,
  attachments: 88,
};

/** 旧版：类型徽章嵌在名称列内的偏好；迁移到「类型」列显隐后可忽略 */
function storageTypeBadgeKey(projectId: string) {
  return `star-pm:pool-type-badge:${projectId}`;
}

function isAncestorOf(
  requirements: Requirement[],
  ancestorId: string,
  nodeId: string
): boolean {
  const byId = new Map(requirements.map((r) => [r.id, r]));
  let cur = byId.get(nodeId);
  const seen = new Set<string>();
  while (cur?.parent_id) {
    if (cur.parent_id === ancestorId) return true;
    if (seen.has(cur.id)) break;
    seen.add(cur.id);
    cur = byId.get(cur.parent_id);
  }
  return false;
}

function ensureReqTypeColumn(ids: ColumnId[], insert: boolean): ColumnId[] {
  if (!insert || ids.includes("req_type")) return ids;
  const titleIdx = ids.indexOf("title");
  if (titleIdx >= 0) {
    const next = [...ids];
    next.splice(titleIdx + 1, 0, "req_type");
    return next;
  }
  return ["req_type", ...ids];
}

function isBuiltinColumn(key: string): key is PoolColumnKey {
  return ALL_COLUMNS.some((c) => c.key === key);
}

function customColumnStorageKey(defKey: string) {
  return `custom:${defKey}`;
}

function parseCustomColumnKey(key: string): string | null {
  return key.startsWith("custom:") ? key.slice("custom:".length) : null;
}

function priorityRank(p: string | null) {
  if (p === "P0") return 0;
  if (p === "P1") return 1;
  if (p === "P2") return 2;
  if (p === "P3") return 3;
  return 9;
}

function InlineCell({
  value,
  type = "text",
  placeholder,
  className,
  wrap = false,
  onCommit,
}: {
  value: string;
  type?: "text" | "number" | "date";
  placeholder?: string;
  className?: string;
  /** 默认换行展示长文，避免单行截断看不到 */
  wrap?: boolean;
  onCommit: (next: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (!editing) return;
    if (wrap) areaRef.current?.focus();
    else inputRef.current?.focus();
  }, [editing, wrap]);

  function commit() {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  }

  if (!editing) {
    return (
      <button
        type="button"
        className={cn(
          "block w-full rounded px-1 py-0.5 text-left hover:bg-white/80 hover:ring-1 hover:ring-slate-200",
          wrap ? "whitespace-normal break-words" : "truncate",
          className,
          !value && "text-slate-300"
        )}
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
      >
        {value || placeholder || "空白"}
      </button>
    );
  }

  if (wrap) {
    return (
      <textarea
        ref={areaRef}
        value={draft}
        rows={3}
        className={cn(
          "w-full resize-y rounded border border-indigo-300 bg-white px-1 py-0.5 text-sm outline-none",
          className
        )}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <input
      ref={inputRef}
      type={type}
      value={draft}
      className={cn(
        "w-full rounded border border-indigo-300 bg-white px-1 py-0.5 text-sm outline-none",
        className
      )}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
    />
  );
}

export function RequirementPoolTable({
  projectId,
  projectSlug,
  requirements,
  attachments,
  columnDefs,
  drawerReqId,
  pending,
  onOpenReq,
  onOpenLightbox,
  onAddChild,
  onBulkDelete,
  onDedupe,
  onInlineSave,
  onReorder,
  onTreeDrop,
}: Props) {
  const router = useRouter();
  const [colPending, startColTransition] = useTransition();
  const [visible, setVisible] = useState<ColumnId[]>(DEFAULT_VISIBLE);
  const [colOrder, setColOrder] = useState<ColumnId[]>(DEFAULT_VISIBLE);
  const [colWidths, setColWidths] = useState<Record<string, number>>(DEFAULT_POOL_COL_WIDTHS);
  const [colsOpen, setColsOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("sort_order");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterPriority, setFilterPriority] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragCol, setDragCol] = useState<ColumnId | null>(null);
  const [dropHint, setDropHint] = useState<{
    id: string;
    place: "before" | "after" | "child";
  } | null>(null);
  const [dropMsg, setDropMsg] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [collapseReady, setCollapseReady] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [newColLabel, setNewColLabel] = useState("");
  const [newColType, setNewColType] = useState<PoolColumnType>("text");
  const [newColOptions, setNewColOptions] = useState("");
  const resizeRef = useRef<{ key: string; startX: number; startW: number } | null>(null);

  const activeCustoms = useMemo(
    () =>
      columnDefs
        .filter((d) => d.is_active)
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order),
    [columnDefs]
  );
  const customKeySet = useMemo(
    () => new Set(activeCustoms.map((d) => d.key)),
    [activeCustoms]
  );

  useEffect(() => {
    try {
      const badgeRaw = localStorage.getItem(storageTypeBadgeKey(projectId));
      const wantTypeCol = !(badgeRaw === "0" || badgeRaw === "false");

      const raw = localStorage.getItem(storageKey(projectId));
      if (raw) {
        const parsed = JSON.parse(raw) as ColumnId[];
        if (Array.isArray(parsed) && parsed.length) {
          const filtered = parsed.filter((k) => isValidColumnId(k, customKeySet));
          const withType = ensureReqTypeColumn(filtered, wantTypeCol);
          setVisible(withType);
          try {
            localStorage.setItem(storageKey(projectId), JSON.stringify(withType));
          } catch {
            /* ignore */
          }
        }
      } else if (!wantTypeCol) {
        setVisible(DEFAULT_VISIBLE.filter((k) => k !== "req_type"));
      }
      const orderRaw = localStorage.getItem(storageOrderKey(projectId));
      if (orderRaw) {
        const parsed = JSON.parse(orderRaw) as ColumnId[];
        if (Array.isArray(parsed) && parsed.length) {
          const valid = parsed.filter((k) => isValidColumnId(k, customKeySet));
          const missing = DEFAULT_VISIBLE.filter((k) => !valid.includes(k));
          let next = pinLeadingColumns([...valid, ...missing]);
          next = ensureReqTypeColumn(next, wantTypeCol);
          setColOrder(next);
          try {
            localStorage.setItem(storageOrderKey(projectId), JSON.stringify(next));
          } catch {
            /* ignore */
          }
        }
      }
      // 仅保证名称列始终可见
      setVisible((prev) => (prev.includes("title") ? prev : ["title", ...prev]));

      const widthsRaw = localStorage.getItem(storageWidthsKey(projectId));
      if (widthsRaw) {
        const parsed = JSON.parse(widthsRaw) as Record<string, unknown>;
        if (parsed && typeof parsed === "object") {
          const next = { ...DEFAULT_POOL_COL_WIDTHS };
          for (const [k, v] of Object.entries(parsed)) {
            if (typeof v === "number" && v >= 48 && v <= 800) next[k] = v;
          }
          setColWidths(next);
        }
      }
    } catch {
      /* ignore */
    }

    const onHydrated = () => {
      try {
        const widthsRaw = localStorage.getItem(storageWidthsKey(projectId));
        if (!widthsRaw) return;
        const parsed = JSON.parse(widthsRaw) as Record<string, unknown>;
        const next = { ...DEFAULT_POOL_COL_WIDTHS };
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === "number" && v >= 48 && v <= 800) next[k] = v;
        }
        setColWidths(next);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("star-pm:prefs-hydrated", onHydrated);
    return () => window.removeEventListener("star-pm:prefs-hydrated", onHydrated);
  }, [projectId, customKeySet]);

  // 新建自定义列后自动加入可见列与顺序
  useEffect(() => {
    const customIds = activeCustoms.map((d) => customColumnStorageKey(d.key));
    if (!customIds.length) return;

    setVisible((prev) => {
      const missing = customIds.filter((id) => !prev.includes(id));
      if (!missing.length) return prev;
      const next = [...prev, ...missing];
      try {
        localStorage.setItem(storageKey(projectId), JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    setColOrder((prev) => {
      const missing = customIds.filter((id) => !prev.includes(id));
      if (!missing.length) return prev;
      const next = pinLeadingColumns([...prev, ...missing]);
      try {
        localStorage.setItem(storageOrderKey(projectId), JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [activeCustoms, projectId]);

  // 默认展开到深度 2：depth>=2 且有子节点的默认折叠
  useEffect(() => {
    if (collapseReady) return;
    const tree = flattenRequirementTree(requirements);
    const next = new Set<string>();
    for (const { req, depth } of tree) {
      if (depth >= 2 && childrenOf(req.id, requirements).length > 0) {
        next.add(req.id);
      }
    }
    setCollapsed(next);
    setCollapseReady(true);
  }, [requirements, collapseReady]);

  function persistVisible(next: ColumnId[]) {
    const ensured: ColumnId[] = next.includes("title") ? next : ["title", ...next];
    setVisible(ensured);
    try {
      localStorage.setItem(storageKey(projectId), JSON.stringify(ensured));
    } catch {
      /* ignore */
    }
  }

  function persistOrder(next: ColumnId[]) {
    const pinned = pinLeadingColumns(next);
    setColOrder(pinned);
    try {
      localStorage.setItem(storageOrderKey(projectId), JSON.stringify(pinned));
    } catch {
      /* ignore */
    }
  }

  function expandAllRows() {
    setCollapsed(new Set());
  }

  function collapseAllRows() {
    const next = new Set<string>();
    for (const { req } of flattenRequirementTree(requirements)) {
      if (childrenOf(req.id, requirements).length > 0) next.add(req.id);
    }
    setCollapsed(next);
  }

  const allStatusTags = useMemo(() => {
    const set = new Set<string>();
    for (const r of requirements) {
      for (const t of r.status_tags ?? []) set.add(t);
    }
    return [...set].sort();
  }, [requirements]);

  const hasTree = useMemo(
    () => requirements.some((r) => r.parent_id),
    [requirements]
  );

  const columns = useMemo((): DisplayColumn[] => {
    const result: DisplayColumn[] = [];
    for (const id of colOrder) {
      if (!visible.includes(id)) continue;
      const ck = parseCustomColumnKey(id);
      if (ck) {
        const def = activeCustoms.find((d) => d.key === ck);
        if (!def) continue;
        result.push({ id, kind: "custom", label: def.label, def });
        continue;
      }
      const meta = ALL_COLUMNS.find((c) => c.key === id);
      if (!meta) continue;
      result.push({
        id,
        kind: "builtin",
        key: meta.key,
        label: meta.label,
        sortable: meta.sortable,
      });
    }
    return result;
  }, [colOrder, visible, activeCustoms]);

  const filtered = useMemo(() => {
    return requirements.filter((r) => {
      if (filterStatuses.length) {
        const tags = r.status_tags ?? [];
        if (!filterStatuses.some((t) => tags.includes(t))) return false;
      }
      if (filterPriority && r.priority !== filterPriority) return false;
      if (filterAssignee.trim()) {
        const q = filterAssignee.trim().toLowerCase();
        const hay = (r.assignees ?? []).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [requirements, filterStatuses, filterPriority, filterAssignee]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "title":
          cmp = a.title.localeCompare(b.title, "zh");
          break;
        case "req_type": {
          const ta = REQUIREMENT_TYPE_LABELS[(a.type ?? "task") as RequirementType] ?? a.type;
          const tb = REQUIREMENT_TYPE_LABELS[(b.type ?? "task") as RequirementType] ?? b.type;
          cmp = ta.localeCompare(tb, "zh");
          break;
        }
        case "priority":
          cmp = priorityRank(a.priority) - priorityRank(b.priority);
          break;
        case "hours": {
          const ha = displayEstimateHours(a, requirements) ?? -1;
          const hb = displayEstimateHours(b, requirements) ?? -1;
          cmp = ha - hb;
          break;
        }
        case "submitted_at":
          cmp = (a.submitted_at ?? "").localeCompare(b.submitted_at ?? "");
          break;
        case "due_date":
          cmp = (a.due_date ?? "").localeCompare(b.due_date ?? "");
          break;
        case "completed_at":
          cmp = (a.completed_at ?? "").localeCompare(b.completed_at ?? "");
          break;
        case "status_tags":
          cmp = (a.status_tags?.[0] ?? "").localeCompare(b.status_tags?.[0] ?? "", "zh");
          break;
        default:
          cmp = a.sort_order - b.sort_order;
      }
      return cmp * dir;
    });
    return list;
  }, [filtered, sortKey, sortDir, requirements]);

  /** 树序展示；筛选命中时带上祖先 */
  const displayRows = useMemo(() => {
    if (sortKey !== "sort_order") {
      return sorted.map((req) => ({
        req,
        depth: 0,
        hasChildren: childrenOf(req.id, requirements).length > 0,
      }));
    }
    const matched = new Set(filtered.map((r) => r.id));
    const keep = new Set<string>();
    for (const id of matched) {
      let cur = requirements.find((r) => r.id === id);
      while (cur) {
        keep.add(cur.id);
        cur = cur.parent_id
          ? requirements.find((r) => r.id === cur!.parent_id)
          : undefined;
      }
    }
    const tree = flattenRequirementTree(
      filtered.length === requirements.length
        ? requirements
        : requirements.filter((r) => keep.has(r.id))
    );
    const rows: Array<{ req: Requirement; depth: number; hasChildren: boolean }> = [];
    const hidden = new Set<string>();
    for (const { req, depth } of tree) {
      if (req.parent_id && (collapsed.has(req.parent_id) || hidden.has(req.parent_id))) {
        hidden.add(req.id);
        continue;
      }
      const hasChildren = childrenOf(req.id, requirements).length > 0;
      rows.push({ req, depth, hasChildren });
    }
    return rows;
  }, [sortKey, sorted, filtered, requirements, collapsed]);

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function toggleColumn(key: ColumnId) {
    if (key === "title") return;
    const next = visible.includes(key)
      ? visible.filter((k) => k !== key)
      : [...visible, key];
    if (!next.includes("title")) next.unshift("title");
    persistVisible(next);
  }

  function onDragStart(id: string) {
    setDragId(id);
    setDropMsg(null);
  }

  function dropPlaceFromEvent(
    e: React.DragEvent,
    el: HTMLElement
  ): "before" | "after" | "child" {
    const rect = el.getBoundingClientRect();
    const y = (e.clientY - rect.top) / rect.height;
    if (y < 0.28) return "before";
    if (y > 0.72) return "after";
    return "child";
  }

  function onDragOver(e: React.DragEvent, overId: string) {
    e.preventDefault();
    if (!dragId || dragId === overId) return;
    const place = dropPlaceFromEvent(e, e.currentTarget as HTMLElement);
    setDropHint({ id: overId, place });
  }

  function onDrop(overId: string, place: "before" | "after" | "child") {
    const movingId = dragId;
    if (!movingId || movingId === overId) {
      setDragId(null);
      setDropHint(null);
      return;
    }
    const over = requirements.find((r) => r.id === overId);
    if (!over) {
      setDragId(null);
      setDropHint(null);
      return;
    }

    if (place === "child" && isAncestorOf(requirements, movingId, overId)) {
      setDropMsg("不能挂到自己的子节点下");
      setDragId(null);
      setDropHint(null);
      return;
    }

    const nextParentId = place === "child" ? overId : over.parent_id ?? null;
    const ids = displayRows.map((r) => r.req.id);
    const from = ids.indexOf(movingId);
    if (from < 0 || ids.indexOf(overId) < 0) {
      setDragId(null);
      setDropHint(null);
      return;
    }
    ids.splice(from, 1);
    let insertAt = ids.indexOf(overId);
    if (place === "after" || place === "child") insertAt += 1;
    ids.splice(insertAt, 0, movingId);

    setDragId(null);
    setDropHint(null);
    if (onTreeDrop) {
      onTreeDrop({
        dragId: movingId,
        overId,
        place,
        orderedIds: ids,
        nextParentId,
      });
      return;
    }
    const prevParent =
      requirements.find((r) => r.id === movingId)?.parent_id ?? null;
    if (nextParentId !== prevParent) {
      onInlineSave(movingId, { parent_id: nextParentId });
    }
    onReorder(ids);
  }

  function colW(key: string) {
    return colWidths[key] ?? DEFAULT_POOL_COL_WIDTHS[key] ?? 120;
  }

  function onResizeStart(key: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startW = colW(key);
    resizeRef.current = { key, startX: e.clientX, startW };
    let lastW = startW;
    const onMove = (ev: MouseEvent) => {
      const cur = resizeRef.current;
      if (!cur) return;
      lastW = Math.min(800, Math.max(48, cur.startW + (ev.clientX - cur.startX)));
      setColWidths((prev) => ({ ...prev, [cur.key]: lastW }));
    };
    const onUp = () => {
      const cur = resizeRef.current;
      resizeRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (!cur) return;
      setColWidths((prev) => {
        const next = { ...prev, [cur.key]: lastW };
        void import("@/lib/ui/synced-pref")
          .then(({ writePoolColWidthsSynced }) => {
            writePoolColWidthsSynced(projectId, next);
          })
          .catch(() => {
            try {
              localStorage.setItem(storageWidthsKey(projectId), JSON.stringify(next));
            } catch {
              /* ignore */
            }
          });
        return next;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function onColDrop(overKey: ColumnId) {
    if (!dragCol || dragCol === overKey) {
      setDragCol(null);
      return;
    }
    const next = [...colOrder];
    const from = next.indexOf(dragCol);
    const to = next.indexOf(overKey);
    if (from < 0 || to < 0) {
      setDragCol(null);
      return;
    }
    next.splice(from, 1);
    next.splice(to, 0, dragCol);
    setDragCol(null);
    persistOrder(next);
  }

  function addCustomColumn(e: React.FormEvent) {
    e.preventDefault();
    const label = newColLabel.trim();
    if (!label) return;
    startColTransition(async () => {
      try {
        await createPoolColumnAction({
          projectId,
          projectSlug,
          label,
          columnType: newColType,
          options: newColOptions
            .split(/[,，、]/)
            .map((s) => s.trim())
            .filter(Boolean),
        });
        setNewColLabel("");
        setNewColOptions("");
        setNewColType("text");
        router.refresh();
      } catch {
        /* parent toast not available; silent */
      }
    });
  }

  function removeCustomColumn(defId: string) {
    if (!confirm("删除该自定义列？已有数据会保留在后台但不再显示。")) return;
    startColTransition(async () => {
      await deletePoolColumnAction(defId, projectSlug);
      router.refresh();
    });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const ids = displayRows.map((r) => r.req.id);
    const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
    setSelected(allOn ? new Set() : new Set(ids));
  }

  const activeFilterCount =
    filterStatuses.length + (filterPriority ? 1 : 0) + (filterAssignee.trim() ? 1 : 0);

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className={cn(
            "rounded-lg border px-2.5 py-1 text-xs font-medium",
            filtersOpen || activeFilterCount
              ? "border-indigo-200 bg-indigo-50 text-indigo-700"
              : "border-slate-200 text-slate-600 hover:bg-slate-50"
          )}
        >
          筛选{activeFilterCount ? ` (${activeFilterCount})` : ""}
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setColsOpen((v) => !v)}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            列
          </button>
          {colsOpen ? (
            <div className="absolute left-0 z-30 mt-1 max-h-[70vh] w-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
              <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                内置列
              </p>
              {ALL_COLUMNS.map((col) => (
                <label
                  key={col.key}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={visible.includes(col.key)}
                    disabled={col.key === "title"}
                    onChange={() => toggleColumn(col.key)}
                  />
                  {col.label}
                </label>
              ))}
              <div className="my-1 border-t border-slate-100" />
              <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                自定义列
              </p>
              {activeCustoms.length === 0 ? (
                <p className="px-2 py-1 text-[11px] text-slate-400">暂无，在下方添加</p>
              ) : (
                activeCustoms.map((def) => {
                  const id = customColumnStorageKey(def.key);
                  return (
                    <div
                      key={def.id}
                      className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={visible.includes(id)}
                          onChange={() => toggleColumn(id)}
                        />
                        <span className="truncate">{def.label}</span>
                      </label>
                      <button
                        type="button"
                        disabled={colPending}
                        className="shrink-0 text-[10px] text-red-500 hover:underline disabled:opacity-50"
                        onClick={() => removeCustomColumn(def.id)}
                      >
                        删
                      </button>
                    </div>
                  );
                })
              )}
              <form
                onSubmit={addCustomColumn}
                className="mt-1 space-y-1.5 border-t border-slate-100 px-2 pt-2"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-[10px] font-medium text-slate-500">添加列</p>
                <input
                  value={newColLabel}
                  onChange={(e) => setNewColLabel(e.target.value)}
                  placeholder="列名"
                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                />
                <select
                  value={newColType}
                  onChange={(e) => setNewColType(e.target.value as PoolColumnType)}
                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                >
                  {COLUMN_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {newColType === "select" ? (
                  <input
                    value={newColOptions}
                    onChange={(e) => setNewColOptions(e.target.value)}
                    placeholder="选项，逗号分隔"
                    className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                  />
                ) : null}
                <button
                  type="submit"
                  disabled={colPending || !newColLabel.trim()}
                  className="w-full rounded-lg bg-indigo-600 px-2 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  {colPending ? "添加中…" : "添加列"}
                </button>
              </form>
              <div className="my-1 border-t border-slate-100" />
              <p className="mt-1 px-2 text-[10px] text-slate-400">
                表头右边可拖改列宽；行拖中间挂子节点，上下半区改顺序
              </p>
            </div>
          ) : null}
        </div>
        {dropMsg ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-900">
            {dropMsg}
          </p>
        ) : null}
        {selected.size > 0 ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm(`删除选中的 ${selected.size} 条需求？`)) return;
              onBulkDelete([...selected]);
              setSelected(new Set());
            }}
            className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 disabled:opacity-50"
          >
            删除选中 ({selected.size})
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm("清理同灵感/同标题重复需求（保留最早一条）？")) return;
            onDedupe();
          }}
          className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 disabled:opacity-50"
        >
          清理重复
        </button>
        {hasTree ? (
          <>
            <button
              type="button"
              onClick={expandAllRows}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              全部展开
            </button>
            <button
              type="button"
              onClick={collapseAllRows}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              全部收起
            </button>
          </>
        ) : null}
        {sortKey !== "sort_order" ? (
          <button
            type="button"
            className="text-xs text-slate-500 underline-offset-2 hover:underline"
            onClick={() => {
              setSortKey("sort_order");
              setSortDir("asc");
            }}
          >
            恢复树形顺序
          </button>
        ) : null}
        {!hasTree ? (
          <span className="text-[11px] text-slate-400">
            层级提示：点行内「+子」拆解后会出现缩进树
          </span>
        ) : null}
      </div>

      {filtersOpen ? (
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-3 text-xs">
          <div className="min-w-[160px] flex-1">
            <p className="mb-1 font-medium text-slate-600">状态标签</p>
            <div className="flex flex-wrap gap-1">
              {allStatusTags.length === 0 ? (
                <span className="text-slate-400">暂无</span>
              ) : (
                allStatusTags.map((tag) => {
                  const on = filterStatuses.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        setFilterStatuses((prev) =>
                          on ? prev.filter((t) => t !== tag) : [...prev, tag]
                        )
                      }
                      className={cn(
                        "rounded-full px-2 py-0.5 ring-1",
                        on
                          ? "bg-indigo-600 text-white ring-indigo-600"
                          : "bg-white text-slate-600 ring-slate-200"
                      )}
                    >
                      {tag}
                    </button>
                  );
                })
              )}
            </div>
          </div>
          <label className="block">
            <span className="mb-1 block font-medium text-slate-600">优先级</span>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"
            >
              <option value="">全部</option>
              {["P0", "P1", "P2", "P3"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-[140px]">
            <span className="mb-1 block font-medium text-slate-600">指派人</span>
            <input
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              placeholder="关键词"
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5"
            />
          </label>
          {activeFilterCount ? (
            <button
              type="button"
              className="text-slate-500 underline-offset-2 hover:underline"
              onClick={() => {
                setFilterStatuses([]);
                setFilterPriority("");
                setFilterAssignee("");
              }}
            >
              清空筛选
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="max-h-[70vh] overflow-auto">
        <table className="min-w-[1080px] w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th
                className="sticky left-0 z-30 w-[72px] bg-slate-50 px-1 py-2.5 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)]"
                aria-label="选择与拖拽"
              >
                <div className="flex items-center justify-center gap-1">
                  <input
                    type="checkbox"
                    checked={
                      displayRows.length > 0 &&
                      displayRows.every((r) => selected.has(r.req.id))
                    }
                    onChange={toggleSelectAll}
                    title="全选当前可见行"
                  />
                  <span className="text-[10px] text-slate-400">⋮⋮</span>
                </div>
              </th>
              {columns.map((col) => {
                const isTitle = col.kind === "builtin" && col.key === "title";
                const builtinKey = col.kind === "builtin" ? col.key : null;
                const sortable =
                  col.kind === "builtin" &&
                  (col.key === "title" ||
                    col.key === "req_type" ||
                    col.key === "priority" ||
                    col.key === "hours" ||
                    col.key === "submitted_at" ||
                    col.key === "due_date" ||
                    col.key === "completed_at" ||
                    col.key === "status_tags");
                const sortMap: Partial<Record<PoolColumnKey, SortKey>> = {
                  title: "title",
                  req_type: "req_type",
                  priority: "priority",
                  hours: "hours",
                  submitted_at: "submitted_at",
                  due_date: "due_date",
                  completed_at: "completed_at",
                  status_tags: "status_tags",
                };
                const sk = builtinKey ? sortMap[builtinKey] : undefined;
                const isActive = sk && sortKey === sk;
                return (
                  <th
                    key={col.id}
                    draggable={!isTitle}
                    onDragStart={() => {
                      if (isTitle) return;
                      setDragCol(col.id);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                    }}
                    onDrop={() => onColDrop(col.id)}
                    onDragEnd={() => setDragCol(null)}
                    className={cn(
                      "relative px-3 py-2.5 font-medium",
                      isTitle &&
                        "sticky z-20 bg-slate-50 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)]",
                      sortable && "cursor-pointer select-none hover:text-slate-800",
                      dragCol === col.id && "opacity-50"
                    )}
                    style={
                      isTitle
                        ? {
                            left: TITLE_LEFT,
                            width: colW("title"),
                            minWidth: colW("title"),
                            maxWidth: colW("title"),
                          }
                        : {
                            width: colW(col.id),
                            minWidth: colW(col.id),
                          }
                    }
                    onClick={() => {
                      if (sortable && sk) toggleSort(sk);
                    }}
                    title={
                      isTitle
                        ? "固定左侧；拖右边改宽；点击排序"
                        : builtinKey === "req_source"
                          ? "谁提出 / 归属哪类干系人（客户、用户、产品经理…）"
                          : builtinKey === "inspiration_source"
                            ? "念头从哪件事触发（会话、视频、整理现场…），不是干系人类型"
                            : "拖拽调整列顺序；拖右边改宽；点击排序"
                    }
                  >
                    <span className="mr-1 text-[10px] text-slate-300">⠿</span>
                    {col.label}
                    {isActive ? (sortDir === "asc" ? " ↑" : " ↓") : sortable ? " ↕" : ""}
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      onMouseDown={(e) => onResizeStart(isTitle ? "title" : col.id, e)}
                      className="absolute right-0 top-0 z-30 h-full w-1.5 cursor-col-resize hover:bg-indigo-400/50"
                    />
                  </th>
                );
              })}
              <th className="min-w-[56px] px-2 py-2.5 font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 2}
                  className="px-4 py-16 text-center text-slate-400"
                >
                  {requirements.length === 0
                    ? "暂无需求。点「提需求」，或从灵感流关联本项目后会自动落入。"
                    : "无匹配筛选结果"}
                </td>
              </tr>
            ) : (
              displayRows.map(({ req, depth, hasChildren }) => {
                const thumbs = attachments
                  .filter((a) => a.requirement_id === req.id)
                  .slice(0, 3);
                const active = req.id === drawerReqId;
                const leaf = isLeafRequirement(req, requirements);
                const hours = displayEstimateHours(req, requirements);
                const hint = dropHint?.id === req.id ? dropHint.place : null;
                return (
                  <tr
                    key={req.id}
                    draggable
                    onDragStart={() => onDragStart(req.id)}
                    onDragOver={(e) => onDragOver(e, req.id)}
                    onDrop={(e) => {
                      e.preventDefault();
                      const place =
                        dropHint?.id === req.id
                          ? dropHint.place
                          : dropPlaceFromEvent(e, e.currentTarget);
                      onDrop(req.id, place);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setDropHint(null);
                    }}
                    className={cn(
                      "group transition",
                      active ? "bg-indigo-50" : "hover:bg-slate-50",
                      dragId === req.id && "opacity-50",
                      hint === "child" && "bg-indigo-50/80 ring-1 ring-inset ring-indigo-200",
                      hint === "before" && "border-t-2 border-indigo-400",
                      hint === "after" && "border-b-2 border-indigo-400"
                    )}
                  >
                    <td
                      className={cn(
                        "sticky left-0 z-[2] px-1 py-2.5 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)]",
                        active ? "bg-indigo-50" : "bg-white"
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          type="button"
                          title="添加子需求"
                          className="flex h-6 w-6 items-center justify-center rounded text-slate-400 opacity-0 hover:bg-slate-100 hover:text-indigo-600 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddChild(req.id);
                          }}
                        >
                          +
                        </button>
                        <input
                          type="checkbox"
                          checked={selected.has(req.id)}
                          onChange={() => toggleSelect(req.id)}
                        />
                        <span
                          className="cursor-grab select-none px-0.5 text-slate-400 active:cursor-grabbing"
                          title="拖拽：上下半区改顺序，中间挂为子节点"
                        >
                          ⋮⋮
                        </span>
                      </div>
                    </td>
                    {columns.map((col) => {
                      if (col.kind === "custom") {
                        const def = col.def;
                        const raw = req.custom_fields?.[def.key] ?? null;
                        return (
                          <td
                            key={col.id}
                            className="max-w-[200px] px-3 py-2.5 align-top"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {def.column_type === "checkbox" ? (
                              <input
                                type="checkbox"
                                disabled={pending}
                                checked={Boolean(raw)}
                                onChange={(e) =>
                                  onInlineSave(req.id, {
                                    custom_fields: { [def.key]: e.target.checked },
                                  })
                                }
                              />
                            ) : def.column_type === "select" ? (
                              <select
                                disabled={pending}
                                value={String(raw ?? "")}
                                className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-slate-200"
                                onChange={(e) =>
                                  onInlineSave(req.id, {
                                    custom_fields: { [def.key]: e.target.value || null },
                                  })
                                }
                              >
                                <option value="">空白</option>
                                {def.options.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <InlineCell
                                type={
                                  def.column_type === "number"
                                    ? "number"
                                    : def.column_type === "date"
                                      ? "date"
                                      : "text"
                                }
                                wrap={def.column_type === "text" || def.column_type === "url"}
                                value={raw != null ? String(raw) : ""}
                                placeholder="空白"
                                onCommit={(next) => {
                                  const t = next.trim();
                                  if (def.column_type === "number") {
                                    onInlineSave(req.id, {
                                      custom_fields: { [def.key]: t ? Number(t) : null },
                                    });
                                    return;
                                  }
                                  onInlineSave(req.id, {
                                    custom_fields: { [def.key]: t || null },
                                  });
                                }}
                              />
                            )}
                          </td>
                        );
                      }

                      const key = col.key;
                      const stickyTitle =
                        key === "title"
                          ? cn(
                              "sticky z-[1] shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)]",
                              active ? "bg-indigo-50" : "bg-white"
                            )
                          : "";
                      if (key === "title") {
                        return (
                          <td
                            key={col.id}
                            className={cn(
                              "px-3 py-2.5 align-top font-medium text-slate-900",
                              stickyTitle
                            )}
                            style={{
                              left: TITLE_LEFT,
                              width: colW("title"),
                              minWidth: colW("title"),
                              maxWidth: colW("title"),
                            }}
                          >
                            <div
                              className="flex min-w-0 items-center gap-1"
                              style={{ paddingLeft: Math.max(depth, 0) * 18 }}
                            >
                              {hasChildren ? (
                                <button
                                  type="button"
                                  className="w-5 shrink-0 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleCollapse(req.id);
                                  }}
                                  title={collapsed.has(req.id) ? "展开子需求" : "收起子需求"}
                                >
                                  {collapsed.has(req.id) ? "▶" : "▼"}
                                </button>
                              ) : (
                                <span className="inline-block w-5 shrink-0 text-center text-slate-200">
                                  {depth > 0 ? "·" : ""}
                                </span>
                              )}
                              <div className="min-w-0 flex-1">
                                <InlineCell
                                  wrap
                                  value={req.title}
                                  onCommit={(next) => {
                                    const t = next.trim();
                                    if (t) onInlineSave(req.id, { title: t });
                                  }}
                                />
                              </div>
                              <button
                                type="button"
                                title="打开详情"
                                className="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenReq(req.id);
                                }}
                              >
                                打开
                              </button>
                              <button
                                type="button"
                                title="添加子需求（会出现缩进层级）"
                                className="shrink-0 rounded px-1 text-xs text-slate-500 hover:bg-slate-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAddChild(req.id);
                                }}
                              >
                                +子
                              </button>
                            </div>
                          </td>
                        );
                      }
                      if (key === "req_type") {
                        const typeKey = (req.type ?? "task") as RequirementType;
                        return (
                          <td key={col.id} className="px-3 py-2.5 align-top">
                            <select
                              value={typeKey}
                              disabled={pending}
                              className="max-w-[110px] rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700"
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                const next = e.target.value as RequirementType;
                                if (next === typeKey) return;
                                onInlineSave(req.id, { type: next });
                              }}
                            >
                              {(Object.keys(REQUIREMENT_TYPE_LABELS) as RequirementType[]).map(
                                (k) => (
                                  <option key={k} value={k}>
                                    {REQUIREMENT_TYPE_LABELS[k]}
                                  </option>
                                )
                              )}
                            </select>
                          </td>
                        );
                      }
                      if (key === "status_tags") {
                        return (
                          <td key={col.id} className="px-3 py-2.5 align-top">
                            <div className="flex flex-wrap gap-1">
                              {(req.status_tags ?? []).length ? (
                                (req.status_tags ?? []).map((tag) => (
                                  <StudioBadge
                                    key={tag}
                                    tone={
                                      tag === REQUIREMENT_DONE_TAG || tag === "已完成"
                                        ? "default"
                                        : tag === "评审"
                                          ? "warning"
                                          : "muted"
                                    }
                                  >
                                    {tag}
                                  </StudioBadge>
                                ))
                              ) : (
                                <span className="text-slate-300">空白</span>
                              )}
                            </div>
                          </td>
                        );
                      }
                      if (key === "next_step") {
                        return (
                          <td
                            key={col.id}
                            className="max-w-[320px] px-3 py-2.5 align-top text-slate-600"
                          >
                            <InlineCell
                              wrap
                              value={req.next_step?.trim() || ""}
                              placeholder="空白"
                              onCommit={(next) =>
                                onInlineSave(req.id, { next_step: next.trim() || null })
                              }
                            />
                          </td>
                        );
                      }
                      if (key === "summary") {
                        return (
                          <td
                            key={col.id}
                            className="max-w-[360px] px-3 py-2.5 align-top text-slate-500"
                          >
                            <span className="whitespace-normal break-words">
                              {summaryOf(req) || (
                                <span className="text-slate-300">空白</span>
                              )}
                            </span>
                          </td>
                        );
                      }
                      if (
                        key === "detail_work" ||
                        key === "acceptance_criteria" ||
                        key === "optimization_notes" ||
                        key === "known_issues" ||
                        key === "difficulty_notes" ||
                        key === "scenario" ||
                        key === "req_source_note"
                      ) {
                        const fieldMap = {
                          detail_work: req.detail_work,
                          acceptance_criteria: req.acceptance_criteria,
                          optimization_notes: req.optimization_notes,
                          known_issues: req.known_issues,
                          difficulty_notes: req.difficulty_notes,
                          scenario: req.scenario,
                          req_source_note: req.req_source_note,
                        } as const;
                        const fieldKey = key;
                        return (
                          <td
                            key={col.id}
                            className="max-w-[320px] px-3 py-2.5 align-top text-slate-600"
                          >
                            <InlineCell
                              wrap
                              value={fieldMap[fieldKey]?.trim() || ""}
                              placeholder="空白"
                              onCommit={(next) =>
                                onInlineSave(req.id, { [fieldKey]: next.trim() || null })
                              }
                            />
                          </td>
                        );
                      }
                      if (key === "prd_link" || key === "prototype_link") {
                        const linkVal =
                          key === "prd_link" ? req.prd_link : req.prototype_link;
                        return (
                          <td
                            key={col.id}
                            className="max-w-[200px] px-3 py-2.5 align-top text-slate-600"
                          >
                            <InlineCell
                              wrap
                              value={linkVal?.trim() || ""}
                              placeholder="空白"
                              onCommit={(next) =>
                                onInlineSave(req.id, { [key]: next.trim() || null })
                              }
                            />
                          </td>
                        );
                      }
                      if (key === "assignees") {
                        return (
                          <td key={col.id} className="px-3 py-2.5 text-slate-600">
                            {req.assignees?.length ? (
                              req.assignees.join("、")
                            ) : (
                              <span className="text-slate-300">空白</span>
                            )}
                          </td>
                        );
                      }
                      if (key === "priority") {
                        return (
                          <td
                            key={col.id}
                            className="px-3 py-2.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <select
                              disabled={pending}
                              value={req.priority ?? ""}
                              className="rounded border border-transparent bg-transparent px-1 py-0.5 text-sm hover:border-slate-200"
                              onChange={(e) =>
                                onInlineSave(req.id, {
                                  priority: e.target.value || null,
                                })
                              }
                            >
                              <option value="">空白</option>
                              {["P0", "P1", "P2", "P3"].map((p) => (
                                <option key={p} value={p}>
                                  {p}
                                </option>
                              ))}
                            </select>
                          </td>
                        );
                      }
                      if (key === "req_source") {
                        return (
                          <td key={col.id} className="px-3 py-2.5 align-top text-slate-600">
                            {req.req_source || <span className="text-slate-300">空白</span>}
                          </td>
                        );
                      }
                      if (key === "inspiration_source") {
                        const parsed = parseAgentSourceLabel(req.inspiration_source);
                        return (
                          <td
                            key={col.id}
                            className="max-w-[200px] px-3 py-2.5 align-top text-slate-600"
                          >
                            {parsed.label ? (
                              <span className="whitespace-normal break-words">
                                <span className="font-medium text-slate-700">{parsed.label}</span>
                                {parsed.note ? (
                                  <span className="mt-0.5 block text-[11px] text-slate-400">
                                    {parsed.note}
                                  </span>
                                ) : null}
                              </span>
                            ) : parsed.note ? (
                              <span className="whitespace-normal break-words">{parsed.note}</span>
                            ) : (
                              <span className="text-slate-300">空白</span>
                            )}
                          </td>
                        );
                      }
                      if (key === "hours") {
                        return (
                          <td key={col.id} className="px-3 py-2.5 tabular-nums text-slate-600">
                            {leaf ? (
                              <InlineCell
                                type="number"
                                value={
                                  req.product_estimate_hours != null
                                    ? String(req.product_estimate_hours)
                                    : ""
                                }
                                placeholder="—"
                                onCommit={(next) => {
                                  const t = next.trim();
                                  if (!t) {
                                    onInlineSave(req.id, { product_estimate_hours: null });
                                    return;
                                  }
                                  const n = Number(t);
                                  if (Number.isFinite(n)) {
                                    onInlineSave(req.id, { product_estimate_hours: n });
                                  }
                                }}
                              />
                            ) : (
                              <div
                                className="space-y-0.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div title="Σ叶子 + direct">
                                  {hours != null ? hours : "—"}
                                  <span className="ml-1 text-[10px] text-slate-400">汇总</span>
                                </div>
                                <InlineCell
                                  type="number"
                                  value={
                                    req.direct_hours != null ? String(req.direct_hours) : ""
                                  }
                                  placeholder="直接工时"
                                  className="text-xs text-slate-500"
                                  onCommit={(next) => {
                                    const t = next.trim();
                                    if (!t) {
                                      onInlineSave(req.id, { direct_hours: null });
                                      return;
                                    }
                                    const n = Number(t);
                                    if (Number.isFinite(n)) {
                                      onInlineSave(req.id, { direct_hours: n });
                                    }
                                  }}
                                />
                              </div>
                            )}
                          </td>
                        );
                      }
                      if (key === "submitted_at") {
                        return (
                          <td
                            key={col.id}
                            className="px-3 py-2.5 tabular-nums text-xs text-slate-500"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <InlineCell
                              type="date"
                              value={req.submitted_at ?? ""}
                              placeholder="—"
                              onCommit={(next) =>
                                onInlineSave(req.id, {
                                  submitted_at: next.trim() || null,
                                })
                              }
                            />
                          </td>
                        );
                      }
                      if (key === "due_date") {
                        return (
                          <td
                            key={col.id}
                            className="px-3 py-2.5 tabular-nums text-xs text-slate-500"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <InlineCell
                              type="date"
                              value={req.due_date ?? ""}
                              placeholder="—"
                              onCommit={(next) =>
                                onInlineSave(req.id, { due_date: next.trim() || null })
                              }
                            />
                          </td>
                        );
                      }
                      if (key === "completed_at") {
                        return (
                          <td
                            key={col.id}
                            className="px-3 py-2.5 tabular-nums text-xs text-slate-500"
                          >
                            {req.completed_at
                              ? req.completed_at.replace("T", " ").slice(0, 16)
                              : "—"}
                          </td>
                        );
                      }
                      if (key === "attachments") {
                        return (
                          <td key={col.id} className="px-3 py-2.5">
                            <div className="flex gap-1">
                              {thumbs.map((t) =>
                                isImage(t.mime_type, t.url) ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    key={t.id}
                                    src={t.url}
                                    alt=""
                                    className="h-8 w-8 rounded object-cover ring-1 ring-slate-200"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onOpenLightbox(t.url);
                                    }}
                                  />
                                ) : null
                              )}
                              {!thumbs.length ? (
                                <span className="text-slate-300">—</span>
                              ) : null}
                            </div>
                          </td>
                        );
                      }
                      return null;
                    })}
                    <td className="px-2 py-2.5">
                      <button
                        type="button"
                        className="text-xs font-medium text-indigo-600 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenReq(req.id);
                        }}
                      >
                        打开
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
  );
}
