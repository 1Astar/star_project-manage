import type {
  Bug,
  CompetitorEntry,
  ModuleNode,
  ProjectLearningNote,
  Requirement,
} from "@/lib/types";
import type { OverviewThumbnail } from "@/lib/overview/thumbnails";

export type OverviewRowType =
  | "知识点"
  | "Bug"
  | "优化建议"
  | "需求"
  | "竞品"
  | "聊天参考";

/** 六类筛选（聊天参考本期仅入口，库内尚无独立条目） */
export type OverviewFilterType = OverviewRowType;

export type OverviewMatrixRow = {
  id: string;
  section: string;
  rowType: OverviewRowType;
  title: string;
  summary: string;
  /** 侧栏编辑用 */
  peekKind: "learning" | "bug" | "competitor" | "requirement";
  entityId: string;
  href: string;
  badge?: string;
  /** 附图缩略图（最多 2） */
  thumbnails?: OverviewThumbnail[];
  /** 附图总数（含未展示） */
  attachmentCount?: number;
  fields: Array<{
    key: string;
    label: string;
    value: string;
    multiline?: boolean;
  }>;
  updatedAt: string;
};

const TYPE_ORDER: OverviewRowType[] = [
  "Bug",
  "需求",
  "优化建议",
  "知识点",
  "竞品",
  "聊天参考",
];

/** 调研工作台六类卡片顺序（对齐示意图） */
export const OVERVIEW_TYPE_CARDS: OverviewFilterType[] = [
  "Bug",
  "需求",
  "优化建议",
  "知识点",
  "竞品",
  "聊天参考",
];

export function sectionFromModulePath(path: string | null | undefined): string {
  const raw = (path ?? "").trim();
  if (!raw) return "未分板块";
  return raw.split(/[>/·\-|／]/)[0]?.trim() || "未分板块";
}

export function isOptimizationBug(b: Bug): boolean {
  const sug = (b.suggestion ?? "").trim();
  if (!sug) return false;
  if (/来自优化表/.test(b.description ?? "")) return true;
  return !(b.repro_steps ?? "").trim();
}

function reqModuleSection(
  req: Requirement,
  modulesById: Map<string, ModuleNode>
): string {
  const leafId = req.module_l2_id || req.module_l1_id;
  if (!leafId) return "未分板块";
  const leaf = modulesById.get(leafId);
  if (!leaf) return "未分板块";
  let cur: ModuleNode | undefined = leaf;
  for (let i = 0; i < 8 && cur; i++) {
    if (!cur.parent_id) return cur.name.trim() || "未分板块";
    cur = modulesById.get(cur.parent_id);
  }
  return leaf.name.trim() || "未分板块";
}

export function buildOverviewMatrixRows(input: {
  routeId: string;
  learnings: ProjectLearningNote[];
  bugs: Bug[];
  competitors: CompetitorEntry[];
  requirements: Requirement[];
  /** 用于需求行解析板块名 */
  modules?: ModuleNode[];
  /** entityId → 附图（学习 note_id / bug_id / requirement_id） */
  thumbsByEntityId?: Map<string, OverviewThumbnail[]>;
  /** entityId → 附图总数 */
  attachmentCountByEntityId?: Map<string, number>;
}): OverviewMatrixRow[] {
  const { routeId, learnings, bugs, competitors, requirements } = input;
  const byId = new Map(learnings.map((n) => [n.id, n]));
  const modulesById = new Map((input.modules ?? []).map((m) => [m.id, m]));
  const thumbs = input.thumbsByEntityId ?? new Map();
  const attachCounts = input.attachmentCountByEntityId ?? new Map();
  const sectionTitle = (n: ProjectLearningNote): string => {
    if (n.kind === "section") return n.title || "未分板块";
    let cur: ProjectLearningNote | undefined = n;
    for (let i = 0; i < 4 && cur; i++) {
      if (cur.kind === "section") return cur.title || "未分板块";
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    }
    return "未分板块";
  };

  const rows: OverviewMatrixRow[] = [];

  for (const n of learnings) {
    if (n.kind === "section") continue;
    const summary = [n.principle, n.why_text, n.product_thinking]
      .map((s) => (s ?? "").trim())
      .filter(Boolean)
      .join("\n")
      .slice(0, 200);
    rows.push({
      id: `learning:${n.id}`,
      section: sectionTitle(n),
      rowType: "知识点",
      title: n.title,
      summary,
      peekKind: "learning",
      entityId: n.id,
      href: `/projects/${routeId}/learning`,
      badge: n.kind === "point" ? "子知识" : "主题",
      thumbnails: thumbs.get(n.id),
      attachmentCount: attachCounts.get(n.id),
      fields: [
        { key: "why_text", label: "为什么", value: n.why_text ?? "", multiline: true },
        { key: "principle", label: "原理 / 要点", value: n.principle ?? "", multiline: true },
        { key: "protocol", label: "协议", value: n.protocol ?? "", multiline: true },
        {
          key: "tech_background",
          label: "技术背景",
          value: n.tech_background ?? "",
          multiline: true,
        },
        {
          key: "product_thinking",
          label: "产品思考",
          value: n.product_thinking ?? "",
          multiline: true,
        },
      ],
      updatedAt: n.updated_at,
    });
  }

  for (const b of bugs) {
    const opt = isOptimizationBug(b);
    const summary = opt
      ? (b.suggestion ?? "").slice(0, 200)
      : [b.actual_result, b.description, b.suggestion]
          .map((s) => (s ?? "").trim())
          .filter(Boolean)
          .join("\n")
          .slice(0, 200);
    rows.push({
      id: `bug:${b.id}`,
      section: sectionFromModulePath(b.module_path),
      rowType: opt ? "优化建议" : "Bug",
      title: b.title,
      summary,
      peekKind: "bug",
      entityId: b.id,
      href: `/projects/${routeId}/bugs/${b.id}`,
      badge: opt ? "优化" : undefined,
      thumbnails: thumbs.get(b.id),
      attachmentCount: attachCounts.get(b.id),
      fields: [
        {
          key: "repro_steps",
          label: "操作步骤",
          value: b.repro_steps ?? "",
          multiline: true,
        },
        {
          key: "expected_result",
          label: "预期",
          value: b.expected_result ?? "",
          multiline: true,
        },
        {
          key: "actual_result",
          label: "实际 / 现状",
          value: b.actual_result ?? "",
          multiline: true,
        },
        {
          key: "description",
          label: "描述 / 证据",
          value: b.description ?? "",
          multiline: true,
        },
        {
          key: "suggestion",
          label: "优化建议",
          value: b.suggestion ?? "",
          multiline: true,
        },
        {
          key: "module_path",
          label: "板块 / 模块",
          value: b.module_path ?? "",
        },
      ],
      updatedAt: b.updated_at,
    });
  }

  for (const r of requirements) {
    if (!r.title?.trim()) continue;
    const summary = [r.detail_work, r.acceptance_criteria]
      .map((s) => (s ?? "").trim())
      .filter(Boolean)
      .join("\n")
      .slice(0, 200);
    rows.push({
      id: `req:${r.id}`,
      section: reqModuleSection(r, modulesById),
      rowType: "需求",
      title: r.title,
      summary,
      peekKind: "requirement",
      entityId: r.id,
      href: `/projects/${routeId}/requirements/${r.id}`,
      badge: r.in_pool ? "池" : "上板",
      thumbnails: thumbs.get(r.id),
      attachmentCount: attachCounts.get(r.id),
      fields: [
        {
          key: "detail_work",
          label: "详情",
          value: r.detail_work ?? "",
          multiline: true,
        },
        {
          key: "acceptance_criteria",
          label: "验收",
          value: r.acceptance_criteria ?? "",
          multiline: true,
        },
        { key: "priority", label: "优先级", value: r.priority ?? "" },
      ],
      updatedAt: r.updated_at,
    });
  }

  for (const c of competitors) {
    rows.push({
      id: `comp:${c.id}`,
      section: sectionFromModulePath(c.module_path),
      rowType: "竞品",
      title: c.title,
      summary: (c.summary ?? "").slice(0, 200),
      peekKind: "competitor",
      entityId: c.id,
      href: `/projects/${routeId}/competitors`,
      fields: [
        { key: "summary", label: "摘要", value: c.summary ?? "", multiline: true },
        { key: "url", label: "外链", value: c.url ?? "" },
        { key: "module_path", label: "板块 / 模块", value: c.module_path ?? "" },
      ],
      updatedAt: c.updated_at,
    });
  }

  rows.sort((a, b) => {
    const sec = a.section.localeCompare(b.section, "zh");
    if (sec !== 0) return sec;
    const ta = TYPE_ORDER.indexOf(a.rowType);
    const tb = TYPE_ORDER.indexOf(b.rowType);
    if (ta !== tb) return ta - tb;
    return a.title.localeCompare(b.title, "zh");
  });

  return rows;
}

export const OVERVIEW_TYPE_FILTERS: Array<OverviewFilterType | "全部"> = [
  "全部",
  ...OVERVIEW_TYPE_CARDS,
];
