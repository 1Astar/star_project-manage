/** 入站校验：缺板块 → 待补齐标记，仍允许写入 */

export const PENDING_MODULE_MARKER = "【待补齐·板块】";

export type PendingModuleItem = {
  kind: "idea" | "evolution";
  id: string;
  title: string;
  projectId: string | null;
  reason: string;
};

export function needsModuleFill(opts: {
  relatedProjectId?: string | null;
  module?: string | null;
}): boolean {
  // 已关联项目但未填板块 → 待补齐
  return Boolean(opts.relatedProjectId?.trim()) && !opts.module?.trim();
}

export function appendPendingModuleMarker(existing: string | null | undefined): string {
  const base = (existing ?? "").trim();
  if (base.includes(PENDING_MODULE_MARKER)) return base;
  return base ? `${base}\n${PENDING_MODULE_MARKER}` : PENDING_MODULE_MARKER;
}

export function hasPendingModuleMarker(text: string | null | undefined): boolean {
  return (text ?? "").includes(PENDING_MODULE_MARKER);
}
