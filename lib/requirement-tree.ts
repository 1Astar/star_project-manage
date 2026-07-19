import type { Requirement } from "@/lib/types";
import {
  REQUIREMENT_CANCELLED_TAG,
  REQUIREMENT_DONE_TAG,
  requirementIsCancelled,
  requirementIsDone,
} from "@/lib/types";

export function childrenOf(
  parentId: string | null,
  requirements: Requirement[]
): Requirement[] {
  return requirements
    .filter((r) => (r.parent_id ?? null) === parentId)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function isLeafRequirement(req: Requirement, requirements: Requirement[]): boolean {
  return !requirements.some((r) => r.parent_id === req.id);
}

export function leafRequirementsOf(
  rootId: string,
  requirements: Requirement[]
): Requirement[] {
  const byParent = new Map<string | null, Requirement[]>();
  for (const r of requirements) {
    const key = r.parent_id ?? null;
    const list = byParent.get(key) ?? [];
    list.push(r);
    byParent.set(key, list);
  }
  const leaves: Requirement[] = [];
  function walk(id: string) {
    const kids = byParent.get(id) ?? [];
    if (!kids.length) {
      const self = requirements.find((r) => r.id === id);
      if (self) leaves.push(self);
      return;
    }
    for (const k of kids.sort((a, b) => a.sort_order - b.sort_order)) {
      walk(k.id);
    }
  }
  walk(rootId);
  return leaves;
}

/** 表上「预计」：叶子用自身 estimate；非叶 = Σ叶子 + direct_hours */
export function displayEstimateHours(
  req: Requirement,
  requirements: Requirement[]
): number | null {
  if (isLeafRequirement(req, requirements)) {
    return req.product_estimate_hours ?? null;
  }
  const leafSum = leafRequirementsOf(req.id, requirements).reduce(
    (sum, leaf) => sum + (leaf.product_estimate_hours ?? 0),
    0
  );
  const direct = req.direct_hours ?? 0;
  const total = leafSum + direct;
  if (total === 0 && req.direct_hours == null && leafSum === 0) {
    const anyLeafHours = leafRequirementsOf(req.id, requirements).some(
      (l) => l.product_estimate_hours != null
    );
    return anyLeafHours || req.direct_hours != null ? 0 : null;
  }
  return total;
}

export function depthOf(req: Requirement, requirements: Requirement[]): number {
  let d = 0;
  let cur: Requirement | undefined = req;
  const seen = new Set<string>();
  while (cur?.parent_id) {
    if (seen.has(cur.id)) break;
    seen.add(cur.id);
    d += 1;
    cur = requirements.find((r) => r.id === cur!.parent_id);
  }
  return d;
}

export function defaultReqTypeForDepth(depth: number): "epic" | "feature" | "task" {
  if (depth <= 0) return "epic";
  if (depth === 1) return "feature";
  return "task";
}

/** 深度优先树序（扁平列表，带 depth） */
export function flattenRequirementTree(
  requirements: Requirement[]
): Array<{ req: Requirement; depth: number }> {
  const roots = childrenOf(null, requirements);
  const out: Array<{ req: Requirement; depth: number }> = [];
  function walk(node: Requirement, depth: number) {
    out.push({ req: node, depth });
    for (const child of childrenOf(node.id, requirements)) {
      walk(child, depth + 1);
    }
  }
  for (const root of roots) walk(root, 0);
  const seen = new Set(out.map((x) => x.req.id));
  for (const r of requirements) {
    if (!seen.has(r.id)) out.push({ req: r, depth: 0 });
  }
  return out;
}

/**
 * 父状态推导：
 * - 强制关闭：不改
 * - 全部活跃子完成 → 「完成」
 * - 有未完成 → 去掉完成标签，必要时落到「进行中」
 */
export function deriveParentStatusTags(
  parent: Requirement,
  requirements: Requirement[]
): string[] | null {
  if (requirementIsCancelled(parent)) {
    return null;
  }
  const kids = childrenOf(parent.id, requirements);
  if (!kids.length) return null;

  const activeKids = kids.filter((k) => !requirementIsCancelled(k));
  if (!activeKids.length) {
    return [REQUIREMENT_CANCELLED_TAG];
  }

  const allDone = activeKids.every((k) => requirementIsDone(k));
  if (allDone) {
    return [REQUIREMENT_DONE_TAG];
  }

  const tags = (parent.status_tags ?? []).filter(
    (t) => t !== REQUIREMENT_DONE_TAG && t !== "已完成" && t !== "已做"
  );
  const anyProgress = activeKids.some(
    (k) =>
      requirementIsDone(k) ||
      (k.status_tags ?? []).some((t) => t !== "待开始")
  );
  if (requirementIsDone(parent) || !tags.length) {
    return tags.length ? tags : [anyProgress ? "进行中" : "待开始"];
  }
  return null;
}
