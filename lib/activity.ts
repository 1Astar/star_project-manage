import type { ActivityLog } from "@/lib/types";
import {
  AGENT_NOTE_PREFIX,
  CURSOR_NOTE_PREFIX,
  decodeAgentActivityNote,
  displayActorName,
} from "@/lib/cursor-actor";

function parseList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {
    /* plain text */
  }
  return raw
    .split(/[,、]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const FIELD_LABELS: Record<string, string> = {
  title: "标题",
  assignees: "指派",
  status_tags: "状态",
  status: "状态",
  priority: "优先级",
  detail_work: "需求内容",
  acceptance_criteria: "验收标准",
  next_step: "下一步",
  req_source: "需求来源",
  inspiration_source: "灵感来源",
  product_estimate_hours: "预计工时",
  in_pool: "规划",
  promote: "加入计划",
  create: "新建",
  delete: "删除",
  sync: "同步",
};

/** 把动作日志翻成可读句子；note 为 Auto 窗口灰色备注 */
export function describeActivity(
  log: Pick<
    ActivityLog,
    | "entity_type"
    | "entity_id"
    | "field_name"
    | "old_value"
    | "new_value"
    | "actor_name"
    | "created_at"
  >,
  titleByEntityId?: Map<string, string>
): { time: string; text: string; note: string | null } {
  const time = log.created_at.replace("T", " ").slice(0, 16);
  const who = displayActorName(log.actor_name);
  const note = decodeAgentActivityNote(log.old_value);
  const title =
    titleByEntityId?.get(log.entity_id) ||
    (log.field_name === "create" || log.field_name === "sync"
      ? log.new_value
      : null) ||
    "该项";

  const withNote = (text: string) => ({ time, text, note });

  if (log.entity_type === "requirement" || log.entity_type === "req") {
    switch (log.field_name) {
      case "create":
        return withNote(`${who} 新建了需求「${log.new_value || title}」`);
      case "sync":
        return withNote(`${who} 将灵感同步为需求「${log.new_value || title}」`);
      case "delete":
        return withNote(`${who} 删除了需求「${log.new_value || title}」`);
      case "assignees": {
        const next = parseList(log.new_value);
        const people = next.length ? next.join("、") : "（清空指派）";
        return withNote(`${who} 将需求「${title}」指派给 ${people}`);
      }
      case "status_tags":
      case "status": {
        const next = parseList(log.new_value);
        const tags = next.length ? next.join("、") : log.new_value || "—";
        return withNote(`${who} 将需求「${title}」状态改为 ${tags}`);
      }
      case "promote":
      case "in_pool":
        return withNote(
          `${who} 将需求「${title}」加入计划${
            log.new_value && log.field_name === "promote" ? `「${log.new_value}」` : ""
          }`
        );
      case "title":
        return withNote(`${who} 将需求标题改为「${log.new_value || "—"}」`);
      case "priority":
        return withNote(`${who} 将需求「${title}」优先级改为 ${log.new_value || "—"}`);
      default: {
        const label = FIELD_LABELS[log.field_name] ?? log.field_name;
        if (
          log.old_value &&
          !log.old_value.startsWith(AGENT_NOTE_PREFIX) &&
          !log.old_value.startsWith(CURSOR_NOTE_PREFIX) &&
          log.new_value
        ) {
          return withNote(`${who} 更新了需求「${title}」的${label}`);
        }
        return withNote(`${who} 更新了需求「${title}」的${label}`);
      }
    }
  }

  if (log.entity_type === "role_task") {
    const label = FIELD_LABELS[log.field_name] ?? log.field_name;
    if (log.field_name === "assignee") {
      return withNote(`${who} 将任务指派给 ${log.new_value || "（清空）"}`);
    }
    if (log.field_name === "status") {
      return withNote(`${who} 将任务状态改为 ${log.new_value || "—"}`);
    }
    return withNote(`${who} 更新了任务的${label}`);
  }

  if (log.entity_type === "bug") {
    if (log.field_name === "create") {
      return withNote(`${who} 提了 Bug「${log.new_value || title}」`);
    }
    return withNote(`${who} 更新了 Bug`);
  }

  return withNote(
    `${who} · ${log.entity_type} · ${FIELD_LABELS[log.field_name] ?? log.field_name}`
  );
}
