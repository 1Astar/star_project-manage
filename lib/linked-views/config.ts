/** 页内嵌库：Markdown `star-view` 围栏配置 */

export const LINKED_VIEW_FENCE = "star-view";

export const LINKED_VIEW_SOURCE_IDS = [
  "requirement",
  "bug",
  "optimization",
  "learning",
  "prd",
  "competitor",
] as const;

export type LinkedViewSourceId = (typeof LINKED_VIEW_SOURCE_IDS)[number];

export const LINKED_VIEW_OPS = [
  "contains",
  "not_contains",
  "equals",
  "not_equals",
  "is_empty",
  "is_not_empty",
] as const;

export type LinkedViewOp = (typeof LINKED_VIEW_OPS)[number];

export type LinkedViewFilter = {
  id: string;
  field: string;
  op: LinkedViewOp;
  value: string;
};

export type LinkedViewSort = {
  field: string;
  direction: "asc" | "desc";
};

export type LinkedViewConfig = {
  v: 1;
  source: LinkedViewSourceId;
  title: string;
  filters: LinkedViewFilter[];
  /** 按字段排序；空=保持库顺序 */
  sort?: LinkedViewSort | null;
  /** 按字段分组；空=不分组 */
  groupBy?: string | null;
};

export const LINKED_VIEW_OP_LABELS: Record<LinkedViewOp, string> = {
  contains: "包含",
  not_contains: "不包含",
  equals: "等于",
  not_equals: "不等于",
  is_empty: "为空",
  is_not_empty: "不为空",
};

export function isLinkedViewSourceId(value: unknown): value is LinkedViewSourceId {
  return (
    typeof value === "string" &&
    (LINKED_VIEW_SOURCE_IDS as readonly string[]).includes(value)
  );
}

export function isLinkedViewOp(value: unknown): value is LinkedViewOp {
  return typeof value === "string" && (LINKED_VIEW_OPS as readonly string[]).includes(value);
}

export function newFilterId(): string {
  return `f${Math.random().toString(36).slice(2, 8)}`;
}

export function parseLinkedViewConfig(raw: string): LinkedViewConfig | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const rec = parsed as Record<string, unknown>;
    if (!isLinkedViewSourceId(rec.source)) return null;
    const filtersIn = Array.isArray(rec.filters) ? rec.filters : [];
    const filters: LinkedViewFilter[] = [];
    for (const item of filtersIn) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const f = item as Record<string, unknown>;
      const field = typeof f.field === "string" ? f.field.trim() : "";
      if (!field || !isLinkedViewOp(f.op)) continue;
      filters.push({
        id: typeof f.id === "string" && f.id.trim() ? f.id.trim() : newFilterId(),
        field,
        op: f.op,
        value: typeof f.value === "string" ? f.value : String(f.value ?? ""),
      });
    }
    const title = typeof rec.title === "string" ? rec.title.trim() : "";
    let sort: LinkedViewSort | null = null;
    if (rec.sort && typeof rec.sort === "object" && !Array.isArray(rec.sort)) {
      const s = rec.sort as Record<string, unknown>;
      const field = typeof s.field === "string" ? s.field.trim() : "";
      const direction = s.direction === "desc" ? "desc" : "asc";
      if (field) sort = { field, direction };
    }
    const groupBy =
      typeof rec.groupBy === "string" && rec.groupBy.trim()
        ? rec.groupBy.trim()
        : null;
    return {
      v: 1,
      source: rec.source,
      title,
      filters,
      sort,
      groupBy,
    };
  } catch {
    return null;
  }
}

export function serializeLinkedViewFence(config: LinkedViewConfig): string {
  const payload: LinkedViewConfig = {
    v: 1,
    source: config.source,
    title: config.title.trim(),
    filters: config.filters.map((f) => ({
      id: f.id,
      field: f.field,
      op: f.op,
      value: f.value,
    })),
    sort: config.sort?.field
      ? {
          field: config.sort.field,
          direction: config.sort.direction === "desc" ? "desc" : "asc",
        }
      : null,
    groupBy: config.groupBy?.trim() || null,
  };
  return `\`\`\`${LINKED_VIEW_FENCE}\n${JSON.stringify(payload)}\n\`\`\``;
}

export function hasLinkedViewFence(markdown: string): boolean {
  return /```star-view\b/i.test(markdown ?? "");
}
