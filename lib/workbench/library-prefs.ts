import type { Project } from "@/lib/studio/types";
import { toProjectTree, type ProjectTreeItem } from "@/lib/studio/project-tree";

export const WORKBENCH_LIBRARY_PREFS_KEY = "star-pm:workbench-library-v1";

export type WorkbenchLibraryPrefs = {
  /** 展示顺序（项目 id） */
  order: string[];
  /** 不显示的项目 id */
  hidden: string[];
};

export const DEFAULT_WORKBENCH_LIBRARY_PREFS: WorkbenchLibraryPrefs = {
  order: [],
  hidden: [],
};

export function parseWorkbenchLibraryPrefs(raw: unknown): WorkbenchLibraryPrefs {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_WORKBENCH_LIBRARY_PREFS };
  const obj = raw as Record<string, unknown>;
  const order = Array.isArray(obj.order)
    ? obj.order.filter((id): id is string => typeof id === "string")
    : [];
  const hidden = Array.isArray(obj.hidden)
    ? obj.hidden.filter((id): id is string => typeof id === "string")
    : [];
  return { order, hidden };
}

export function readWorkbenchLibraryPrefs(): WorkbenchLibraryPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_WORKBENCH_LIBRARY_PREFS };
  try {
    const raw = window.localStorage.getItem(WORKBENCH_LIBRARY_PREFS_KEY);
    if (!raw) return { ...DEFAULT_WORKBENCH_LIBRARY_PREFS };
    return parseWorkbenchLibraryPrefs(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_WORKBENCH_LIBRARY_PREFS };
  }
}

export function writeWorkbenchLibraryPrefs(prefs: WorkbenchLibraryPrefs): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WORKBENCH_LIBRARY_PREFS_KEY, JSON.stringify(prefs));
  void import("@/lib/ui/synced-pref").then(({ pushSyncedPref }) => {
    pushSyncedPref("workbench-library-v1", prefs);
  });
}

/** 默认排序：状态 → 优先级，再展成父→子树 */
export function defaultLibraryTree(projects: Project[]): ProjectTreeItem[] {
  const sorted = [...projects].sort((a, b) => {
    const order = { mainline: 0, active: 1, demo: 2, parking: 3, archived: 4 };
    return order[a.status] - order[b.status] || a.priority.localeCompare(b.priority);
  });
  return toProjectTree(sorted);
}

/** 按给定顺序标注父子深度（不重排） */
function annotateTreeOrder(projects: Project[]): ProjectTreeItem[] {
  const byId = new Map(projects.map((p) => [p.id, p]));
  return projects.map((p) => {
    const parentInList = !!(p.parentId && byId.has(p.parentId));
    return {
      project: p,
      depth: parentInList ? (1 as const) : (0 as const),
      parentTitle: parentInList ? (byId.get(p.parentId!)?.title ?? null) : null,
    };
  });
}

/**
 * 按偏好过滤 + 排序。
 * order 为空时走默认树序；隐藏项剔除；未知新 id 默认可见并接在末尾。
 */
export function applyLibraryPrefs(
  projects: Project[],
  prefs: WorkbenchLibraryPrefs
): ProjectTreeItem[] {
  const eligible = projects.filter((p) => p.status !== "archived");
  const hidden = new Set(prefs.hidden);
  const byId = new Map(eligible.map((p) => [p.id, p]));

  let baseTree: ProjectTreeItem[];
  if (prefs.order.length === 0) {
    baseTree = defaultLibraryTree(eligible);
  } else {
    const seen = new Set<string>();
    const ordered: Project[] = [];
    for (const id of prefs.order) {
      const p = byId.get(id);
      if (p && !seen.has(id)) {
        ordered.push(p);
        seen.add(id);
      }
    }
    for (const item of defaultLibraryTree(eligible)) {
      if (!seen.has(item.project.id)) {
        ordered.push(item.project);
        seen.add(item.project.id);
      }
    }
    baseTree = annotateTreeOrder(ordered);
  }

  return baseTree.filter((item) => !hidden.has(item.project.id));
}

/** 面板用：全部可配置项（含已隐藏），按当前有效顺序 */
export function libraryEditorRows(
  projects: Project[],
  prefs: WorkbenchLibraryPrefs
): Array<ProjectTreeItem & { visible: boolean }> {
  const eligible = projects.filter((p) => p.status !== "archived");
  const hidden = new Set(prefs.hidden);
  const all = applyLibraryPrefs(eligible, { order: prefs.order, hidden: [] });
  return all.map((item) => ({
    ...item,
    visible: !hidden.has(item.project.id),
  }));
}
