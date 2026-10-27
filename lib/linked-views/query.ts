import type {
  LinkedViewFilter,
  LinkedViewOp,
  LinkedViewSort,
} from "./config";

export type LinkedViewPeekKind =
  | "learning"
  | "bug"
  | "competitor"
  | "requirement"
  | "prd";

export type LinkedViewRow = {
  id: string;
  title: string;
  href: string;
  badge?: string;
  cells: Record<string, string>;
  peekKind?: LinkedViewPeekKind;
  titlePlaceholder?: string;
  titleHint?: string;
  moduleOptions?: string[];
  fields?: Array<{
    key: string;
    label: string;
    value: string;
    multiline?: boolean;
  }>;
};

export type LinkedViewGroup = {
  key: string;
  label: string;
  rows: LinkedViewRow[];
};

function cellValue(row: LinkedViewRow, field: string): string {
  if (field === "title") return row.title ?? "";
  return row.cells[field] ?? "";
}

function matchOp(op: LinkedViewOp, raw: string, needle: string): boolean {
  const value = raw.trim();
  const n = needle.trim();
  switch (op) {
    case "is_empty":
      return !value;
    case "is_not_empty":
      return Boolean(value);
    case "equals":
      return value === n;
    case "not_equals":
      return value !== n;
    case "contains":
      if (!n) return true;
      return value.toLowerCase().includes(n.toLowerCase());
    case "not_contains":
      if (!n) return true;
      return !value.toLowerCase().includes(n.toLowerCase());
    default:
      return true;
  }
}

/** 多条规则为且 */
export function applyLinkedViewFilters(
  rows: LinkedViewRow[],
  filters: LinkedViewFilter[]
): LinkedViewRow[] {
  if (!filters.length) return rows;
  return rows.filter((row) =>
    filters.every((f) => matchOp(f.op, cellValue(row, f.field), f.value))
  );
}

export function applyLinkedViewSort(
  rows: LinkedViewRow[],
  sort?: LinkedViewSort | null
): LinkedViewRow[] {
  if (!sort?.field) return rows;
  const dir = sort.direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = cellValue(a, sort.field);
    const bv = cellValue(b, sort.field);
    const cmp = av.localeCompare(bv, "zh", { numeric: true, sensitivity: "base" });
    return cmp * dir;
  });
}

export function groupLinkedViewRows(
  rows: LinkedViewRow[],
  groupBy?: string | null
): LinkedViewGroup[] {
  const field = groupBy?.trim();
  if (!field) {
    return [{ key: "_all", label: "", rows }];
  }
  const map = new Map<string, LinkedViewRow[]>();
  for (const row of rows) {
    const raw = cellValue(row, field).trim() || "（空）";
    const list = map.get(raw);
    if (list) list.push(row);
    else map.set(raw, [row]);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0], "zh"))
    .map(([label, groupRows]) => ({
      key: label,
      label,
      rows: groupRows,
    }));
}

export function prepareLinkedViewRows(
  rows: LinkedViewRow[],
  input: {
    filters: LinkedViewFilter[];
    sort?: LinkedViewSort | null;
    groupBy?: string | null;
  }
): LinkedViewGroup[] {
  const filtered = applyLinkedViewFilters(rows, input.filters);
  const sorted = applyLinkedViewSort(filtered, input.sort);
  return groupLinkedViewRows(sorted, input.groupBy);
}
