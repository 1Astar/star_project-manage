import { AGENT_ACTOR_NAME } from "@/lib/cursor-actor";
import type { ProjectMember } from "@/lib/types";

/** 产品本人在指派里的显示名（你） */
export const PRODUCT_ASSIGNEE_NAME = "产品";

/** 协作默认人选：你（产品）+ 我（白昼） */
export const DEFAULT_ASSIGNEE_NAMES = [PRODUCT_ASSIGNEE_NAME, AGENT_ACTOR_NAME] as const;

/** 项目成员 + 默认人选（去重保序） */
export function assigneeRosterNames(
  members: Array<Pick<ProjectMember, "name" | "is_active"> | string> = []
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const name = raw.trim();
    if (!name || seen.has(name)) return;
    seen.add(name);
    out.push(name);
  };
  for (const d of DEFAULT_ASSIGNEE_NAMES) push(d);
  for (const m of members) {
    if (typeof m === "string") push(m);
    else if (m.is_active !== false) push(m.name);
  }
  return out;
}
