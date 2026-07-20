/** 各项目「功能板块」默认名单；可被 project.featureModules 覆盖 */

export const DEFAULT_FEATURE_MODULES = [
  "工作台",
  "项目库",
  "灵感",
  "需求任务",
  "迭代记录",
  "资源中心",
  "Git",
  "设置",
] as const;

export const GENERIC_FEATURE_MODULES = [
  "产品",
  "体验",
  "技术",
  "交付",
] as const;

/** Star PM 自身用产品板块；其它项目用通用默认，除非项目已自定义 */
export function resolveFeatureModules(
  projectId: string,
  custom: string[] | null | undefined
): string[] {
  const cleaned = (custom ?? []).map((m) => m.trim()).filter(Boolean);
  if (cleaned.length > 0) return Array.from(new Set(cleaned));
  if (projectId === "proj-star-pm") return [...DEFAULT_FEATURE_MODULES];
  return [...GENERIC_FEATURE_MODULES];
}

export function normalizeModuleName(value: string | null | undefined): string {
  return (value ?? "").trim();
}
