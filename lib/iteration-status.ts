import type { Iteration, Requirement } from "@/lib/types";
import { requirementIsCancelled, requirementIsDone } from "@/lib/types";
import { childrenOf } from "@/lib/requirement-tree";

export type IterationTimeStatus = "upcoming" | "active" | "overdue" | "undated";

export function iterationTimeStatus(
  iter: Pick<Iteration, "start_date" | "end_date">,
  today = new Date().toISOString().slice(0, 10)
): IterationTimeStatus {
  const start = iter.start_date?.trim() || null;
  const end = iter.end_date?.trim() || null;
  if (!start && !end) return "undated";
  if (start && today < start) return "upcoming";
  if (end && today > end) return "overdue";
  return "active";
}

export const ITERATION_STATUS_LABELS: Record<IterationTimeStatus, string> = {
  upcoming: "未开始",
  active: "进行中",
  overdue: "已过期",
  undated: "未设日期",
};

export type ModuleSummaryRow = {
  moduleId: string;
  title: string;
  done: number;
  active: number;
  todo: number;
  total: number;
};

function classifyReq(req: Requirement): "done" | "active" | "todo" | "skip" {
  if (requirementIsCancelled(req) || req.force_closed) return "skip";
  if (requirementIsDone(req)) return "done";
  const tags = req.status_tags ?? [];
  if (
    tags.some((t) => /进行|开发|测试|评审|验收/.test(t)) ||
    req.status === "in_progress" ||
    req.status === "testing" ||
    req.status === "integration" ||
    req.status === "acceptance"
  ) {
    return "active";
  }
  return "todo";
}

function collectSubtree(rootId: string, all: Requirement[]): Requirement[] {
  const out: Requirement[] = [];
  const walk = (id: string) => {
    const self = all.find((r) => r.id === id);
    if (self) out.push(self);
    for (const kid of childrenOf(id, all)) walk(kid.id);
  };
  walk(rootId);
  return out;
}

/** 按顶层大型模块（epic；若无则按根节点）汇总该迭代内状态分布 */
export function iterationModuleSummary(
  requirements: Requirement[],
  iterationId: string
): { rows: ModuleSummaryRow[]; total: number; done: number } {
  const inIter = requirements.filter((r) => r.iteration_id === iterationId);
  const epics = inIter.filter((r) => r.type === "epic" && !r.parent_id);
  const roots = epics.length > 0 ? epics : inIter.filter((r) => !r.parent_id);

  const rows: ModuleSummaryRow[] = roots.map((mod) => {
    const tree = collectSubtree(mod.id, inIter);
    let done = 0;
    let active = 0;
    let todo = 0;
    for (const r of tree) {
      const c = classifyReq(r);
      if (c === "done") done += 1;
      else if (c === "active") active += 1;
      else if (c === "todo") todo += 1;
    }
    return {
      moduleId: mod.id,
      title: mod.title,
      done,
      active,
      todo,
      total: done + active + todo,
    };
  });

  let done = 0;
  let total = 0;
  for (const r of inIter) {
    const c = classifyReq(r);
    if (c === "skip") continue;
    total += 1;
    if (c === "done") done += 1;
  }

  return { rows, total, done };
}
