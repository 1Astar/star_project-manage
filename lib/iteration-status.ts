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
  overdue: "延期",
  undated: "未设日期",
};

/** 规划范围 = 挂在本期；时间窗 = 完成日落在起止内 */
export type IterationViewMode = "scope" | "window";

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
    tags.some((t) => /进行|开发|测试|评审|验收|规划|想法/.test(t)) ||
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

function shanghaiDay(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const raw = iso.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(d);
}

/** 起止均含当日；缺开始/结束则该侧不限 */
export function dayInIterationWindow(
  day: string | null,
  iter: Pick<Iteration, "start_date" | "end_date">
): boolean {
  if (!day) return false;
  const start = iter.start_date?.trim() || null;
  const end = iter.end_date?.trim() || null;
  if (!start && !end) return false;
  if (start && day < start) return false;
  if (end && day > end) return false;
  return true;
}

function byId(all: Requirement[]): Map<string, Requirement> {
  return new Map(all.map((r) => [r.id, r]));
}

/** 向上找顶层 epic；没有则找根节点 */
function topModuleOf(req: Requirement, map: Map<string, Requirement>): Requirement {
  let cur = req;
  const seen = new Set<string>();
  while (cur.parent_id && !seen.has(cur.id)) {
    seen.add(cur.id);
    const p = map.get(cur.parent_id);
    if (!p) break;
    cur = p;
  }
  return cur;
}

function summarizeSet(
  inSet: Requirement[],
  all: Requirement[]
): { rows: ModuleSummaryRow[]; total: number; done: number } {
  const map = byId(all);
  const byMod = new Map<string, { mod: Requirement; items: Requirement[] }>();

  for (const r of inSet) {
    const c = classifyReq(r);
    if (c === "skip") continue;
    const mod = topModuleOf(r, map);
    const bucket = byMod.get(mod.id) ?? { mod, items: [] };
    bucket.items.push(r);
    byMod.set(mod.id, bucket);
  }

  const rows: ModuleSummaryRow[] = [...byMod.values()].map(({ mod, items }) => {
    let done = 0;
    let active = 0;
    let todo = 0;
    for (const r of items) {
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
  rows.sort((a, b) => b.total - a.total || a.title.localeCompare(b.title, "zh"));

  let done = 0;
  let total = 0;
  for (const r of inSet) {
    const c = classifyReq(r);
    if (c === "skip") continue;
    total += 1;
    if (c === "done") done += 1;
  }

  return { rows, total, done };
}

/** 按顶层大型模块汇总该迭代「规划范围」内状态分布 */
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

/**
 * 双口径汇总。
 * - scope：挂在本期的需求（规划范围）
 * - window：完成日落在本期起止内（时间窗复盘；不改挂期）
 */
export function iterationPeriodSummary(
  requirements: Requirement[],
  iteration: Pick<Iteration, "id" | "start_date" | "end_date">,
  mode: IterationViewMode
): {
  rows: ModuleSummaryRow[];
  total: number;
  done: number;
  mode: IterationViewMode;
  needsDates: boolean;
} {
  if (mode === "scope") {
    const s = iterationModuleSummary(requirements, iteration.id);
    return { ...s, mode, needsDates: false };
  }

  const start = iteration.start_date?.trim() || null;
  const end = iteration.end_date?.trim() || null;
  if (!start && !end) {
    return { rows: [], total: 0, done: 0, mode, needsDates: true };
  }

  const inWindow = requirements.filter((r) => {
    if (requirementIsCancelled(r) || r.force_closed) return false;
    if (!requirementIsDone(r)) return false;
    return dayInIterationWindow(shanghaiDay(r.completed_at), iteration);
  });

  const s = summarizeSet(inWindow, requirements);
  return { ...s, mode, needsDates: false };
}
