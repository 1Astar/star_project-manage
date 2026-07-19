import type { Project } from "@/lib/studio/types";

export type ProjectTreeItem = {
  project: Project;
  /** 树形深度：0 顶层，1 子项目 */
  depth: 0 | 1;
  parentTitle: string | null;
};

/** 在现有排序上重排为「父 → 子」；仅一层。孤儿（父不在列表）当顶层。 */
export function toProjectTree(projects: Project[]): ProjectTreeItem[] {
  const byId = new Map(projects.map((p) => [p.id, p]));
  const roots = projects.filter((p) => !p.parentId || !byId.has(p.parentId));
  const result: ProjectTreeItem[] = [];

  for (const root of roots) {
    result.push({ project: root, depth: 0, parentTitle: null });
    const children = projects.filter((p) => p.parentId === root.id);
    for (const child of children) {
      result.push({
        project: child,
        depth: 1,
        parentTitle: root.title,
      });
    }
  }

  return result;
}
