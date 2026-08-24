import { BUG_TYPE_LABELS, type BuiltinBugType } from "@/lib/types";

export type CustomBugTypeEntry = {
  key: string;
  label: string;
  createdAt: string;
};

export type BugTypeCatalog = {
  custom: CustomBugTypeEntry[];
};

export type BugTypeOption = {
  key: string;
  label: string;
  builtin: boolean;
};

const EMPTY_CATALOG: BugTypeCatalog = { custom: [] };

export function isBuiltinBugType(key: string): key is BuiltinBugType {
  return key in BUG_TYPE_LABELS;
}

export function isCustomBugTypeKey(key: string): boolean {
  return key.startsWith("custom:") && key.length > "custom:".length;
}

export function isBugTypeKey(key: string): boolean {
  const k = key.trim();
  if (!k) return false;
  return isBuiltinBugType(k) || isCustomBugTypeKey(k);
}

export function normalizeBugTypeKey(raw: string | null | undefined): string {
  const k = String(raw ?? "").trim();
  if (!k) return "code";
  if (isBugTypeKey(k)) return k;
  return "code";
}

export function parseBugTypeCatalog(value: unknown): BugTypeCatalog {
  if (!value || typeof value !== "object") return { ...EMPTY_CATALOG };
  const custom = (value as BugTypeCatalog).custom;
  if (!Array.isArray(custom)) return { ...EMPTY_CATALOG };
  const seen = new Set<string>();
  const list: CustomBugTypeEntry[] = [];
  for (const row of custom) {
    if (!row || typeof row !== "object") continue;
    const key = String((row as CustomBugTypeEntry).key ?? "").trim();
    const label = String((row as CustomBugTypeEntry).label ?? "").trim();
    if (!key || !label || !isCustomBugTypeKey(key) || seen.has(key)) continue;
    seen.add(key);
    list.push({
      key,
      label: label.slice(0, 40),
      createdAt: String((row as CustomBugTypeEntry).createdAt ?? new Date().toISOString()),
    });
  }
  return { custom: list };
}

export function catalogToLabelMap(catalog: BugTypeCatalog): Record<string, string> {
  const map: Record<string, string> = { ...BUG_TYPE_LABELS };
  for (const row of catalog.custom) {
    map[row.key] = row.label;
  }
  return map;
}

export function listBugTypeOptions(catalog: BugTypeCatalog): BugTypeOption[] {
  const builtin = (Object.keys(BUG_TYPE_LABELS) as BuiltinBugType[]).map((key) => ({
    key,
    label: BUG_TYPE_LABELS[key],
    builtin: true,
  }));
  const custom = catalog.custom.map((row) => ({
    key: row.key,
    label: row.label,
    builtin: false,
  }));
  return [...builtin, ...custom];
}

export function bugTypeLabel(
  key: string,
  catalogOrLabels?: BugTypeCatalog | Record<string, string>
): string {
  const k = normalizeBugTypeKey(key);
  if (catalogOrLabels && "custom" in catalogOrLabels) {
    return catalogToLabelMap(catalogOrLabels as BugTypeCatalog)[k] ?? k;
  }
  if (catalogOrLabels && typeof catalogOrLabels === "object") {
    return (catalogOrLabels as Record<string, string>)[k] ?? BUG_TYPE_LABELS[k as BuiltinBugType] ?? k;
  }
  return BUG_TYPE_LABELS[k as BuiltinBugType] ?? k;
}

function slugPart(label: string): string {
  const base = label
    .trim()
    .slice(0, 24)
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fff-]/g, "");
  return base || "type";
}

export function makeCustomBugTypeKey(label: string, taken: Set<string>): string {
  const base = slugPart(label);
  let key = `custom:${base}`;
  let n = 2;
  while (taken.has(key)) {
    key = `custom:${base}-${n}`;
    n += 1;
  }
  return key;
}

export function labelTaken(label: string, catalog: BugTypeCatalog): boolean {
  const needle = label.trim().toLowerCase();
  if (!needle) return true;
  for (const l of Object.values(BUG_TYPE_LABELS)) {
    if (l.toLowerCase() === needle) return true;
  }
  for (const row of catalog.custom) {
    if (row.label.toLowerCase() === needle) return true;
  }
  return false;
}
