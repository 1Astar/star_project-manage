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

/**
 * 通用兜底：横切视角，不是具体功能。
 * 有项目专属目录或自定义 featureModules 时不应优先用这组。
 */
export const GENERIC_FEATURE_MODULES = [
  "产品",
  "体验",
  "技术",
  "交付",
] as const;

/** Chris Phone / 小手机：按产品功能面，不是「产品/技术」标签 */
export const CHRIS_PHONE_FEATURE_MODULES = [
  "对话聊天",
  "相册图库",
  "浏览器",
  "口袋文件",
  "日记心情",
  "指令命令",
  "推送通知",
  "记忆星座",
  "OpenCLI",
  "系统壳",
] as const;

export type ModuleCatalogId = "star-pm" | "chris-phone" | "generic";

export function detectModuleCatalog(
  projectId: string | null | undefined,
  githubRepo?: string | null
): ModuleCatalogId {
  if (projectId === "proj-star-pm") return "star-pm";
  const repo = (githubRepo ?? "").trim().toLowerCase();
  if (repo.includes("chris-phone")) return "chris-phone";
  return "generic";
}

export function modulesForCatalog(catalog: ModuleCatalogId): string[] {
  if (catalog === "star-pm") return [...DEFAULT_FEATURE_MODULES];
  if (catalog === "chris-phone") return [...CHRIS_PHONE_FEATURE_MODULES];
  return [...GENERIC_FEATURE_MODULES];
}

/** Star PM 自身用产品板块；Chris Phone 用功能面；其它用通用默认，除非项目已自定义 */
export function resolveFeatureModules(
  projectId: string,
  custom: string[] | null | undefined,
  githubRepo?: string | null
): string[] {
  const cleaned = (custom ?? []).map((m) => m.trim()).filter(Boolean);
  if (cleaned.length > 0) return Array.from(new Set(cleaned));
  return modulesForCatalog(detectModuleCatalog(projectId, githubRepo));
}

export function normalizeModuleName(value: string | null | undefined): string {
  return (value ?? "").trim();
}

/** 路径层级分隔：中点 / 斜杠 / 顿号 */
const HIERARCHY_SEP = /[·/、]+/;

/** 将粘贴路径规范为用「·」连接的层级串 */
export function normalizeFeaturePath(path: string): string {
  return path
    .split(HIERARCHY_SEP)
    .map((s) => s.trim())
    .filter(Boolean)
    .join("·");
}

/** 拆成层级名数组：六爻/笔记、卦象解析 → [六爻, 笔记, 卦象解析] */
export function parseFeaturePathToChain(path: string): string[] {
  return path
    .split(HIERARCHY_SEP)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * 解析粘贴的板块名单。
 * - 换行 / 分号：多条路径
 * - 条内含 · / 、：整行一条路径（按分隔符分层）
 * - 否则可用逗号拆多条扁平名（如「对话聊天,相册图库」）
 */
export function parseFeatureModulesInput(raw: string): string[] {
  const lines = raw
    .split(/[\n\r;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const line of lines) {
    if (/[·/、]/.test(line)) {
      out.push(normalizeFeaturePath(line));
    } else {
      for (const part of line.split(/[,，]+/)) {
        const t = part.trim();
        if (t) out.push(t);
      }
    }
  }
  return Array.from(new Set(out));
}
