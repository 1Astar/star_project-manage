/**
 * 按条目关键词推断功能板块（导入 / 发版 / 灵感写入共用）
 */

import {
  DEFAULT_FEATURE_MODULES,
  GENERIC_FEATURE_MODULES,
  resolveFeatureModules,
} from "@/lib/studio/project-modules";

export type ModuleHint = {
  module: string;
  patterns: RegExp[];
};

/** Star PM 产品向关键词 */
export const STAR_PM_MODULE_HINTS: ModuleHint[] = [
  { module: "工作台", patterns: [/工作台/, /今日/, /驾驶舱/, /焦点/, /星图/] },
  {
    module: "项目库",
    patterns: [/项目库/, /父子/, /parent_id/, /新建项目/, /自定义字段/, /内联编辑/],
  },
  {
    module: "灵感",
    patterns: [/灵感/, /\bIdea\b/i, /capture_idea/, /收件箱/, /Notion/, /脑暴/],
  },
  {
    module: "需求任务",
    patterns: [/需求/, /任务/, /看板/, /迭代计划/, /甘特/, /需求池/],
  },
  {
    module: "迭代记录",
    patterns: [/迭代记录/, /发版时间线/, /演进/, /evolution/, /publish_release/, /板块/],
  },
  {
    module: "资源中心",
    patterns: [/资源中心/, /资料/, /Release\/?Tag/, /同步版本/, /过程 Tag/, /作品集/, /Prompt 模板/, /Case Study/],
  },
  {
    module: "Git",
    patterns: [/\bGit\b/i, /GitHub/, /commit/, /仓库/, /Tag 同步/, /分支/],
  },
  {
    module: "设置",
    patterns: [/设置/, /密钥/, /AI 规则/, /CANONICAL/, /\bMCP\b/, /Migration/, /环境变量/],
  },
];

/** 通用项目关键词 */
export const GENERIC_MODULE_HINTS: ModuleHint[] = [
  { module: "产品", patterns: [/产品/, /定位/, /需求/, /PRD/, /用户/] },
  { module: "体验", patterns: [/体验/, /UI/, /交互/, /视觉/, /设计/] },
  { module: "技术", patterns: [/技术/, /架构/, /接口/, /API/, /性能/, /重构/] },
  { module: "交付", patterns: [/交付/, /发版/, /上线/, /部署/, /Release/, /验收/] },
];

function hintsForProject(projectId: string | null | undefined): ModuleHint[] {
  if (projectId === "proj-star-pm") return STAR_PM_MODULE_HINTS;
  return GENERIC_MODULE_HINTS;
}

/**
 * 从文本推断最匹配的一个板块；无命中返回 null。
 * @param allowed 若传入，只在允许列表内选
 */
export function inferModuleFromText(
  text: string,
  opts?: {
    projectId?: string | null;
    allowed?: string[] | null;
  }
): string | null {
  const raw = (text ?? "").trim();
  if (!raw) return null;

  const hints = hintsForProject(opts?.projectId);
  const allowed = (opts?.allowed ?? []).map((m) => m.trim()).filter(Boolean);
  const allowSet = allowed.length > 0 ? new Set(allowed) : null;

  let best: { module: string; score: number } | null = null;
  for (const hint of hints) {
    if (allowSet && !allowSet.has(hint.module)) continue;
    let score = 0;
    for (const p of hint.patterns) {
      if (p.test(raw)) score += 1;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { module: hint.module, score };
    }
  }
  return best?.module ?? null;
}

/** 推断可能命中的多个板块（发版汇总用） */
export function inferModulesFromText(
  text: string,
  opts?: { projectId?: string | null; allowed?: string[] | null }
): string[] {
  const raw = (text ?? "").trim();
  if (!raw) return [];
  const hints = hintsForProject(opts?.projectId);
  const allowed = (opts?.allowed ?? []).map((m) => m.trim()).filter(Boolean);
  const allowSet = allowed.length > 0 ? new Set(allowed) : null;
  const hit: string[] = [];
  for (const hint of hints) {
    if (allowSet && !allowSet.has(hint.module)) continue;
    if (hint.patterns.some((p) => p.test(raw))) hit.push(hint.module);
  }
  return hit;
}

/** 写入前：有显式板块用显式；否则按关键词推断；仍无则返回空串 */
export function resolveModuleForImport(
  explicit: string | null | undefined,
  text: string,
  projectId?: string | null
): { module: string; inferred: boolean } {
  const given = (explicit ?? "").trim();
  if (given) return { module: given, inferred: false };
  const allowed = projectId
    ? resolveFeatureModules(projectId, null)
    : [...DEFAULT_FEATURE_MODULES];
  const inferred = inferModuleFromText(text, { projectId, allowed });
  return { module: inferred ?? "", inferred: Boolean(inferred) };
}

export function defaultModulesCatalog(projectId?: string | null): string[] {
  if (projectId === "proj-star-pm") return [...DEFAULT_FEATURE_MODULES];
  return [...GENERIC_FEATURE_MODULES];
}
