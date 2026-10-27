import type { LinkedViewSourceId } from "./config";

/** 名称写法：只作提示，不强制写成真实标题 */
export type TitleHint = {
  placeholder: string;
  caption: string;
  example: string;
  /** 新建时预填（可空）；知识点 / 竞品不加模块前缀 */
  draftTitle: string;
};

const SPEC: Record<
  LinkedViewSourceId,
  { pattern: string; example: string; prefixModule: boolean }
> = {
  bug: {
    pattern: "[模块] 问题现象 + 关键条件",
    example: "[设置-网络] 链路聚合配置缺少防错校验",
    prefixModule: true,
  },
  requirement: {
    pattern: "[模块] 用户目标 / 需要实现的能力",
    example: "[文件管理] 支持批量上传文件",
    prefixModule: true,
  },
  optimization: {
    pattern: "[模块] 优化对象 + 改进方向",
    example: "[文件管理] 优化文件搜索结果的定位与反馈",
    prefixModule: true,
  },
  prd: {
    pattern: "PRD-模块-功能名称",
    example: "PRD-文件管理-文件复制与移动",
    prefixModule: true,
  },
  learning: {
    pattern: "技术概念 / 原理 / 机制",
    example: "SMB 协议与文件共享机制",
    prefixModule: false,
  },
  competitor: {
    pattern: "研究对象｜对比主题 / 场景",
    example: "群晖 Photos｜人物识别与照片整理",
    prefixModule: false,
  },
};

function withModule(pattern: string, moduleName: string): string {
  const m = moduleName.trim();
  if (!m) return pattern;
  return pattern.replace("模块", m);
}

export function linkedViewTitleHint(
  source: LinkedViewSourceId,
  moduleName?: string
): TitleHint {
  const module = (moduleName ?? "").trim();
  const spec = SPEC[source];
  const placeholder = spec.prefixModule ? withModule(spec.pattern, module) : spec.pattern;

  let draftTitle = "";
  if (source === "prd") {
    draftTitle = module ? `PRD-${module}-` : "PRD-";
  } else if (spec.prefixModule && module) {
    draftTitle = `[${module}] `;
  }

  const extra =
    source === "learning"
      ? "知识点可能被多模块共用，用关联模块挂关系，不要重复建。"
      : source === "requirement"
        ? "写用户需要什么、产品要实现什么，不要提前写死方案。一级模块自动进标题；二级分区自己加，不硬塞。"
        : source === "optimization"
          ? "写改进机会；不一定已确认是 Bug，也不一定已排期。一级自动带前缀，二级可自加。"
          : source === "prd"
            ? "正式文档名宜稳定。覆盖多模块时按文档范围命名，不必强行归到单模块。"
            : source === "competitor"
              ? "一眼看出研究了谁、研究什么，不要都写成 [竞品分析]。"
              : "功能模块填一级（如「设置」）。功能分区填二级（如「网络」），可自加进标题，不会硬塞。";

  return {
    placeholder,
    example: spec.example,
    draftTitle,
    caption: [`命名：${placeholder}`, `例：${spec.example}`, extra]
      .filter(Boolean)
      .join("\n"),
  };
}

export type TitleKind =
  | LinkedViewSourceId
  | "bug"
  | "requirement"
  | "prd"
  | "learning"
  | "competitor";

export function titleUsesModulePrefix(kind: TitleKind): boolean {
  return kind === "bug" || kind === "requirement" || kind === "prd" || kind === "optimization";
}

export function parseTitleModulePrefix(
  kind: TitleKind,
  title: string
): { l1: string; l2: string; rest: string } {
  let raw = (title ?? "").trim();
  if (raw === "无标题") raw = "";
  if (kind === "prd") {
    const m = raw.match(/^PRD-(.*)$/);
    if (!m) return { l1: "", l2: "", rest: raw };
    const body = m[1] ?? "";
    const dash = body.indexOf("-");
    if (dash < 0) return { l1: body.trim(), l2: "", rest: "" };
    return {
      l1: body.slice(0, dash).trim(),
      l2: "",
      rest: body.slice(dash + 1).trim(),
    };
  }
  const m = raw.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (!m) return { l1: "", l2: "", rest: raw };
  const segs = (m[1] ?? "")
    .split("-")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    l1: segs[0] ?? "",
    l2: segs.slice(1).join("-"),
    rest: (m[2] ?? "").trim(),
  };
}

function formatPrefix(kind: TitleKind, l1: string, l2: string, rest: string): string {
  if (kind === "prd") {
    if (!l1) return rest ? `PRD-${rest}` : "PRD-";
    return rest ? `PRD-${l1}-${rest}` : `PRD-${l1}-`;
  }
  if (!l1) return rest;
  const inner = l2 ? `${l1}-${l2}` : l1;
  const prefix = `[${inner}]`;
  return rest ? `${prefix} ${rest}` : `${prefix} `;
}

/**
 * 选了一级模块后写进标题前缀。
 * 若标题里用户已经写成 [设置-网络]，只换一级，保留二级；不会把分区硬塞进标题。
 */
export function applyModuleToTitle(
  kind: TitleKind,
  title: string,
  moduleName: string
): string {
  if (!titleUsesModulePrefix(kind)) return title;
  const parsed = parseTitleModulePrefix(kind, title);
  const l1 = moduleName.trim();
  if (!l1) return parsed.rest;
  return formatPrefix(kind, l1, parsed.l2, parsed.rest);
}

/** 用户自己填了（或清空了）二级分区时，才改标题里的二级；不会从模块树硬塞。 */
export function applyPartitionToTitle(
  kind: TitleKind,
  title: string,
  l1: string,
  l2: string
): string {
  if (!titleUsesModulePrefix(kind)) return title;
  const parsed = parseTitleModulePrefix(kind, title);
  const a = l1.trim() || parsed.l1;
  if (!a) return parsed.rest;
  return formatPrefix(kind, a, l2.trim(), parsed.rest);
}

export function applyTitleHintToRow<
  T extends {
    cells?: Record<string, string>;
    titlePlaceholder?: string;
    titleHint?: string;
  },
>(row: T, source: LinkedViewSourceId): T {
  const hint = linkedViewTitleHint(source, row.cells?.module);
  return {
    ...row,
    titlePlaceholder: hint.placeholder,
    titleHint: hint.caption,
  };
}
