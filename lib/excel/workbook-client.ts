/**
 * 客户端可安全导入的工作簿类型 / 网格列定义。
 * 禁止依赖 local-store / next/headers 等服务端模块。
 */

export type BundleSheetKind =
  | "learning"
  | "competitor"
  | "requirement"
  | "bug"
  | "optimization";

export type BundleConflictItem = {
  key: string;
  kind: BundleSheetKind;
  title: string;
  sheetName: string;
  action: "create" | "update";
  existingId?: string;
  match?: "title" | "similar";
  similarToTitle?: string;
  score?: number;
  selected: boolean;
};

export type BundlePreview = {
  sheets: Array<{
    sheetName: string;
    kind: BundleSheetKind;
    rows: unknown[];
    ignored: boolean;
    note?: string;
  }>;
  summary: {
    learning: number;
    competitor: number;
    requirement: number;
    bug: number;
    optimization: number;
    linkHints: number;
    unmatchedLinkHints: string[];
    creates: number;
    updates: number;
    embeddedImages: number;
  };
  conflicts?: BundleConflictItem[];
};

export type BundleCommitResult = {
  created: {
    learning: number;
    competitor: number;
    requirement: number;
    bug: number;
    optimization: number;
  };
  updated: {
    learning: number;
    competitor: number;
    requirement: number;
    bug: number;
    optimization: number;
  };
  linksApplied: number;
  pendingLinks: string[];
  /** 本次挂上的内嵌图张数 */
  imagesAttached: number;
};

export type GridColumnKey = string;

export type GridSheetDef = {
  kind: Exclude<BundleSheetKind, "optimization">;
  sheetName: string;
  columns: Array<{ key: GridColumnKey; label: string; width?: string }>;
};

export const WORKBOOK_GRID_SHEETS: GridSheetDef[] = [
  {
    kind: "learning",
    sheetName: "学习",
    columns: [
      { key: "section_title", label: "板块", width: "7rem" },
      { key: "topic_title", label: "主题", width: "9rem" },
      { key: "point_title", label: "子知识点", width: "9rem" },
      { key: "title", label: "标题(兼容)", width: "8rem" },
      { key: "why_text", label: "为什么", width: "10rem" },
      { key: "principle", label: "原理", width: "10rem" },
      { key: "protocol", label: "协议", width: "8rem" },
      { key: "tech_background", label: "技术背景", width: "8rem" },
      { key: "competitors", label: "竞品说明", width: "8rem" },
      { key: "product_thinking", label: "产品思考", width: "8rem" },
      { key: "link_requirements", label: "关联需求", width: "9rem" },
      { key: "link_competitors", label: "关联竞品", width: "8rem" },
      { key: "link_bugs", label: "关联Bug", width: "8rem" },
      { key: "url", label: "外链", width: "10rem" },
    ],
  },
  {
    kind: "competitor",
    sheetName: "竞品",
    columns: [
      { key: "title", label: "标题", width: "9rem" },
      { key: "summary", label: "摘要", width: "12rem" },
      { key: "url", label: "外链", width: "10rem" },
      { key: "module_path", label: "功能模块", width: "7rem" },
      { key: "link_learning", label: "关联学习", width: "9rem" },
      { key: "link_requirements", label: "关联需求", width: "9rem" },
      { key: "link_bugs", label: "关联Bug", width: "8rem" },
    ],
  },
  {
    kind: "requirement",
    sheetName: "需求",
    columns: [
      { key: "title", label: "标题", width: "10rem" },
      { key: "detail_work", label: "详情", width: "12rem" },
      { key: "acceptance_criteria", label: "验收", width: "10rem" },
      { key: "priority", label: "优先级", width: "5rem" },
      { key: "module_path", label: "功能模块", width: "7rem" },
      { key: "link_learning", label: "关联学习", width: "9rem" },
      { key: "link_competitors", label: "关联竞品", width: "8rem" },
      { key: "link_bugs", label: "关联Bug", width: "8rem" },
    ],
  },
  {
    kind: "bug",
    sheetName: "Bug",
    columns: [
      { key: "title", label: "问题标题", width: "10rem" },
      { key: "module_path", label: "功能模块", width: "7rem" },
      { key: "repro_steps", label: "操作步骤", width: "10rem" },
      { key: "expected_result", label: "预期", width: "8rem" },
      { key: "actual_result", label: "实际", width: "8rem" },
      { key: "evidence", label: "证据", width: "8rem" },
      { key: "status", label: "状态", width: "5rem" },
      { key: "link_learning", label: "关联学习", width: "9rem" },
      { key: "link_competitors", label: "关联竞品", width: "8rem" },
      { key: "link_requirements", label: "关联需求", width: "9rem" },
      { key: "url", label: "外链", width: "10rem" },
    ],
  },
];

export type GridRow = Record<string, string>;

export type WorkbookGridState = {
  sheets: Array<{
    kind: GridSheetDef["kind"];
    sheetName: string;
    rows: GridRow[];
  }>;
};

export function emptyGridRow(kind: GridSheetDef["kind"]): GridRow {
  const def = WORKBOOK_GRID_SHEETS.find((s) => s.kind === kind)!;
  const row: GridRow = {};
  for (const col of def.columns) row[col.key] = "";
  return row;
}
