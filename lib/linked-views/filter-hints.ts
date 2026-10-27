import type { LinkedViewFilter } from "./config";

/** 从筛选规则取出「所属模块」提示（包含 / 等于） */
export function moduleHintFromFilters(filters: LinkedViewFilter[]): string {
  const hit = filters.find(
    (f) =>
      f.field === "module" &&
      (f.op === "contains" || f.op === "equals") &&
      f.value.trim()
  );
  return hit?.value.trim() ?? "";
}

export function titleHintFromFilters(filters: LinkedViewFilter[]): string {
  const hit = filters.find(
    (f) =>
      f.field === "title" &&
      (f.op === "equals" || f.op === "contains") &&
      f.value.trim()
  );
  return hit?.value.trim() ?? "";
}
