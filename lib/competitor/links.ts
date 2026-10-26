/**
 * 竞品分析枢纽外链配置。
 *
 * 映射（已对齐产品口径）：
 * - 市场竞品分析 → competitive_analysis（正式 CF：competition.starry-studio.cn）
 * - 功能竞品分析 → NAS 竞品学习地图（离线 HTML，竞品板块）
 *
 * 可用环境变量 NEXT_PUBLIC_COMPETITIVE_ANALYSIS_URL 覆盖；勿把临时 Vercel demo 写成正式地址。
 */

/** 正式市场工具链（CF）。可用 env 覆盖。 */
export const MARKET_COMPETITOR_FORMAL_URL =
  process.env.NEXT_PUBLIC_COMPETITIVE_ANALYSIS_URL?.trim() ||
  "https://competition.starry-studio.cn";

/**
 * 临时预览（非正式）。仅在正式链为空时作为「可试用」次要入口展示。
 * 正式链配置后，UI 不再强调此地址。
 */
export const MARKET_COMPETITOR_PREVIEW_URL =
  "https://competitive-analysis-five.vercel.app/";

export const MARKET_COMPETITOR_LINK_STATUS = MARKET_COMPETITOR_FORMAL_URL
  ? ("formal" as const)
  : ("pending_formal" as const);

/** 功能竞品：站内静态离线学习地图 */
export const FEATURE_COMPETITOR_MAP_PATH = "/competitor-maps/nas-offline.html";

/** 功能页默认锚定到能力地图（含深度对照） */
export const FEATURE_COMPETITOR_DEFAULT_HASH = "ability-map";

export const FEATURE_COMPETITOR_SECTION_LINKS = [
  { hash: "framework", label: "竞品分层" },
  { hash: "ability-map", label: "能力地图 / 对照" },
  { hash: "landscape", label: "品牌资料" },
  { hash: "prices", label: "价格成本" },
  { hash: "learning-pool", label: "地图内学习池" },
] as const;
