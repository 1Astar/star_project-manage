/**
 * 总表多 Sheet：学习 / 竞品 / 需求 / Bug
 * 关联列可选；按标题匹配；http(s) 作外链。
 */
import ExcelJS from "exceljs";
import {
  createBug,
  createPoolRequirement,
  getProjectById,
  listBugsByProject,
  updateBug,
} from "@/lib/db/local-store";
import {
  createCompetitorEntry,
  listCompetitorEntries,
  updateCompetitorEntry,
} from "@/lib/competitors/store";
import {
  createProjectLearningNote,
  listProjectLearningNotes,
  updateProjectLearningNote,
} from "@/lib/learning-notes/store";
import type { TaskStatus } from "@/lib/types";
import {
  CONTENT_SIMILARITY_THRESHOLD,
  contentSimilarity,
  joinContentParts,
} from "@/lib/excel/text-similarity";
import {
  WORKBOOK_GRID_SHEETS,
  emptyGridRow,
  type BundleSheetKind,
  type GridRow,
  type GridSheetDef,
  type WorkbookGridState,
} from "@/lib/excel/workbook-client";

export type { BundleSheetKind, GridRow, GridSheetDef, WorkbookGridState };
export { WORKBOOK_GRID_SHEETS, emptyGridRow };

export type BundleLinkRefs = {
  learningTitles: string[];
  competitorTitles: string[];
  requirementTitles: string[];
  bugTitles: string[];
  urls: string[];
};

export type BundleRowBase = {
  title: string;
  links: BundleLinkRefs;
  warnings: string[];
  /** Excel 行号（1-based，含表头时数据从 2 起） */
  sourceRow: number;
};

export type LearningBundleRow = BundleRowBase & {
  kind: "learning";
  /** 板块名 → section */
  section_title: string | null;
  /**
   * 主题名 → topic。
   * 有 point_title 时：板块→主题→子知识点；
   * 无 point_title 时：主题即叶子（建成 topic，兼容旧表）。
   */
  topic_title: string | null;
  /** 子知识点标题；空则不建第三级 */
  point_title: string | null;
  why_text: string;
  principle: string;
  protocol: string;
  tech_background: string;
  competitors: string;
  product_thinking: string;
  /** 出处（写入 why 或附加） */
  source: string;
};

export type OptimizationBundleRow = BundleRowBase & {
  kind: "optimization";
  /** 挂到哪个学习板块（按标题匹配） */
  section_title: string;
  detail: string;
  benefit: string;
  source: string;
};

export type CompetitorBundleRow = BundleRowBase & {
  kind: "competitor";
  summary: string;
  url: string | null;
  module_path: string | null;
};

export type RequirementBundleRow = BundleRowBase & {
  kind: "requirement";
  detail_work: string;
  acceptance_criteria: string;
  priority: string | null;
  module_path: string | null;
};

export type BugBundleRow = BundleRowBase & {
  kind: "bug";
  module_path: string | null;
  repro_steps: string;
  expected_result: string;
  actual_result: string;
  evidence: string;
  status: string | null;
};

export type BundleParsedRow =
  | LearningBundleRow
  | CompetitorBundleRow
  | RequirementBundleRow
  | BugBundleRow
  | OptimizationBundleRow;

export type BundleSheetPreview = {
  sheetName: string;
  kind: BundleSheetKind | null;
  rows: BundleParsedRow[];
  ignored: boolean;
  note?: string;
};

/** 再导入冲突：标题匹配（5a）或内容相似（5b）时的替换确认项 */
export type BundleConflictItem = {
  /** kind + 规范化标题，用于勾选 */
  key: string;
  kind: BundleSheetKind;
  title: string;
  sheetName: string;
  action: "create" | "update";
  existingId?: string;
  /** title=标题完全一致；similar=正文/标题相似 */
  match?: "title" | "similar";
  /** 相似时库内原标题（导入标题可能不同） */
  similarToTitle?: string;
  /** 0～1，仅 similar */
  score?: number;
  /** 用户是否写入；更新默认勾选，可取消跳过 */
  selected: boolean;
};

export type BundlePreview = {
  sheets: BundleSheetPreview[];
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
    /** 预览时统计到的内嵌图数量 */
    embeddedImages: number;
  };
  /** 标题匹配冲突清单（5a）；无则视为全部写入 */
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

const SHEET_KIND: Record<string, BundleSheetKind> = {
  学习: "learning",
  学习池: "learning",
  知识: "learning",
  知识表: "learning",
  知识点: "learning",
  learning: "learning",
  竞品: "competitor",
  竞品条目: "competitor",
  competitor: "competitor",
  需求: "requirement",
  需求池: "requirement",
  requirement: "requirement",
  bug: "bug",
  Bug: "bug",
  Bug表: "bug",
  bug表: "bug",
  缺陷: "bug",
  优化: "optimization",
  优化表: "optimization",
  优化建议: "optimization",
  optimization: "optimization",
  /** 总览混合表：按「类型」列拆成 Bug / 优化（见 parseOverviewSheet） */
  总表: "bug",
};

function normHeader(v: unknown): string {
  return String(v ?? "")
    .replace(/\s+/g, "")
    .replace(/（.*?）/g, "")
    .replace(/\(.*?\)/g, "")
    .toLowerCase();
}

function cellText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object" && v !== null && "text" in v) {
    return String((v as { text?: unknown }).text ?? "").trim();
  }
  if (typeof v === "object" && v !== null && "hyperlink" in v) {
    const h = v as { text?: unknown; hyperlink?: unknown };
    return String(h.text ?? h.hyperlink ?? "").trim();
  }
  return String(v).trim();
}

function splitTitles(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw
    .split(/[,，;；|、\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function extractUrls(raw: string): { text: string; urls: string[] } {
  const urls: string[] = [];
  const text = raw.replace(/https?:\/\/[^\s,，;；|]+/gi, (m) => {
    urls.push(m);
    return " ";
  });
  return { text: text.replace(/\s+/g, " ").trim(), urls };
}

function emptyLinks(): BundleLinkRefs {
  return {
    learningTitles: [],
    competitorTitles: [],
    requirementTitles: [],
    bugTitles: [],
    urls: [],
  };
}

function parseLinkColumns(
  get: (keys: string[]) => string
): BundleLinkRefs {
  const links = emptyLinks();
  const learningRaw = get(["关联学习", "关联知识点", "学习", "linklearning"]);
  const competitorRaw = get(["关联竞品", "竞品条目", "linkcompetitor"]);
  const reqRaw = get(["关联需求", "需求", "linkrequirement"]);
  const bugRaw = get(["关联bug", "关联缺陷", "linkbug"]);
  const urlRaw = get(["外链", "链接", "url", "证据链接"]);

  const pushParsed = (raw: string, into: string[]) => {
    const { text, urls } = extractUrls(raw);
    links.urls.push(...urls);
    into.push(...splitTitles(text));
  };

  pushParsed(learningRaw, links.learningTitles);
  pushParsed(competitorRaw, links.competitorTitles);
  pushParsed(reqRaw, links.requirementTitles);
  pushParsed(bugRaw, links.bugTitles);
  const urlOnly = extractUrls(urlRaw);
  links.urls.push(...urlOnly.urls);
  if (urlOnly.text && /^https?:\/\//i.test(urlOnly.text)) {
    links.urls.push(urlOnly.text);
  } else if (urlOnly.text) {
    // plain non-url kept as-is only when whole cell is a url-like leftover
  }
  links.urls = Array.from(new Set(links.urls));
  return links;
}

function detectSheetKind(name: string): BundleSheetKind | null {
  const key = name.trim();
  if (SHEET_KIND[key]) return SHEET_KIND[key];
  const lower = key.toLowerCase();
  for (const [k, v] of Object.entries(SHEET_KIND)) {
    if (k.toLowerCase() === lower) return v;
  }
  return null;
}

function headerMap(sheet: ExcelJS.Worksheet): Map<string, number> {
  const map = new Map<string, number>();
  const row = sheet.getRow(1);
  row.eachCell({ includeEmpty: false }, (cell, col) => {
    const h = normHeader(cell.value);
    if (h) map.set(h, col);
  });
  return map;
}

function colGetter(sheet: ExcelJS.Worksheet, headers: Map<string, number>, row: number) {
  return (keys: string[]) => {
    for (const key of keys) {
      const col = headers.get(normHeader(key));
      if (col) return cellText(sheet.getRow(row).getCell(col).value);
    }
    return "";
  };
}

/**
 * 知识表常见无表头：A 板块 / B 主题 / C 标题 / D 要点 / F 出处
 * （第一行已是数据，不能走 headerMap）
 */
function parseLearningSheetPositional(
  sheet: ExcelJS.Worksheet
): BundleParsedRow[] {
  const rows: BundleParsedRow[] = [];
  const max = sheet.rowCount || 0;
  for (let r = 1; r <= max; r++) {
    const section = cellText(sheet.getRow(r).getCell(1).value);
    const topic = cellText(sheet.getRow(r).getCell(2).value);
    const title = cellText(sheet.getRow(r).getCell(3).value);
    const principle = cellText(sheet.getRow(r).getCell(4).value);
    const source = cellText(sheet.getRow(r).getCell(6).value);
    if (!title && !topic) continue;
    // 跳过误把表头当数据
    if (title === "标题" || topic === "主题" || section === "板块") continue;
    const leaf = title || topic;
    rows.push({
      kind: "learning",
      title: leaf,
      section_title: section || null,
      topic_title: topic || leaf,
      point_title: title && topic && title !== topic ? title : null,
      why_text: source ? `出处：${source}` : "",
      principle,
      protocol: "",
      tech_background: "",
      competitors: "",
      product_thinking: "",
      source,
      links: emptyLinks(),
      warnings: [],
      sourceRow: r,
    });
  }
  return rows;
}

/** 总表：板块 / 类型 / 条目 / 涉及知识点 / 竞品参考 / 出处 */
function parseOverviewSheet(sheet: ExcelJS.Worksheet): BundleParsedRow[] {
  const headers = headerMap(sheet);
  const rows: BundleParsedRow[] = [];
  const max = sheet.rowCount || 0;
  const hasType = headers.has(normHeader("类型"));
  if (!hasType) return rows;

  for (let r = 2; r <= max; r++) {
    const get = colGetter(sheet, headers, r);
    const typeRaw = get(["类型", "type"]);
    const title = get(["条目", "标题", "问题描述", "名称", "title"]);
    if (!title) continue;
    const section = get(["板块", "模块", "section"]) || "未分板块";
    const knowledge = get(["涉及知识点", "知识点"]);
    const competitor = get(["竞品/聊天参考", "竞品参考", "竞品"]);
    const source = get(["出处", "来源", "source"]);
    const links = emptyLinks();
    if (knowledge) links.learningTitles.push(...splitTitles(knowledge));
    if (competitor) {
      const { text, urls } = extractUrls(competitor);
      links.urls.push(...urls);
      if (text) links.competitorTitles.push(...splitTitles(text));
    }

    const typeKey = typeRaw.replace(/\s+/g, "").toLowerCase();
    if (typeKey === "bug" || typeKey === "缺陷") {
      rows.push({
        kind: "bug",
        title,
        module_path: section,
        repro_steps: "",
        expected_result: "",
        actual_result: competitor || "",
        evidence: [knowledge ? `知识点：${knowledge}` : "", source ? `出处：${source}` : ""]
          .filter(Boolean)
          .join("\n"),
        status: null,
        links,
        warnings: [],
        sourceRow: r,
      });
    } else if (
      typeKey === "优化" ||
      typeKey === "优化建议" ||
      typeKey.includes("optim")
    ) {
      rows.push({
        kind: "optimization",
        title,
        section_title: section,
        detail: competitor || knowledge || "",
        benefit: "",
        source,
        links,
        warnings: [],
        sourceRow: r,
      });
    }
  }
  return rows;
}

function parseSheet(
  sheet: ExcelJS.Worksheet,
  kind: BundleSheetKind
): BundleParsedRow[] {
  if (sheet.name.trim() === "总表") {
    return parseOverviewSheet(sheet);
  }

  const headers = headerMap(sheet);
  /** 知识表无表头：第一格是板块名而非「板块」 */
  if (
    kind === "learning" &&
    !headers.has(normHeader("板块")) &&
    !headers.has(normHeader("主题")) &&
    !headers.has(normHeader("标题"))
  ) {
    return parseLearningSheetPositional(sheet);
  }

  const rows: BundleParsedRow[] = [];
  const max = sheet.rowCount || 0;
  for (let r = 2; r <= max; r++) {
    const get = colGetter(sheet, headers, r);
    const links = parseLinkColumns(get);
    const warnings: string[] = [];

    if (kind === "learning") {
      const topicTitle = get([
        "主题",
        "标题",
        "问题标题",
        "名称",
        "title",
        "name",
      ]);
      const pointTitle =
        get(["子知识点", "知识点", "point", "子主题"]) || null;
      /** 冲突匹配 / 展示用叶子标题 */
      const title = pointTitle || topicTitle;
      if (!title) continue;
      const points = get(["知识要点", "要点", "内容", "原理"]);
      const source = get(["出处", "来源", "source"]);
      const why =
        get(["为什么", "why"]) ||
        (source ? `出处：${source}` : "");
      rows.push({
        kind: "learning",
        title,
        section_title: get(["板块", "模块", "section"]) || null,
        topic_title: topicTitle || null,
        point_title: pointTitle,
        why_text: why,
        principle: get(["原理", "principle"]) || points,
        protocol: get(["协议", "protocol"]),
        tech_background: get(["技术背景", "tech"]),
        competitors: get(["竞品说明", "竞品文字", "competitors"]),
        product_thinking: get(["产品思考", "product"]),
        source,
        links,
        warnings,
        sourceRow: r,
      });
    } else if (kind === "optimization") {
      const title = get(["优化建议", "建议", "标题", "title"]);
      if (!title) continue;
      const section = get(["板块", "模块", "section"]);
      if (!section) warnings.push("缺板块，导入时挂到「未分板块」");
      rows.push({
        kind: "optimization",
        title,
        section_title: section || "未分板块",
        detail: get(["优化内容", "内容", "详情", "detail"]),
        benefit: get(["预期收益", "收益", "benefit"]),
        source: get(["出处", "来源", "source"]),
        links,
        warnings,
        sourceRow: r,
      });
    } else if (kind === "competitor") {
      const title = get(["标题", "问题标题", "名称", "title", "name"]);
      if (!title) continue;
      const urlCell = get(["外链", "链接", "url", "官网"]);
      const { text: urlText, urls } = extractUrls(urlCell);
      const url = urls[0] ?? ( /^https?:\/\//i.test(urlText) ? urlText : null);
      if (urls.length) links.urls.push(...urls);
      rows.push({
        kind: "competitor",
        title,
        summary: get(["摘要", "说明", "summary", "描述"]),
        url,
        module_path: get(["功能模块", "模块", "板块", "module"]) || null,
        links,
        warnings,
        sourceRow: r,
      });
    } else if (kind === "requirement") {
      const title = get(["标题", "问题标题", "名称", "title", "name"]);
      if (!title) continue;
      rows.push({
        kind: "requirement",
        title,
        detail_work: get(["详情", "描述", "detail", "detail_work"]),
        acceptance_criteria: get(["验收", "验收标准", "acceptance"]),
        priority: get(["优先级", "priority"]) || null,
        module_path: get(["功能模块", "模块", "板块", "module"]) || null,
        links,
        warnings,
        sourceRow: r,
      });
    } else {
      // bug：兼容 Bug表「问题描述 / 现状 / 影响 / 板块 / 出处」
      const title = get([
        "问题描述",
        "标题",
        "问题标题",
        "名称",
        "title",
        "name",
      ]);
      if (!title) continue;
      const statusQuo = get(["现状", "实际", "实际结果", "actual"]);
      const impact = get(["影响", "impact"]);
      const source = get(["出处", "来源", "source"]);
      const evidenceParts = [
        get(["证据", "截图", "日志", "evidence"]),
        impact ? `影响：${impact}` : "",
        source ? `出处：${source}` : "",
      ].filter(Boolean);
      rows.push({
        kind: "bug",
        title,
        module_path:
          get(["功能模块", "模块", "板块", "module"]) || null,
        repro_steps: get(["操作步骤", "复现步骤", "steps", "repro"]),
        expected_result: get(["预期", "预期结果", "expected"]),
        actual_result: statusQuo || get(["实际", "实际结果", "actual"]),
        evidence: evidenceParts.join("\n"),
        status: get(["状态", "status"]) || null,
        links,
        warnings,
        sourceRow: r,
      });
    }
  }
  return rows;
}

export async function parseWorkbookBundle(
  buffer: ArrayBuffer
): Promise<BundlePreview> {
  const wb = new ExcelJS.Workbook();
  // exceljs typings vs Node Buffer mismatch — runtime accepts Uint8Array
  await wb.xlsx.load(Buffer.from(buffer) as never);
  const sheets: BundleSheetPreview[] = [];

  for (const sheet of wb.worksheets) {
    const kind = detectSheetKind(sheet.name);
    if (!kind) {
      sheets.push({
        sheetName: sheet.name,
        kind: null,
        rows: [],
        ignored: true,
        note: "未识别为 知识/学习/竞品/需求/Bug/优化，已跳过",
      });
      continue;
    }
    sheets.push({
      sheetName: sheet.name,
      kind,
      rows: parseSheet(sheet, kind),
      ignored: false,
    });
  }

  const summary = {
    learning: 0,
    competitor: 0,
    requirement: 0,
    bug: 0,
    optimization: 0,
    linkHints: 0,
    unmatchedLinkHints: [] as string[],
    creates: 0,
    updates: 0,
    embeddedImages: countWorkbookEmbeddedImages(wb),
  };
  for (const s of sheets) {
    if (!s.kind) continue;
    summary[s.kind] += s.rows.length;
    for (const row of s.rows) {
      const n =
        row.links.learningTitles.length +
        row.links.competitorTitles.length +
        row.links.requirementTitles.length +
        row.links.bugTitles.length;
      summary.linkHints += n;
    }
  }

  return { sheets, summary, conflicts: [] };
}

function mimeFromExt(ext: string): string {
  const e = ext.toLowerCase().replace(/^\./, "");
  if (e === "jpg" || e === "jpeg") return "image/jpeg";
  if (e === "png") return "image/png";
  if (e === "gif") return "image/gif";
  if (e === "webp") return "image/webp";
  if (e === "bmp") return "image/bmp";
  return "application/octet-stream";
}

function countWorkbookEmbeddedImages(wb: ExcelJS.Workbook): number {
  let n = 0;
  for (const sheet of wb.worksheets) {
    try {
      n += sheet.getImages()?.length ?? 0;
    } catch {
      /* ignore */
    }
  }
  return n;
}

type SheetRowImage = {
  sheetName: string;
  /** Excel 1-based row */
  row: number;
  extension: string;
  buffer: Buffer;
};

/** 按 Sheet 名 + 行号收集内嵌图（nativeRow 为 0-based） */
function collectEmbeddedImagesByRow(
  wb: ExcelJS.Workbook
): Map<string, SheetRowImage[]> {
  const map = new Map<string, SheetRowImage[]>();
  for (const sheet of wb.worksheets) {
    let images: ReturnType<ExcelJS.Worksheet["getImages"]> = [];
    try {
      images = sheet.getImages() ?? [];
    } catch {
      continue;
    }
    for (const img of images) {
      const nativeRow = img.range?.tl?.nativeRow;
      if (nativeRow == null || Number.isNaN(Number(nativeRow))) continue;
      const row = Math.floor(Number(nativeRow)) + 1;
      let media: { extension?: string; buffer?: Buffer } | null = null;
      try {
        media = wb.getImage(Number(img.imageId)) as {
          extension?: string;
          buffer?: Buffer;
        };
      } catch {
        media = null;
      }
      if (!media?.buffer || !media.buffer.length) continue;
      const extension = (media.extension || "jpeg").replace(/^\./, "");
      const key = `${sheet.name}::${row}`;
      const list = map.get(key) ?? [];
      list.push({
        sheetName: sheet.name,
        row,
        extension,
        buffer: Buffer.from(media.buffer),
      });
      map.set(key, list);
    }
  }
  return map;
}

function conflictKey(kind: BundleSheetKind, title: string) {
  return `${kind}:${titleKey(title)}`;
}

type SimilarCandidate = {
  id: string;
  title: string;
  content: string;
};

function rowImportContent(row: BundleParsedRow): string {
  if (row.kind === "learning") {
    return joinContentParts([
      row.why_text,
      row.principle,
      row.protocol,
      row.tech_background,
      row.competitors,
      row.product_thinking,
      row.source,
    ]);
  }
  if (row.kind === "competitor") return joinContentParts([row.summary]);
  if (row.kind === "requirement") {
    return joinContentParts([row.detail_work, row.acceptance_criteria]);
  }
  if (row.kind === "bug") {
    return joinContentParts([
      row.repro_steps,
      row.expected_result,
      row.actual_result,
      row.evidence,
    ]);
  }
  return joinContentParts([row.detail, row.benefit, row.source]);
}

function findBestSimilar(
  title: string,
  content: string,
  candidates: SimilarCandidate[],
  claimedIds: Set<string>
): { id: string; title: string; score: number } | null {
  let best: { id: string; title: string; score: number } | null = null;
  for (const c of candidates) {
    if (claimedIds.has(c.id)) continue;
    const score = contentSimilarity(title, content, c.title, c.content);
    if (score < CONTENT_SIMILARITY_THRESHOLD) continue;
    if (!best || score > best.score) {
      best = { id: c.id, title: c.title, score };
    }
  }
  return best;
}

/**
 * 对照项目现有实体，标出新建 / 标题匹配（5a）/ 内容相似（5b）将更新。
 * 学习按「主题」标题匹配主题或同名知识点；相似匹配同一库内条目只认领一次。
 */
export async function annotateWorkbookConflicts(
  projectIdOrSlug: string,
  preview: BundlePreview
): Promise<BundlePreview> {
  const project = await getProjectById(projectIdOrSlug);
  if (!project) return preview;
  const projectId = project.id;

  const [learnings, competitors, bugs] = await Promise.all([
    listProjectLearningNotes(projectId),
    listCompetitorEntries(projectId),
    listBugsByProject(projectId),
  ]);
  const { getPoolBundle, listProjectRequirementOptions } = await import(
    "@/lib/db/local-store"
  );
  const requirements = await listProjectRequirementOptions(projectId);
  const pool = await getPoolBundle(project.id);
  const fullReqs = pool?.poolRequirements ?? [];

  const learningByTitle = new Map(
    learnings.map((x) => [titleKey(x.title), x.id] as const)
  );
  const competitorByTitle = new Map(
    competitors.map((x) => [titleKey(x.title), x.id] as const)
  );
  const requirementByTitle = new Map(
    requirements.map((x) => [titleKey(x.title), x.id] as const)
  );
  const bugByTitle = new Map(
    bugs.map((x) => [titleKey(x.title), x.id] as const)
  );

  const learningCandidates: SimilarCandidate[] = learnings
    .filter((n) => n.kind !== "section")
    .map((n) => ({
      id: n.id,
      title: n.title,
      content: joinContentParts([
        n.why_text,
        n.principle,
        n.protocol,
        n.tech_background,
        n.competitors,
        n.product_thinking,
      ]),
    }));
  const competitorCandidates: SimilarCandidate[] = competitors.map((n) => ({
    id: n.id,
    title: n.title,
    content: n.summary ?? "",
  }));
  const requirementCandidates: SimilarCandidate[] = fullReqs.map((n) => ({
    id: n.id,
    title: n.title,
    content: joinContentParts([n.detail_work, n.acceptance_criteria]),
  }));
  const bugCandidates: SimilarCandidate[] = bugs.map((n) => ({
    id: n.id,
    title: n.title,
    content: joinContentParts([
      n.repro_steps,
      n.expected_result,
      n.actual_result,
      n.description,
      n.suggestion,
    ]),
  }));

  const conflicts: BundleConflictItem[] = [];
  let creates = 0;
  let updates = 0;
  const claimedIds = new Set<string>();

  for (const sheet of preview.sheets) {
    if (!sheet.kind) continue;
    for (const row of sheet.rows) {
      let existingId: string | undefined;
      let match: "title" | "similar" | undefined;
      let similarToTitle: string | undefined;
      let score: number | undefined;

      if (row.kind === "learning") {
        existingId = learningByTitle.get(titleKey(row.title));
        if (existingId) match = "title";
        else {
          const hit = findBestSimilar(
            row.title,
            rowImportContent(row),
            learningCandidates,
            claimedIds
          );
          if (hit) {
            existingId = hit.id;
            match = "similar";
            similarToTitle = hit.title;
            score = hit.score;
          }
        }
      } else if (row.kind === "competitor") {
        existingId = competitorByTitle.get(titleKey(row.title));
        if (existingId) match = "title";
        else {
          const hit = findBestSimilar(
            row.title,
            rowImportContent(row),
            competitorCandidates,
            claimedIds
          );
          if (hit) {
            existingId = hit.id;
            match = "similar";
            similarToTitle = hit.title;
            score = hit.score;
          }
        }
      } else if (row.kind === "requirement") {
        existingId = requirementByTitle.get(titleKey(row.title));
        if (existingId) match = "title";
        else {
          const hit = findBestSimilar(
            row.title,
            rowImportContent(row),
            requirementCandidates,
            claimedIds
          );
          if (hit) {
            existingId = hit.id;
            match = "similar";
            similarToTitle = hit.title;
            score = hit.score;
          }
        }
      } else if (row.kind === "bug" || row.kind === "optimization") {
        existingId = bugByTitle.get(titleKey(row.title));
        if (existingId) match = "title";
        else {
          const hit = findBestSimilar(
            row.title,
            rowImportContent(row),
            bugCandidates,
            claimedIds
          );
          if (hit) {
            existingId = hit.id;
            match = "similar";
            similarToTitle = hit.title;
            score = hit.score;
          }
        }
      }

      if (existingId) claimedIds.add(existingId);

      const action = existingId ? "update" : "create";
      if (action === "create") creates += 1;
      else updates += 1;

      conflicts.push({
        key: conflictKey(row.kind, row.title),
        kind: row.kind,
        title: row.title,
        sheetName: sheet.sheetName,
        action,
        existingId,
        match: existingId ? match ?? "title" : undefined,
        similarToTitle,
        score,
        selected: true,
      });
    }
  }

  return {
    ...preview,
    conflicts,
    summary: {
      ...preview.summary,
      creates,
      updates,
    },
  };
}

function mapBugStatus(raw: string | null): TaskStatus {
  if (!raw) return "pending";
  if (/确认|待确认/.test(raw)) return "pending";
  if (/提交|开发|进行/.test(raw)) return "in_progress";
  if (/修复|已修/.test(raw)) return "testing";
  if (/回归|通过|完成|关闭/.test(raw)) return "done";
  if (/阻塞/.test(raw)) return "blocked";
  return "pending";
}

function titleKey(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, "");
}

function findByTitle<T extends { id: string; title: string }>(
  list: T[],
  title: string
): T | undefined {
  const k = titleKey(title);
  return list.find((x) => titleKey(x.title) === k);
}

function mergeIds(existing: string[], add: string[]): string[] {
  return Array.from(new Set([...existing, ...add].filter(Boolean)));
}

export async function commitWorkbookBundle(
  projectIdOrSlug: string,
  preview: BundlePreview,
  options?: { workbookBuffer?: ArrayBuffer | Buffer }
): Promise<BundleCommitResult> {
  const project = await getProjectById(projectIdOrSlug);
  if (!project) throw new Error("项目不存在");
  const projectId = project.id;

  /** 未勾选的更新：跳过；无 conflicts 时全部写入 */
  const skipUpdateKeys = new Set(
    (preview.conflicts ?? [])
      .filter((c) => c.action === "update" && !c.selected)
      .map((c) => c.key)
  );
  /** 勾选替换时按冲突里的 existingId 定位（含 5b 标题不同） */
  const updateTargetByKey = new Map(
    (preview.conflicts ?? [])
      .filter(
        (c) => c.action === "update" && c.selected && Boolean(c.existingId)
      )
      .map((c) => [c.key, c.existingId!] as const)
  );

  const result: BundleCommitResult = {
    created: {
      learning: 0,
      competitor: 0,
      requirement: 0,
      bug: 0,
      optimization: 0,
    },
    updated: {
      learning: 0,
      competitor: 0,
      requirement: 0,
      bug: 0,
      optimization: 0,
    },
    linksApplied: 0,
    pendingLinks: [],
    imagesAttached: 0,
  };

  type ImageJob = {
    target: "learning" | "bug";
    entityId: string;
    sheetName: string;
    sourceRow: number;
  };
  const imageJobs: ImageJob[] = [];

  // Pass 1: upsert entities (without cross-ids yet)
  const learningByTitle = new Map<string, string>();
  /** 板块标题 → section note id */
  const sectionByTitle = new Map<string, string>();
  const competitorByTitle = new Map<string, string>();
  const requirementByTitle = new Map<string, string>();
  const bugByTitle = new Map<string, string>();

  let learnings = await listProjectLearningNotes(projectId);
  let competitors = await listCompetitorEntries(projectId);
  const { listProjectRequirementOptions } = await import("@/lib/db/local-store");
  let requirements = await listProjectRequirementOptions(projectId);
  let bugs = await listBugsByProject(projectId);

  for (const x of learnings) {
    learningByTitle.set(titleKey(x.title), x.id);
    if (x.kind === "section") sectionByTitle.set(titleKey(x.title), x.id);
  }
  for (const x of competitors) competitorByTitle.set(titleKey(x.title), x.id);
  for (const x of requirements) requirementByTitle.set(titleKey(x.title), x.id);
  for (const x of bugs) bugByTitle.set(titleKey(x.title), x.id);

  async function ensureSection(sectionTitle: string): Promise<string> {
    const key = titleKey(sectionTitle);
    const hit = sectionByTitle.get(key);
    if (hit) return hit;
    const existing = learnings.find(
      (n) => n.kind === "section" && titleKey(n.title) === key
    );
    if (existing) {
      sectionByTitle.set(key, existing.id);
      learningByTitle.set(key, existing.id);
      return existing.id;
    }
    const created = await createProjectLearningNote({
      project_id: projectId,
      title: sectionTitle.trim() || "未分板块",
      kind: "section",
      parent_id: null,
    });
    sectionByTitle.set(key, created.id);
    learningByTitle.set(key, created.id);
    learnings = [...learnings, created];
    result.created.learning += 1;
    return created.id;
  }

  /** 主题挂在板块下；同名主题复用 */
  async function ensureTopic(
    topicTitle: string,
    sectionId: string | null
  ): Promise<string> {
    const key = titleKey(topicTitle);
    const existing = learnings.find(
      (n) =>
        n.kind === "topic" &&
        titleKey(n.title) === key &&
        (sectionId ? n.parent_id === sectionId : true)
    );
    if (existing) {
      learningByTitle.set(key, existing.id);
      return existing.id;
    }
    const created = await createProjectLearningNote({
      project_id: projectId,
      title: topicTitle.trim() || "未分主题",
      kind: "topic",
      parent_id: sectionId,
    });
    learningByTitle.set(key, created.id);
    learnings = [...learnings, created];
    result.created.learning += 1;
    return created.id;
  }

  const pendingLinkJobs: Array<{
    kind: BundleSheetKind;
    id: string;
    links: BundleLinkRefs;
    evidence?: string;
  }> = [];

  function resolveByConflictOrTitle<T extends { id: string; title: string }>(
    kind: BundleSheetKind,
    title: string,
    list: T[]
  ): T | undefined {
    const forced = updateTargetByKey.get(conflictKey(kind, title));
    if (forced) return list.find((x) => x.id === forced);
    return findByTitle(list, title);
  }

  for (const sheet of preview.sheets) {
    if (!sheet.kind) continue;
    for (const row of sheet.rows) {
      if (row.kind === "learning") {
        const ck = conflictKey("learning", row.title);
        if (skipUpdateKeys.has(ck)) continue;

        const sectionId = row.section_title
          ? await ensureSection(row.section_title)
          : null;
        const topicName = row.topic_title?.trim() || row.title;
        const hasPoint = Boolean(row.point_title?.trim());
        const forcedLearning = updateTargetByKey.get(ck);

        if (hasPoint) {
          const topicId = await ensureTopic(topicName, sectionId);
          const pointTitle = row.point_title!.trim();
          const existing =
            (forcedLearning
              ? learnings.find((n) => n.id === forcedLearning)
              : undefined) ??
            learnings.find(
              (n) =>
                n.kind === "point" &&
                titleKey(n.title) === titleKey(pointTitle) &&
                n.parent_id === topicId
            );
          if (existing) {
            await updateProjectLearningNote(existing.id, {
              title: pointTitle,
              kind: "point",
              parent_id: topicId,
              why_text: row.why_text || existing.why_text,
              principle: row.principle || existing.principle,
              protocol: row.protocol || existing.protocol,
              tech_background:
                row.tech_background || existing.tech_background,
              competitors: row.competitors || existing.competitors,
              product_thinking:
                row.product_thinking || existing.product_thinking,
            });
            learningByTitle.set(titleKey(pointTitle), existing.id);
            result.updated.learning += 1;
            pendingLinkJobs.push({
              kind: "learning",
              id: existing.id,
              links: row.links,
            });
            if (row.sourceRow) {
              imageJobs.push({
                target: "learning",
                entityId: existing.id,
                sheetName: sheet.sheetName,
                sourceRow: row.sourceRow,
              });
            }
          } else {
            const created = await createProjectLearningNote({
              project_id: projectId,
              title: pointTitle,
              kind: "point",
              parent_id: topicId,
              why_text: row.why_text,
              principle: row.principle,
              protocol: row.protocol,
              tech_background: row.tech_background,
              competitors: row.competitors,
              product_thinking: row.product_thinking,
            });
            learningByTitle.set(titleKey(pointTitle), created.id);
            learnings = [...learnings, created];
            result.created.learning += 1;
            pendingLinkJobs.push({
              kind: "learning",
              id: created.id,
              links: row.links,
            });
            if (row.sourceRow) {
              imageJobs.push({
                target: "learning",
                entityId: created.id,
                sheetName: sheet.sheetName,
                sourceRow: row.sourceRow,
              });
            }
          }
        } else {
          // 无「子知识点」列：主题即叶子（topic），兼容现有知识表
          const existing =
            (forcedLearning
              ? learnings.find((n) => n.id === forcedLearning)
              : undefined) ??
            learnings.find(
              (n) =>
                (n.kind === "topic" || n.kind === "point") &&
                titleKey(n.title) === titleKey(topicName) &&
                (sectionId ? n.parent_id === sectionId : true)
            );
          if (existing) {
            await updateProjectLearningNote(existing.id, {
              title: topicName,
              kind: existing.kind === "point" ? "point" : "topic",
              parent_id:
                existing.kind === "section"
                  ? null
                  : sectionId ?? existing.parent_id,
              why_text: row.why_text || existing.why_text,
              principle: row.principle || existing.principle,
              protocol: row.protocol || existing.protocol,
              tech_background:
                row.tech_background || existing.tech_background,
              competitors: row.competitors || existing.competitors,
              product_thinking:
                row.product_thinking || existing.product_thinking,
            });
            learningByTitle.set(titleKey(topicName), existing.id);
            result.updated.learning += 1;
            pendingLinkJobs.push({
              kind: "learning",
              id: existing.id,
              links: row.links,
            });
            if (row.sourceRow) {
              imageJobs.push({
                target: "learning",
                entityId: existing.id,
                sheetName: sheet.sheetName,
                sourceRow: row.sourceRow,
              });
            }
          } else {
            const created = await createProjectLearningNote({
              project_id: projectId,
              title: topicName,
              kind: "topic",
              parent_id: sectionId,
              why_text: row.why_text,
              principle: row.principle,
              protocol: row.protocol,
              tech_background: row.tech_background,
              competitors: row.competitors,
              product_thinking: row.product_thinking,
            });
            learningByTitle.set(titleKey(topicName), created.id);
            learnings = [...learnings, created];
            result.created.learning += 1;
            pendingLinkJobs.push({
              kind: "learning",
              id: created.id,
              links: row.links,
            });
            if (row.sourceRow) {
              imageJobs.push({
                target: "learning",
                entityId: created.id,
                sheetName: sheet.sheetName,
                sourceRow: row.sourceRow,
              });
            }
          }
        }
      } else if (row.kind === "optimization") {
        // 优化表 → Bug：标题=优化建议，suggestion=内容/收益/出处；可再一键生成需求
        const ck = conflictKey("optimization", row.title);
        if (skipUpdateKeys.has(ck)) continue;

        const detailParts = [
          row.detail?.trim() || "",
          row.benefit?.trim() ? `预期收益：${row.benefit.trim()}` : "",
          row.source?.trim() ? `出处：${row.source.trim()}` : "",
        ].filter(Boolean);
        const suggestionText = detailParts.join("\n");
        const existing = resolveByConflictOrTitle("optimization", row.title, bugs);
        if (existing) {
          await updateBug(existing.id, {
            title: row.title,
            module_path: row.section_title || existing.module_path || undefined,
            suggestion: suggestionText || existing.suggestion || undefined,
          });
          bugByTitle.set(titleKey(row.title), existing.id);
          result.updated.optimization += 1;
          pendingLinkJobs.push({
            kind: "bug",
            id: existing.id,
            links: row.links,
          });
          if (row.sourceRow) {
            imageJobs.push({
              target: "bug",
              entityId: existing.id,
              sheetName: sheet.sheetName,
              sourceRow: row.sourceRow,
            });
          }
        } else {
          const created = await createBug({
            project_id: projectId,
            title: row.title,
            module_path: row.section_title || undefined,
            suggestion: suggestionText || undefined,
            description: row.section_title
              ? `来自优化表 · 板块：${row.section_title}`
              : "来自优化表导入",
            status: "pending",
            notify: false,
          });
          bugByTitle.set(titleKey(row.title), created.id);
          bugs = [...bugs, created];
          result.created.optimization += 1;
          pendingLinkJobs.push({
            kind: "bug",
            id: created.id,
            links: row.links,
          });
          if (row.sourceRow) {
            imageJobs.push({
              target: "bug",
              entityId: created.id,
              sheetName: sheet.sheetName,
              sourceRow: row.sourceRow,
            });
          }
        }
      } else if (row.kind === "competitor") {
        const ck = conflictKey("competitor", row.title);
        if (skipUpdateKeys.has(ck)) continue;
        const existing = resolveByConflictOrTitle(
          "competitor",
          row.title,
          competitors
        );
        if (existing) {
          await updateCompetitorEntry(existing.id, {
            title: row.title,
            summary: row.summary || existing.summary,
            url: row.url ?? existing.url,
            module_path: row.module_path ?? existing.module_path,
          });
          competitorByTitle.set(titleKey(row.title), existing.id);
          result.updated.competitor += 1;
          pendingLinkJobs.push({
            kind: "competitor",
            id: existing.id,
            links: row.links,
          });
        } else {
          const created = await createCompetitorEntry({
            project_id: projectId,
            title: row.title,
            summary: row.summary,
            url: row.url,
            module_path: row.module_path,
          });
          competitorByTitle.set(titleKey(row.title), created.id);
          competitors = [...competitors, created];
          result.created.competitor += 1;
          pendingLinkJobs.push({
            kind: "competitor",
            id: created.id,
            links: row.links,
          });
        }
      } else if (row.kind === "requirement") {
        const ck = conflictKey("requirement", row.title);
        if (skipUpdateKeys.has(ck)) continue;
        const existing = resolveByConflictOrTitle(
          "requirement",
          row.title,
          requirements as Array<{ id: string; title: string }>
        );
        if (existing) {
          const { updateRequirement } = await import("@/lib/db/local-store");
          await updateRequirement(
            existing.id,
            {
              title: row.title,
              detail_work: row.detail_work || undefined,
              acceptance_criteria: row.acceptance_criteria || undefined,
              priority: row.priority,
            },
            { name: "Auto", role: "admin" }
          );
          requirementByTitle.set(titleKey(row.title), existing.id);
          result.updated.requirement += 1;
          pendingLinkJobs.push({
            kind: "requirement",
            id: existing.id,
            links: row.links,
          });
        } else {
          const created = await createPoolRequirement(projectId, {
            title: row.title,
            detail_work: row.detail_work || null,
            acceptance_criteria: row.acceptance_criteria || null,
            priority: row.priority,
            status_tags: ["想法"],
            actor_name: "Auto",
            actor_note: "总表 Excel 导入",
          });
          requirementByTitle.set(titleKey(row.title), created.id);
          requirements = [
            ...requirements,
            { id: created.id, title: created.title, inPool: true },
          ];
          result.created.requirement += 1;
          pendingLinkJobs.push({
            kind: "requirement",
            id: created.id,
            links: row.links,
          });
        }
      } else if (row.kind === "bug") {
        const ck = conflictKey("bug", row.title);
        if (skipUpdateKeys.has(ck)) continue;
        const existing = resolveByConflictOrTitle("bug", row.title, bugs);
        const evidenceUrls = [
          ...row.links.urls,
          ...extractUrls(row.evidence).urls,
        ];
        const descParts = [
          row.evidence?.trim() ? `证据：${row.evidence.trim()}` : "",
          evidenceUrls.length ? `链接：${evidenceUrls.join(" ")}` : "",
        ].filter(Boolean);
        if (existing) {
          await updateBug(existing.id, {
            title: row.title,
            module_path: row.module_path ?? undefined,
            repro_steps: row.repro_steps || existing.repro_steps || undefined,
            expected_result:
              row.expected_result || existing.expected_result || undefined,
            actual_result:
              row.actual_result || existing.actual_result || undefined,
            description: descParts.join("\n") || existing.description || undefined,
            status: mapBugStatus(row.status),
          });
          bugByTitle.set(titleKey(row.title), existing.id);
          result.updated.bug += 1;
          pendingLinkJobs.push({
            kind: "bug",
            id: existing.id,
            links: row.links,
            evidence: row.evidence,
          });
          if (row.sourceRow) {
            imageJobs.push({
              target: "bug",
              entityId: existing.id,
              sheetName: sheet.sheetName,
              sourceRow: row.sourceRow,
            });
          }
        } else {
          const created = await createBug({
            project_id: projectId,
            title: row.title,
            module_path: row.module_path ?? undefined,
            repro_steps: row.repro_steps || undefined,
            expected_result: row.expected_result || undefined,
            actual_result: row.actual_result || undefined,
            description: descParts.join("\n") || undefined,
            status: mapBugStatus(row.status),
            notify: false,
          });
          bugByTitle.set(titleKey(row.title), created.id);
          bugs = [...bugs, created];
          result.created.bug += 1;
          pendingLinkJobs.push({
            kind: "bug",
            id: created.id,
            links: row.links,
            evidence: row.evidence,
          });
          if (row.sourceRow) {
            imageJobs.push({
              target: "bug",
              entityId: created.id,
              sheetName: sheet.sheetName,
              sourceRow: row.sourceRow,
            });
          }
        }
      }
    }
  }

  // Refresh maps after creates (in-workbook titles now resolvable)
  const resolve = (
    titles: string[],
    map: Map<string, string>,
    label: string
  ): string[] => {
    const ids: string[] = [];
    for (const t of titles) {
      const id = map.get(titleKey(t));
      if (id) ids.push(id);
      else result.pendingLinks.push(`${label}:${t}`);
    }
    return ids;
  };

  for (const job of pendingLinkJobs) {
    const learningIds = resolve(
      job.links.learningTitles,
      learningByTitle,
      "学习"
    );
    const competitorIds = resolve(
      job.links.competitorTitles,
      competitorByTitle,
      "竞品"
    );
    const requirementIds = resolve(
      job.links.requirementTitles,
      requirementByTitle,
      "需求"
    );
    const bugIds = resolve(job.links.bugTitles, bugByTitle, "Bug");

    if (
      !learningIds.length &&
      !competitorIds.length &&
      !requirementIds.length &&
      !bugIds.length
    ) {
      continue;
    }

    if (job.kind === "learning") {
      const cur = learnings.find((n) => n.id === job.id);
      await updateProjectLearningNote(job.id, {
        linked_requirement_ids: mergeIds(
          cur?.linked_requirement_ids ?? [],
          requirementIds
        ),
        linked_competitor_ids: mergeIds(
          cur?.linked_competitor_ids ?? [],
          competitorIds
        ),
        linked_bug_ids: mergeIds(cur?.linked_bug_ids ?? [], bugIds),
      });
      result.linksApplied += 1;
    } else if (job.kind === "competitor") {
      const cur = competitors.find((n) => n.id === job.id);
      await updateCompetitorEntry(job.id, {
        linked_learning_note_ids: mergeIds(
          cur?.linked_learning_note_ids ?? [],
          learningIds
        ),
        linked_requirement_ids: mergeIds(
          cur?.linked_requirement_ids ?? [],
          requirementIds
        ),
        linked_bug_ids: mergeIds(cur?.linked_bug_ids ?? [], bugIds),
      });
      result.linksApplied += 1;
    } else if (job.kind === "bug") {
      const cur = bugs.find((n) => n.id === job.id);
      await updateBug(job.id, {
        linked_learning_note_ids: mergeIds(
          cur?.linked_learning_note_ids ?? [],
          learningIds
        ),
        linked_competitor_ids: mergeIds(
          cur?.linked_competitor_ids ?? [],
          competitorIds
        ),
        requirement_id: requirementIds[0] ?? cur?.requirement_id ?? null,
      });
      result.linksApplied += 1;
    } else if (job.kind === "requirement") {
      // reverse: attach this requirement onto linked learnings / competitors / bugs
      for (const lid of learningIds) {
        const cur = learnings.find((n) => n.id === lid);
        await updateProjectLearningNote(lid, {
          linked_requirement_ids: mergeIds(cur?.linked_requirement_ids ?? [], [
            job.id,
          ]),
        });
        result.linksApplied += 1;
      }
      for (const cid of competitorIds) {
        const cur = competitors.find((n) => n.id === cid);
        await updateCompetitorEntry(cid, {
          linked_requirement_ids: mergeIds(cur?.linked_requirement_ids ?? [], [
            job.id,
          ]),
        });
        result.linksApplied += 1;
      }
      for (const bid of bugIds) {
        await updateBug(bid, { requirement_id: job.id });
        result.linksApplied += 1;
      }
    }
  }

  // 内嵌图：按 Sheet+行挂到刚写入的学习 / Bug 附件
  if (options?.workbookBuffer && imageJobs.length) {
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(
        Buffer.from(options.workbookBuffer as ArrayBuffer) as never
      );
      const byRow = collectEmbeddedImagesByRow(wb);
      const { uploadStudioAssetBuffer } = await import(
        "@/lib/studio/asset-storage"
      );
      const { createLearningNoteAttachment, listLearningAttachmentsForNote } =
        await import("@/lib/learning-notes/store");
      const { createBugAttachment, listBugAttachments } = await import(
        "@/lib/db/local-store"
      );

      for (const job of imageJobs) {
        const key = `${job.sheetName}::${job.sourceRow}`;
        const imgs = byRow.get(key) ?? [];
        if (!imgs.length) continue;

        const existingTitles = new Set<string>();
        if (job.target === "learning") {
          const existing = await listLearningAttachmentsForNote(job.entityId);
          for (const a of existing) existingTitles.add(a.title);
        } else {
          const existing = await listBugAttachments(job.entityId);
          for (const a of existing) existingTitles.add(a.title);
        }

        for (let i = 0; i < imgs.length; i++) {
          const img = imgs[i];
          const title = `导入图 R${job.sourceRow}-${i + 1}`;
          if (existingTitles.has(title)) continue;
          const mime = mimeFromExt(img.extension);
          const uploaded = await uploadStudioAssetBuffer(
            projectId,
            img.buffer,
            `xlsx-r${job.sourceRow}-${i + 1}.${img.extension}`,
            mime
          );
          if (job.target === "learning") {
            await createLearningNoteAttachment({
              project_id: projectId,
              note_id: job.entityId,
              title,
              url: uploaded.url,
              storage_path: uploaded.storagePath,
              mime_type: uploaded.mimeType,
            });
          } else {
            await createBugAttachment({
              project_id: projectId,
              bug_id: job.entityId,
              title,
              url: uploaded.url,
              storage_path: uploaded.storagePath,
              mime_type: uploaded.mimeType,
            });
          }
          result.imagesAttached += 1;
          existingTitles.add(title);
        }
      }
    } catch (e) {
      // 图失败不阻断文字导入
      result.pendingLinks.push(
        `内嵌图:${e instanceof Error ? e.message : "挂载失败"}`
      );
    }
  }

  result.pendingLinks = Array.from(new Set(result.pendingLinks));
  return result;
}

const TEMPLATE_SHEETS: Array<{
  name: string;
  headers: string[];
  sample: string[];
}> = [
  {
    name: "知识表",
    headers: [
      "板块",
      "主题",
      "子知识点",
      "知识要点",
      "出处",
      "关联需求",
      "关联竞品",
      "关联Bug",
    ],
    sample: [
      "存储",
      "RAID",
      "RAID 10",
      "先镜像再条带，兼顾速度与安全",
      "调研笔记",
      "",
      "",
      "",
    ],
  },
  {
    name: "学习",
    headers: [
      "板块",
      "主题",
      "子知识点",
      "知识要点",
      "为什么",
      "原理",
      "协议",
      "技术背景",
      "竞品说明",
      "产品思考",
      "关联需求",
      "关联竞品",
      "关联Bug",
      "外链",
    ],
    sample: [
      "存储",
      "RAID",
      "",
      "条带与校验",
      "为何要学",
      "条带与校验",
      "",
      "",
      "",
      "",
      "存储可靠性",
      "群晖",
      "",
      "https://example.com",
    ],
  },
  {
    name: "优化表",
    headers: ["板块", "优化建议", "优化内容", "预期收益", "出处"],
    sample: [
      "存储",
      "一键 RAID 预设",
      "提供类似 RAID 10 的一键预设",
      "降低配置门槛",
      "调研笔记",
    ],
  },
  {
    name: "竞品",
    headers: [
      "标题",
      "摘要",
      "外链",
      "功能模块",
      "关联学习",
      "关联需求",
      "关联Bug",
    ],
    sample: [
      "群晖",
      "消费级 NAS",
      "https://www.synology.com",
      "存储",
      "RAID 原理",
      "",
      "",
    ],
  },
  {
    name: "需求",
    headers: [
      "标题",
      "详情",
      "验收",
      "优先级",
      "功能模块",
      "关联学习",
      "关联竞品",
      "关联Bug",
    ],
    sample: [
      "存储可靠性",
      "支持 RAID 说明",
      "文案可理解",
      "P1",
      "存储",
      "RAID 原理",
      "群晖",
      "",
    ],
  },
  {
    name: "Bug",
    headers: [
      "问题标题",
      "功能模块",
      "操作步骤",
      "预期",
      "实际",
      "证据",
      "状态",
      "关联学习",
      "关联竞品",
      "关联需求",
      "外链",
    ],
    sample: [
      "RAID 文案错误",
      "存储",
      "打开帮助",
      "术语正确",
      "写错校验位",
      "见截图",
      "待确认",
      "RAID 原理",
      "群晖",
      "存储可靠性",
      "",
    ],
  },
];

export async function buildWorkbookBundleTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  for (const def of TEMPLATE_SHEETS) {
    const sheet = wb.addWorksheet(def.name);
    sheet.addRow(def.headers);
    sheet.addRow(def.sample);
    sheet.getRow(1).font = { bold: true };
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

function joinTitles(titles: string[]): string {
  return titles.filter(Boolean).join("、");
}

function idsToTitles(
  ids: string[],
  byId: Map<string, string>
): string {
  return joinTitles(ids.map((id) => byId.get(id) ?? "").filter(Boolean));
}

function summarizePreview(sheets: BundleSheetPreview[]): BundlePreview["summary"] {
  const summary = {
    learning: 0,
    competitor: 0,
    requirement: 0,
    bug: 0,
    optimization: 0,
    linkHints: 0,
    unmatchedLinkHints: [] as string[],
    creates: 0,
    updates: 0,
    embeddedImages: 0,
  };
  for (const s of sheets) {
    if (!s.kind) continue;
    summary[s.kind] += s.rows.length;
    for (const row of s.rows) {
      summary.linkHints +=
        row.links.learningTitles.length +
        row.links.competitorTitles.length +
        row.links.requirementTitles.length +
        row.links.bugTitles.length;
    }
  }
  return summary;
}

/** 从项目实体预填总表网格 */
export async function loadWorkbookBundleFromProject(
  projectIdOrSlug: string
): Promise<BundlePreview> {
  const project = await getProjectById(projectIdOrSlug);
  if (!project) throw new Error("项目不存在");

  const [learnings, competitors, requirements, bugs] = await Promise.all([
    listProjectLearningNotes(project.id),
    listCompetitorEntries(project.id),
    (await import("@/lib/db/local-store")).listProjectRequirementOptions(
      project.id
    ),
    listBugsByProject(project.id),
  ]);

  const learningById = new Map(learnings.map((n) => [n.id, n]));
  const learningTitleById = new Map(learnings.map((n) => [n.id, n.title]));
  const competitorById = new Map(competitors.map((n) => [n.id, n.title]));
  const requirementById = new Map(requirements.map((n) => [n.id, n.title]));
  const bugById = new Map(bugs.map((n) => [n.id, n.title]));
  const sectionTitleById = new Map(
    learnings.filter((n) => n.kind === "section").map((n) => [n.id, n.title])
  );
  const topicTitleById = new Map(
    learnings.filter((n) => n.kind === "topic").map((n) => [n.id, n.title])
  );

  const learningRows: LearningBundleRow[] = learnings
    .filter((n) => n.kind !== "section" && n.title.trim())
    .map((n) => {
      let section_title: string | null = null;
      let topic_title: string | null = null;
      let point_title: string | null = null;
      if (n.kind === "point") {
        point_title = n.title;
        topic_title = n.parent_id
          ? topicTitleById.get(n.parent_id) ?? null
          : null;
        const topic = n.parent_id ? learningById.get(n.parent_id) : null;
        section_title = topic?.parent_id
          ? sectionTitleById.get(topic.parent_id) ?? null
          : null;
      } else {
        topic_title = n.title;
        section_title = n.parent_id
          ? sectionTitleById.get(n.parent_id) ?? null
          : null;
      }
      return {
        kind: "learning" as const,
        title: point_title || topic_title || n.title,
        section_title,
        topic_title,
        point_title,
        why_text: n.why_text,
        principle: n.principle,
        protocol: n.protocol,
        tech_background: n.tech_background,
        competitors: n.competitors,
        product_thinking: n.product_thinking,
        source: "",
        links: {
          ...emptyLinks(),
          requirementTitles: splitTitles(
            idsToTitles(n.linked_requirement_ids ?? [], requirementById)
          ),
          competitorTitles: splitTitles(
            idsToTitles(n.linked_competitor_ids ?? [], competitorById)
          ),
          bugTitles: splitTitles(idsToTitles(n.linked_bug_ids ?? [], bugById)),
          learningTitles: [],
        },
        warnings: [],
        sourceRow: 0,
      };
    });

  const competitorRows: CompetitorBundleRow[] = competitors
    .filter((n) => n.title.trim())
    .map((n) => ({
      kind: "competitor" as const,
      title: n.title,
      summary: n.summary,
      url: n.url,
      module_path: n.module_path,
      links: {
        ...emptyLinks(),
        learningTitles: splitTitles(
          idsToTitles(n.linked_learning_note_ids ?? [], learningTitleById)
        ),
        requirementTitles: splitTitles(
          idsToTitles(n.linked_requirement_ids ?? [], requirementById)
        ),
        bugTitles: splitTitles(idsToTitles(n.linked_bug_ids ?? [], bugById)),
        urls: n.url ? [n.url] : [],
      },
      warnings: [],
      sourceRow: 0,
    }));

  const { getPoolBundle } = await import("@/lib/db/local-store");
  const pool = await getPoolBundle(project.id);
  const fullReqs = pool?.poolRequirements ?? [];

  const requirementRows: RequirementBundleRow[] = fullReqs
    .filter((n) => n.title.trim())
    .map((n) => {
      const id = n.id;
      return {
        kind: "requirement" as const,
        title: n.title,
        detail_work: n.detail_work ?? "",
        acceptance_criteria: n.acceptance_criteria ?? "",
        priority: n.priority,
        module_path: null,
        links: {
          ...emptyLinks(),
          learningTitles: learnings
            .filter((x) => (x.linked_requirement_ids ?? []).includes(id))
            .map((x) => x.title),
          competitorTitles: competitors
            .filter((x) => (x.linked_requirement_ids ?? []).includes(id))
            .map((x) => x.title),
          bugTitles: bugs
            .filter((x) => x.requirement_id === id)
            .map((x) => x.title),
        },
        warnings: [],
        sourceRow: 0,
      };
    });

  const bugRows: BugBundleRow[] = bugs
    .filter((n) => n.title.trim())
    .map((n) => ({
      kind: "bug" as const,
      title: n.title,
      module_path: n.module_path,
      repro_steps: n.repro_steps ?? "",
      expected_result: n.expected_result ?? "",
      actual_result: n.actual_result ?? "",
      evidence: n.description ?? "",
      status: n.status,
      links: {
        ...emptyLinks(),
        learningTitles: splitTitles(
          idsToTitles(n.linked_learning_note_ids ?? [], learningTitleById)
        ),
        competitorTitles: splitTitles(
          idsToTitles(n.linked_competitor_ids ?? [], competitorById)
        ),
        requirementTitles: n.requirement_id
          ? splitTitles(
              idsToTitles([n.requirement_id], requirementById)
            )
          : [],
      },
      warnings: [],
      sourceRow: 0,
    }));

  const sheets: BundleSheetPreview[] = [
    {
      sheetName: "学习",
      kind: "learning",
      rows: learningRows,
      ignored: false,
    },
    {
      sheetName: "竞品",
      kind: "competitor",
      rows: competitorRows,
      ignored: false,
    },
    {
      sheetName: "需求",
      kind: "requirement",
      rows: requirementRows,
      ignored: false,
    },
    {
      sheetName: "Bug",
      kind: "bug",
      rows: bugRows,
      ignored: false,
    },
  ];

  return { sheets, summary: summarizePreview(sheets) };
}

export function previewToGridState(preview: BundlePreview): WorkbookGridState {
  return {
    sheets: WORKBOOK_GRID_SHEETS.map((def) => {
      const sheet = preview.sheets.find((s) => s.kind === def.kind);
      const rows: GridRow[] = (sheet?.rows ?? []).map((row) => {
        const base: GridRow = { title: row.title };
        if (row.kind === "learning") {
          return {
            ...base,
            section_title: row.section_title ?? "",
            topic_title: row.topic_title ?? "",
            point_title: row.point_title ?? "",
            why_text: row.why_text,
            principle: row.principle,
            protocol: row.protocol,
            tech_background: row.tech_background,
            competitors: row.competitors,
            product_thinking: row.product_thinking,
            link_requirements: joinTitles(row.links.requirementTitles),
            link_competitors: joinTitles(row.links.competitorTitles),
            link_bugs: joinTitles(row.links.bugTitles),
            url: joinTitles(row.links.urls),
          };
        }
        if (row.kind === "competitor") {
          return {
            ...base,
            summary: row.summary,
            url: row.url ?? joinTitles(row.links.urls),
            module_path: row.module_path ?? "",
            link_learning: joinTitles(row.links.learningTitles),
            link_requirements: joinTitles(row.links.requirementTitles),
            link_bugs: joinTitles(row.links.bugTitles),
          };
        }
        if (row.kind === "requirement") {
          return {
            ...base,
            detail_work: row.detail_work,
            acceptance_criteria: row.acceptance_criteria,
            priority: row.priority ?? "",
            module_path: row.module_path ?? "",
            link_learning: joinTitles(row.links.learningTitles),
            link_competitors: joinTitles(row.links.competitorTitles),
            link_bugs: joinTitles(row.links.bugTitles),
          };
        }
        if (row.kind === "bug") {
          return {
            ...base,
            module_path: row.module_path ?? "",
            repro_steps: row.repro_steps,
            expected_result: row.expected_result,
            actual_result: row.actual_result,
            evidence: row.evidence,
            status: row.status ?? "",
            link_learning: joinTitles(row.links.learningTitles),
            link_competitors: joinTitles(row.links.competitorTitles),
            link_requirements: joinTitles(row.links.requirementTitles),
            url: joinTitles(row.links.urls),
          };
        }
        return base;
      });
      return { kind: def.kind, sheetName: def.sheetName, rows };
    }),
  };
}

function linksFromGrid(row: GridRow): BundleLinkRefs {
  const links = emptyLinks();
  links.learningTitles = splitTitles(row.link_learning ?? "");
  links.competitorTitles = splitTitles(row.link_competitors ?? "");
  links.requirementTitles = splitTitles(row.link_requirements ?? "");
  links.bugTitles = splitTitles(row.link_bugs ?? "");
  const urlParsed = extractUrls(row.url ?? "");
  links.urls = urlParsed.urls;
  if (urlParsed.text && /^https?:\/\//i.test(urlParsed.text)) {
    links.urls.push(urlParsed.text);
  }
  links.urls = Array.from(new Set(links.urls));
  return links;
}

/** 网格状态 → 可 commit 的 BundlePreview */
export function gridStateToPreview(state: WorkbookGridState): BundlePreview {
  const sheets: BundleSheetPreview[] = state.sheets.map((s) => {
    const rows: BundleParsedRow[] = s.rows
      .filter((r) => (r.title ?? "").trim())
      .map((r) => {
        const links = linksFromGrid(r);
        if (s.kind === "learning") {
          const topicTitle =
            r.topic_title?.trim() || r.title.trim() || null;
          const pointTitle = r.point_title?.trim() || null;
          return {
            kind: "learning" as const,
            title: (pointTitle || topicTitle || r.title).trim(),
            section_title: r.section_title?.trim() || null,
            topic_title: topicTitle,
            point_title: pointTitle,
            why_text: r.why_text ?? "",
            principle: r.principle ?? "",
            protocol: r.protocol ?? "",
            tech_background: r.tech_background ?? "",
            competitors: r.competitors ?? "",
            product_thinking: r.product_thinking ?? "",
            source: "",
            links,
            warnings: [],
            sourceRow: 0,
          };
        }
        if (s.kind === "competitor") {
          const urlCell = r.url ?? "";
          const { urls, text } = extractUrls(urlCell);
          const url =
            urls[0] ?? (/^https?:\/\//i.test(text) ? text : null);
          return {
            kind: "competitor" as const,
            title: r.title.trim(),
            summary: r.summary ?? "",
            url,
            module_path: r.module_path?.trim() || null,
            links,
            warnings: [],
            sourceRow: 0,
          };
        }
        if (s.kind === "requirement") {
          return {
            kind: "requirement" as const,
            title: r.title.trim(),
            detail_work: r.detail_work ?? "",
            acceptance_criteria: r.acceptance_criteria ?? "",
            priority: r.priority?.trim() || null,
            module_path: r.module_path?.trim() || null,
            links,
            warnings: [],
            sourceRow: 0,
          };
        }
        return {
          kind: "bug" as const,
          title: r.title.trim(),
          module_path: r.module_path?.trim() || null,
          repro_steps: r.repro_steps ?? "",
          expected_result: r.expected_result ?? "",
          actual_result: r.actual_result ?? "",
          evidence: r.evidence ?? "",
          status: r.status?.trim() || null,
          links,
          warnings: [],
          sourceRow: 0,
        };
      });
    return {
      sheetName: s.sheetName,
      kind: s.kind,
      rows,
      ignored: false,
    };
  });
  return { sheets, summary: summarizePreview(sheets) };
}

