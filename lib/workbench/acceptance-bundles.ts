/**
 * 待验收按「项目 × 板块路径」汇总（大·小可多层）
 */
import type { ModuleNode } from "@/lib/types";
import type { PmAcceptanceItem } from "@/lib/workbench/pm-inbox";

export const UNCATEGORIZED_MODULE = "未分板块";

export type PmAcceptanceBundle = {
  id: string;
  projectId: string;
  pmProjectId: string;
  projectTitle: string;
  liveSiteUrl?: string | null;
  /** 板块路径，如 六爻·笔记；缺省为「未分板块」 */
  module: string;
  href: string;
  itemCount: number;
  /** 合成三行 */
  why: string;
  result: string;
  howToVerify: string[];
  at: string;
  items: PmAcceptanceItem[];
};

/** 规范化板块路径：统一 · 分隔，去空段 */
export function normalizeModulePath(raw?: string | null): string {
  const s = (raw ?? "").trim();
  if (!s) return UNCATEGORIZED_MODULE;
  const parts = s
    .split(/[·>•／/、,，]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length ? parts.join("·") : UNCATEGORIZED_MODULE;
}

/** 大板块 = 首段；小板块 = 其余用 · 连接（仅一段则 minor 为空） */
export function splitModuleMajorMinor(raw?: string | null): {
  major: string;
  minor: string;
  path: string;
} {
  const path = normalizeModulePath(raw);
  if (path === UNCATEGORIZED_MODULE) {
    return { major: UNCATEGORIZED_MODULE, minor: "", path };
  }
  const parts = path.split("·").filter(Boolean);
  if (parts.length === 1) return { major: parts[0]!, minor: "", path };
  return {
    major: parts[0]!,
    minor: parts.slice(1).join("·"),
    path,
  };
}

/** 从需求模块树拼出 大·小… 路径 */
export function modulePathFromRequirement(
  req: { module_l1_id: string | null; module_l2_id: string | null },
  modules: ModuleNode[]
): string {
  const leafId = req.module_l2_id || req.module_l1_id;
  if (!leafId) return UNCATEGORIZED_MODULE;
  const byId = new Map(modules.map((m) => [m.id, m]));
  const parts: string[] = [];
  let cur = byId.get(leafId);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    parts.unshift(cur.name);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return parts.length ? parts.join("·") : UNCATEGORIZED_MODULE;
}

function uniqNonEmpty(lines: string[], max = 8): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const t = line.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function synthesizeWhy(items: PmAcceptanceItem[]): string {
  const bits = uniqNonEmpty(
    items.map((i) => i.why || i.title),
    3
  );
  if (bits.length <= 1) return bits[0] || items[0]?.title || "待验收";
  return bits.join("；");
}

function synthesizeResult(items: PmAcceptanceItem[]): string {
  const done = items.filter((i) => i.result?.trim()).map((i) => i.result!.trim());
  const head = uniqNonEmpty(done, 2);
  const suffix =
    items.length > 1 ? `（共 ${items.length} 项：正式 ${items.filter((i) => i.source === "formal").length} / 会话 ${items.filter((i) => i.source === "change_session").length}）` : "";
  if (head.length) return `${head.join("；")}${suffix}`;
  return `待你过目${suffix || `（${items.length} 项）`}`;
}

function synthesizeHowToVerify(items: PmAcceptanceItem[]): string[] {
  return uniqNonEmpty(
    items.flatMap((i) => i.howToVerify ?? []),
    5
  );
}

export function bundleKey(projectId: string, module: string): string {
  return `${projectId}::${normalizeModulePath(module)}`;
}

/** 将扁平验收项按项目×板块汇总 */
export function bundlePmAcceptanceItems(
  items: PmAcceptanceItem[]
): PmAcceptanceBundle[] {
  const map = new Map<string, PmAcceptanceItem[]>();
  for (const item of items) {
    const mod = normalizeModulePath(item.module);
    const key = bundleKey(item.projectId, mod);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }

  const bundles: PmAcceptanceBundle[] = [];
  for (const [, group] of map) {
    group.sort((a, b) => b.at.localeCompare(a.at));
    const first = group[0]!;
    const module = normalizeModulePath(first.module);
    bundles.push({
      id: `bundle:${bundleKey(first.projectId, module)}`,
      projectId: first.projectId,
      pmProjectId: first.pmProjectId,
      projectTitle: first.projectTitle,
      liveSiteUrl: first.liveSiteUrl,
      module,
      href: first.href,
      itemCount: group.length,
      why: synthesizeWhy(group),
      result: synthesizeResult(group),
      howToVerify: synthesizeHowToVerify(group),
      at: first.at,
      items: group,
    });
  }

  bundles.sort(
    (a, b) =>
      a.projectTitle.localeCompare(b.projectTitle, "zh-CN") ||
      a.module.localeCompare(b.module, "zh-CN") ||
      b.at.localeCompare(a.at)
  );
  return bundles;
}
