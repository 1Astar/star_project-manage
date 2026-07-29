/**
 * 需求生命周期状态机（看板主列）
 *
 * 想法 → 已规划 → AI开发中 → 开发中 → 待验收 → 完成
 * 旁路：放弃
 *
 * 旧标签（待开始/评审/进行中/…）读时归一到上述主状态，写时落规范标签。
 */

import type { TaskStatus } from "@/lib/types";

export const REQUIREMENT_STATUS_FLOW = [
  "想法",
  "已规划",
  "AI开发中",
  "开发中",
  "待验收",
  "完成",
] as const;

export const REQUIREMENT_ABANDONED_TAG = "放弃";

export type RequirementLifecycleStatus =
  | (typeof REQUIREMENT_STATUS_FLOW)[number]
  | typeof REQUIREMENT_ABANDONED_TAG;

/** 看板列：主流程 + 放弃 */
export const REQUIREMENT_KANBAN_COLUMNS: readonly RequirementLifecycleStatus[] = [
  ...REQUIREMENT_STATUS_FLOW,
  REQUIREMENT_ABANDONED_TAG,
];

const FLOW_SET = new Set<string>(REQUIREMENT_STATUS_FLOW);

/** 旧标签 / 别名 → 规范生命周期状态 */
const LEGACY_TO_LIFECYCLE: Record<string, RequirementLifecycleStatus> = {
  想法: "想法",
  待开始: "想法",
  已记录: "想法",
  已规划: "已规划",
  评审: "已规划",
  AI开发中: "AI开发中",
  开发中: "开发中",
  进行中: "开发中",
  待联调: "开发中",
  联调: "开发中",
  待测试: "开发中",
  测试: "开发中",
  待验收: "待验收",
  验收: "待验收",
  完成: "完成",
  已完成: "完成",
  已做: "完成",
  放弃: "放弃",
  已取消: "放弃",
  取消: "放弃",
  搁置: "放弃",
  阻塞: "放弃",
};

const LIFECYCLE_OR_LEGACY = new Set([
  ...Object.keys(LEGACY_TO_LIFECYCLE),
  ...REQUIREMENT_KANBAN_COLUMNS,
]);

export function isLifecycleOrLegacyTag(tag: string): boolean {
  return LIFECYCLE_OR_LEGACY.has(tag) || FLOW_SET.has(tag);
}

export function normalizeLifecycleTag(tag: string): RequirementLifecycleStatus | null {
  return LEGACY_TO_LIFECYCLE[tag] ?? null;
}

/** 从 status_tags 解析当前生命周期（优先靠右/靠后的主状态） */
export function requirementLifecycleStatus(
  req: Pick<{ status_tags?: string[] | null; status?: TaskStatus }, "status_tags" | "status">
): RequirementLifecycleStatus {
  const tags = req.status_tags ?? [];
  for (let i = tags.length - 1; i >= 0; i -= 1) {
    const mapped = normalizeLifecycleTag(tags[i]!);
    if (mapped) return mapped;
  }
  // 无标签时回退 TaskStatus
  switch (req.status) {
    case "done":
      return "完成";
    case "acceptance":
      return "待验收";
    case "blocked":
      return "放弃";
    case "in_progress":
      return "AI开发中";
    case "integration":
    case "testing":
      return "开发中";
    case "pending":
    default:
      return "想法";
  }
}

/** 看板列名（与生命周期一致；无「其他」时用想法） */
export function requirementKanbanColumn(
  req: Pick<{ status_tags?: string[] | null; status?: TaskStatus }, "status_tags" | "status">
): RequirementLifecycleStatus {
  return requirementLifecycleStatus(req);
}

/**
 * 把主状态换成目标列，保留非生命周期的自定义标签。
 */
export function applyLifecycleStatus(
  prevTags: string[] | null | undefined,
  column: RequirementLifecycleStatus | string
): string[] {
  const target = (normalizeLifecycleTag(column) ??
    (REQUIREMENT_KANBAN_COLUMNS.includes(column as RequirementLifecycleStatus)
      ? (column as RequirementLifecycleStatus)
      : null)) as RequirementLifecycleStatus | null;
  const extras = (prevTags ?? []).filter((t) => !isLifecycleOrLegacyTag(t));
  if (!target) {
    return extras.length ? extras : ["想法"];
  }
  return [target, ...extras];
}

/** 读时归一：主状态只保留一个规范标签 */
export function canonicalizeStatusTags(tags: string[] | null | undefined): string[] {
  const list = (tags ?? []).map((t) => String(t).trim()).filter(Boolean);
  if (list.length === 0) return ["想法"];
  const life = requirementLifecycleStatus({ status_tags: list });
  const extras = list.filter((t) => !isLifecycleOrLegacyTag(t));
  return [life, ...extras];
}

export function lifecycleToTaskStatus(life: RequirementLifecycleStatus): TaskStatus {
  switch (life) {
    case "完成":
      return "done";
    case "待验收":
      return "acceptance";
    case "放弃":
      return "blocked";
    case "AI开发中":
    case "开发中":
      return "in_progress";
    case "已规划":
      return "in_progress";
    case "想法":
    default:
      return "pending";
  }
}

export const REQUIREMENT_STATUS_HINT =
  "想法 → 已规划 → AI开发中 → 开发中 → 待验收 → 完成（可拖到「放弃」退出）";
