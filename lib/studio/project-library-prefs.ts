import type { Project } from "@/lib/studio/types";

export const PROJECT_LIBRARY_WIDTHS_KEY = "star-pm:project-library-col-widths";
export const PROJECT_LIBRARY_ORDER_KEY = "star-pm:project-library-order";

export type ProjectLibraryColKey =
  | "actions"
  | "title"
  | "positioning"
  | "next"
  | "code"
  | "priority"
  | "demo"
  | "status"
  | "stage"
  | "git"
  | "updated"
  | `custom:${string}`;

export const DEFAULT_PROJECT_LIBRARY_WIDTHS: Record<string, number> = {
  actions: 56,
  title: 220,
  positioning: 220,
  next: 240,
  code: 160,
  priority: 72,
  demo: 160,
  status: 96,
  stage: 120,
  git: 160,
  updated: 100,
};

export function readProjectLibraryWidths(): Record<string, number> {
  if (typeof window === "undefined") return { ...DEFAULT_PROJECT_LIBRARY_WIDTHS };
  try {
    const raw = window.localStorage.getItem(PROJECT_LIBRARY_WIDTHS_KEY);
    if (!raw) return { ...DEFAULT_PROJECT_LIBRARY_WIDTHS };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out = { ...DEFAULT_PROJECT_LIBRARY_WIDTHS };
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "number" && v >= 48 && v <= 800) out[k] = v;
    }
    return out;
  } catch {
    return { ...DEFAULT_PROJECT_LIBRARY_WIDTHS };
  }
}

export function writeProjectLibraryWidths(widths: Record<string, number>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROJECT_LIBRARY_WIDTHS_KEY, JSON.stringify(widths));
}

export function readProjectLibraryOrder(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PROJECT_LIBRARY_ORDER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function writeProjectLibraryOrder(order: string[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROJECT_LIBRARY_ORDER_KEY, JSON.stringify(order));
}

/** 按自定义顺序排序；未出现在 order 中的接在末尾 */
export function sortProjectsByOrder(projects: Project[], order: string[]): Project[] {
  if (!order.length) return [...projects];
  const rank = new Map(order.map((id, i) => [id, i]));
  return [...projects].sort((a, b) => {
    const ra = rank.has(a.id) ? rank.get(a.id)! : order.length + 1000;
    const rb = rank.has(b.id) ? rank.get(b.id)! : order.length + 1000;
    if (ra !== rb) return ra - rb;
    return a.title.localeCompare(b.title, "zh");
  });
}

export function moveIdInOrder(order: string[], dragId: string, overId: string, place: "before" | "after"): string[] {
  const ids = order.length ? [...order] : [];
  if (!ids.includes(dragId)) ids.push(dragId);
  if (!ids.includes(overId)) ids.push(overId);
  const from = ids.indexOf(dragId);
  ids.splice(from, 1);
  let to = ids.indexOf(overId);
  if (place === "after") to += 1;
  ids.splice(to, 0, dragId);
  return ids;
}
