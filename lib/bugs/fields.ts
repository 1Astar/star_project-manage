/** Bug 环境标签与优先级（与严重程度 severity 分开） */

import type { Bug } from "@/lib/types";

export const BUG_ENV_OPTIONS = [
  "Android",
  "iOS",
  "macOS",
  "Windows",
  "Web",
] as const;

/** 旧代码构造 Bug 时补齐新字段默认值 */
export function defaultBugReproMeta(): Pick<
  Bug,
  | "precondition"
  | "expected_result"
  | "actual_result"
  | "module_path"
  | "found_version"
  | "resolved_version"
  | "environments"
  | "priority"
  | "test_plan_id"
  | "execution_case"
  | "iteration_id"
  | "reporter_name"
  | "updated_by"
  | "watchers"
  | "linked_learning_note_ids"
  | "linked_competitor_ids"
  | "custom_fields"
> {
  return {
    precondition: null,
    expected_result: null,
    actual_result: null,
    module_path: null,
    found_version: null,
    resolved_version: null,
    environments: [],
    priority: null,
    test_plan_id: null,
    execution_case: null,
    iteration_id: null,
    reporter_name: null,
    updated_by: null,
    watchers: [],
    linked_learning_note_ids: [],
    linked_competitor_ids: [],
    custom_fields: {},
  };
}

export function normalizeBugCustomFields(
  raw: unknown
): Record<string, string | number | boolean | null> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(k ?? "").trim();
    if (!key) continue;
    if (v === null || v === undefined) {
      out[key] = null;
      continue;
    }
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[key] = v;
      continue;
    }
    out[key] = String(v);
  }
  return out;
}

export type BugEnvTag = (typeof BUG_ENV_OPTIONS)[number] | string;

export type BugPriority = "P0" | "P1" | "P2" | "P3";

export const BUG_PRIORITY_OPTIONS: BugPriority[] = ["P0", "P1", "P2", "P3"];

export const BUG_PRIORITY_LABELS: Record<BugPriority, string> = {
  P0: "P0 · 立即",
  P1: "P1 · 高",
  P2: "P2 · 中",
  P3: "P3 · 低",
};

export function normalizeBugPriority(raw: unknown): BugPriority | null {
  const v = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (v === "P0" || v === "P1" || v === "P2" || v === "P3") return v;
  return null;
}

export function normalizeBugEnvironments(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((x) => String(x ?? "").trim())
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i);
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw
      .split(/[,，|/\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/** 关注人姓名列表（去重保序） */
export function normalizeBugWatchers(raw: unknown): string[] {
  return normalizeBugEnvironments(raw);
}
