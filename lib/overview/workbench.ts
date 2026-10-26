import {
  OVERVIEW_TYPE_CARDS,
  type OverviewFilterType,
  type OverviewMatrixRow,
} from "@/lib/overview/matrix-rows";
import {
  requirementIsCancelled,
  requirementIsDone,
  TASK_STATUS_LABELS,
  type Bug,
  type Requirement,
} from "@/lib/types";

export type WorkbenchShellView = "overview" | "stats" | "pending" | "recent";

export const WORKBENCH_SHELL_TABS: Array<{
  id: WorkbenchShellView;
  label: string;
}> = [
  { id: "overview", label: "总览" },
  { id: "stats", label: "统计" },
  { id: "pending", label: "待处理" },
  { id: "recent", label: "最近更新" },
];

export type WorkbenchTypeCount = {
  type: OverviewFilterType;
  count: number;
  /** 聊天参考等尚未入库的类型 */
  stub?: boolean;
};

export type WorkbenchPendingItem = OverviewMatrixRow & {
  reason: string;
};

export type WorkbenchStats = {
  total: number;
  byType: WorkbenchTypeCount[];
  bySection: Array<{ section: string; count: number }>;
  pendingCount: number;
};

function bugOpen(b: Bug | undefined): boolean {
  if (!b) return false;
  return b.status !== "done";
}

export function countRowsByType(rows: OverviewMatrixRow[]): WorkbenchTypeCount[] {
  const map = new Map<OverviewFilterType, number>();
  for (const t of OVERVIEW_TYPE_CARDS) map.set(t, 0);
  for (const r of rows) {
    map.set(r.rowType, (map.get(r.rowType) ?? 0) + 1);
  }
  return OVERVIEW_TYPE_CARDS.map((type) => ({
    type,
    count: map.get(type) ?? 0,
    stub: type === "聊天参考",
  }));
}

export function buildWorkbenchStats(
  rows: OverviewMatrixRow[],
  pending: WorkbenchPendingItem[]
): WorkbenchStats {
  const sectionMap = new Map<string, number>();
  for (const r of rows) {
    sectionMap.set(r.section, (sectionMap.get(r.section) ?? 0) + 1);
  }
  const bySection = Array.from(sectionMap.entries())
    .map(([section, count]) => ({ section, count }))
    .sort(
      (a, b) => b.count - a.count || a.section.localeCompare(b.section, "zh")
    );
  return {
    total: rows.length,
    byType: countRowsByType(rows),
    bySection,
    pendingCount: pending.length,
  };
}

/**
 * 待处理启发式（产品语言）：
 * - Bug / 优化：未完成
 * - 需求：未完成且未放弃
 * - 竞品：摘要空
 * - 任意类型：板块为「未分板块」
 * - 聊天参考：无（类型未落地）
 */
export function buildWorkbenchPending(input: {
  rows: OverviewMatrixRow[];
  bugs: Bug[];
  requirements: Requirement[];
}): WorkbenchPendingItem[] {
  const bugsById = new Map(input.bugs.map((b) => [b.id, b]));
  const reqsById = new Map(input.requirements.map((r) => [r.id, r]));
  const out: WorkbenchPendingItem[] = [];

  for (const row of input.rows) {
    const reasons: string[] = [];

    if (row.section === "未分板块") {
      reasons.push("待补齐板块");
    }

    if (row.rowType === "Bug" || row.rowType === "优化建议") {
      const b = bugsById.get(row.entityId);
      if (bugOpen(b)) {
        reasons.push(
          `状态：${TASK_STATUS_LABELS[b!.status] ?? b!.status}`
        );
      }
    } else if (row.rowType === "需求") {
      const r = reqsById.get(row.entityId);
      if (r && !requirementIsCancelled(r) && !requirementIsDone(r)) {
        reasons.push("需求未完成");
      }
    } else if (row.rowType === "竞品") {
      if (!(row.summary ?? "").trim()) {
        reasons.push("摘要为空");
      }
    }

    if (reasons.length === 0) continue;
    // 仅「未分板块」且其它已闭环的知识点/已完成 Bug 仍提示补板块
    if (
      reasons.length === 1 &&
      reasons[0] === "待补齐板块" &&
      (row.rowType === "Bug" || row.rowType === "优化建议")
    ) {
      const b = bugsById.get(row.entityId);
      if (b && !bugOpen(b)) {
        // 已完成 Bug 只缺板块：仍列入，便于整理
      }
    }
    if (
      reasons.length === 1 &&
      reasons[0] === "待补齐板块" &&
      row.rowType === "需求"
    ) {
      const r = reqsById.get(row.entityId);
      if (r && (requirementIsDone(r) || requirementIsCancelled(r))) {
        // 已完成需求仍可补板块
      }
    }

    out.push({ ...row, reason: reasons.join(" · ") });
  }

  out.sort((a, b) => {
    const ta = a.updatedAt.localeCompare(b.updatedAt);
    if (ta !== 0) return -ta;
    return a.title.localeCompare(b.title, "zh");
  });
  return out;
}

export function buildWorkbenchRecent(
  rows: OverviewMatrixRow[],
  limit = 20
): OverviewMatrixRow[] {
  return [...rows]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}
