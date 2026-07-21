/**
 * 按条目关键词推断功能板块（导入 / 发版 / 灵感写入共用）
 */

import {
  CHRIS_PHONE_FEATURE_MODULES,
  DEFAULT_FEATURE_MODULES,
  GENERIC_FEATURE_MODULES,
  detectModuleCatalog,
  resolveFeatureModules,
  type ModuleCatalogId,
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

/** Chris Phone 功能面关键词（对齐 CHRIS_PHONE_FEATURE_MODULES） */
export const CHRIS_PHONE_MODULE_HINTS: ModuleHint[] = [
  {
    module: "对话聊天",
    patterns: [/对话/, /聊天/, /\bchat\b/i, /消息/, /session/i, /companion/i],
  },
  {
    module: "相册图库",
    patterns: [/相册/, /图库/, /gallery/i, /album/i, /\bimage\b/i, /照片/, /图片过期/, /三层/],
  },
  {
    module: "浏览器",
    patterns: [/浏览器/, /browse/i, /browser/i, /intention.?gate/i, /clone.?ui/i],
  },
  {
    module: "口袋文件",
    patterns: [/口袋/, /文件/, /pocket/i, /\bfiles?\b/i, /资料夹/],
  },
  {
    module: "日记心情",
    patterns: [/日记/, /心情/, /diary/i, /\bmood\b/i, /year.?mood/i, /sealed/i],
  },
  {
    module: "指令命令",
    patterns: [/指令/, /命令/, /command/i, /float/i, /proactive/i, /action.?chip/i, /云.?SSE/i],
  },
  {
    module: "推送通知",
    patterns: [/推送/, /通知/, /\bpush\b/i, /VAPID/i, /web.?push/i, /resubscribe/i, /订阅/],
  },
  {
    module: "记忆星座",
    patterns: [/记忆/, /星座/, /memory/i, /constellation/i, /desire/i, /欲望/],
  },
  {
    module: "OpenCLI",
    patterns: [/OpenCLI/i, /opencli/i, /gateway/i, /autostart/i, /diagnose/i],
  },
  {
    module: "系统壳",
    patterns: [/系统壳/, /壳/, /terminal/i, /countdown/i, /\bcat\b/i, /thinking/i, /bulb/i, /ombre/i],
  },
];

/** 通用项目关键词（横切标签，仅作兜底） */
export const GENERIC_MODULE_HINTS: ModuleHint[] = [
  { module: "产品", patterns: [/产品/, /定位/, /需求/, /PRD/, /用户/] },
  { module: "体验", patterns: [/体验/, /UI/, /交互/, /视觉/, /设计/] },
  { module: "技术", patterns: [/技术/, /架构/, /接口/, /API/, /性能/, /重构/] },
  { module: "交付", patterns: [/交付/, /发版/, /上线/, /部署/, /Release/, /验收/] },
];

function hintsForCatalog(catalog: ModuleCatalogId): ModuleHint[] {
  if (catalog === "star-pm") return STAR_PM_MODULE_HINTS;
  if (catalog === "chris-phone") return CHRIS_PHONE_MODULE_HINTS;
  return GENERIC_MODULE_HINTS;
}

function hintsForProject(
  projectId: string | null | undefined,
  githubRepo?: string | null
): ModuleHint[] {
  return hintsForCatalog(detectModuleCatalog(projectId, githubRepo));
}

/**
 * 从文本推断最匹配的一个板块；无命中返回 null。
 * @param allowed 若传入，只在允许列表内选
 */
export function inferModuleFromText(
  text: string,
  opts?: {
    projectId?: string | null;
    githubRepo?: string | null;
    allowed?: string[] | null;
  }
): string | null {
  const raw = (text ?? "").trim();
  if (!raw) return null;

  const hints = hintsForProject(opts?.projectId, opts?.githubRepo);
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

  // 自定义板块名：文案里直接出现板块名也算命中
  if (allowed.length > 0) {
    for (const m of allowed) {
      if (m.length >= 2 && raw.includes(m)) {
        const score = 10;
        if (!best || score > best.score) best = { module: m, score };
      }
    }
  }

  return best?.module ?? null;
}

/** 推断可能命中的多个板块（发版汇总用） */
export function inferModulesFromText(
  text: string,
  opts?: {
    projectId?: string | null;
    githubRepo?: string | null;
    allowed?: string[] | null;
  }
): string[] {
  const raw = (text ?? "").trim();
  if (!raw) return [];
  const hints = hintsForProject(opts?.projectId, opts?.githubRepo);
  const allowed = (opts?.allowed ?? []).map((m) => m.trim()).filter(Boolean);
  const allowSet = allowed.length > 0 ? new Set(allowed) : null;
  const hit: string[] = [];
  for (const hint of hints) {
    if (allowSet && !allowSet.has(hint.module)) continue;
    if (hint.patterns.some((p) => p.test(raw))) hit.push(hint.module);
  }
  if (allowed.length > 0) {
    for (const m of allowed) {
      if (m.length >= 2 && raw.includes(m) && !hit.includes(m)) hit.push(m);
    }
  }
  return hit;
}

/** 写入前：有显式板块用显式；否则按关键词推断；仍无则返回空串 */
export function resolveModuleForImport(
  explicit: string | null | undefined,
  text: string,
  projectId?: string | null,
  opts?: {
    featureModules?: string[] | null;
    githubRepo?: string | null;
  }
): { module: string; inferred: boolean } {
  const given = (explicit ?? "").trim();
  if (given) return { module: given, inferred: false };
  const allowed = resolveFeatureModules(
    projectId ?? "",
    opts?.featureModules,
    opts?.githubRepo
  );
  const inferred = inferModuleFromText(text, {
    projectId,
    githubRepo: opts?.githubRepo,
    allowed,
  });
  return { module: inferred ?? "", inferred: Boolean(inferred) };
}

export function defaultModulesCatalog(
  projectId?: string | null,
  githubRepo?: string | null
): string[] {
  return resolveFeatureModules(projectId ?? "", null, githubRepo);
}

/** 测试/文档用：暴露各目录名单 */
export const CATALOG_MODULE_LISTS = {
  "star-pm": DEFAULT_FEATURE_MODULES,
  "chris-phone": CHRIS_PHONE_FEATURE_MODULES,
  generic: GENERIC_FEATURE_MODULES,
} as const;
