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
  newLearningSuggestion,
  updateProjectLearningNote,
} from "@/lib/learning-notes/store";
import type { TaskStatus } from "@/lib/types";

export type BundleSheetKind =
  | "learning"
  | "competitor"
  | "requirement"
  | "bug"
  | "optimization";

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
};

export type LearningBundleRow = BundleRowBase & {
  kind: "learning";
  /** 板块名；有则建/挂到板块下主题 */
  section_title: string | null;
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
  };
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

function parseSheet(
  sheet: ExcelJS.Worksheet,
  kind: BundleSheetKind
): BundleParsedRow[] {
  const headers = headerMap(sheet);
  const rows: BundleParsedRow[] = [];
  const max = sheet.rowCount || 0;
  for (let r = 2; r <= max; r++) {
    const get = colGetter(sheet, headers, r);
    const links = parseLinkColumns(get);
    const warnings: string[] = [];

    if (kind === "learning") {
      const title = get([
        "主题",
        "标题",
        "知识点",
        "问题标题",
        "名称",
        "title",
        "name",
      ]);
      if (!title) continue;
      const points = get(["知识要点", "要点", "内容"]);
      const source = get(["出处", "来源", "source"]);
      const why =
        get(["为什么", "why"]) ||
        (source ? `出处：${source}` : "");
      rows.push({
        kind: "learning",
        title,
        section_title: get(["板块", "模块", "section"]) || null,
        why_text: why,
        principle: get(["原理", "principle"]) || points,
        protocol: get(["协议", "protocol"]),
        tech_background: get(["技术背景", "tech"]),
        competitors: get(["竞品说明", "竞品文字", "competitors"]),
        product_thinking: get(["产品思考", "product"]),
        source,
        links,
        warnings,
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

  return { sheets, summary };
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
  preview: BundlePreview
): Promise<BundleCommitResult> {
  const project = await getProjectById(projectIdOrSlug);
  if (!project) throw new Error("项目不存在");
  const projectId = project.id;

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
  };

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

  const pendingLinkJobs: Array<{
    kind: BundleSheetKind;
    id: string;
    links: BundleLinkRefs;
    evidence?: string;
  }> = [];

  for (const sheet of preview.sheets) {
    if (!sheet.kind) continue;
    for (const row of sheet.rows) {
      if (row.kind === "learning") {
        const parentId = row.section_title
          ? await ensureSection(row.section_title)
          : null;
        const existing = findByTitle(learnings, row.title);
        if (existing) {
          await updateProjectLearningNote(existing.id, {
            kind: existing.kind === "section" ? existing.kind : "topic",
            parent_id:
              existing.kind === "section"
                ? null
                : parentId ?? existing.parent_id,
            why_text: row.why_text || existing.why_text,
            principle: row.principle || existing.principle,
            protocol: row.protocol || existing.protocol,
            tech_background: row.tech_background || existing.tech_background,
            competitors: row.competitors || existing.competitors,
            product_thinking: row.product_thinking || existing.product_thinking,
          });
          learningByTitle.set(titleKey(row.title), existing.id);
          result.updated.learning += 1;
          pendingLinkJobs.push({
            kind: "learning",
            id: existing.id,
            links: row.links,
          });
        } else {
          const created = await createProjectLearningNote({
            project_id: projectId,
            title: row.title,
            kind: "topic",
            parent_id: parentId,
            why_text: row.why_text,
            principle: row.principle,
            protocol: row.protocol,
            tech_background: row.tech_background,
            competitors: row.competitors,
            product_thinking: row.product_thinking,
          });
          learningByTitle.set(titleKey(row.title), created.id);
          learnings = [...learnings, created];
          result.created.learning += 1;
          pendingLinkJobs.push({
            kind: "learning",
            id: created.id,
            links: row.links,
          });
        }
      } else if (row.kind === "optimization") {
        const sectionId = await ensureSection(row.section_title);
        const section = learnings.find((n) => n.id === sectionId);
        const detailParts = [
          row.detail?.trim() || "",
          row.benefit?.trim() ? `预期收益：${row.benefit.trim()}` : "",
          row.source?.trim() ? `出处：${row.source.trim()}` : "",
        ].filter(Boolean);
        const suggestion = newLearningSuggestion({
          title: row.title,
          detail: detailParts.join("\n"),
        });
        const existingSug = (section?.suggestions ?? []).find(
          (s) => titleKey(s.title) === titleKey(row.title)
        );
        if (existingSug) {
          await updateProjectLearningNote(sectionId, {
            suggestions: (section?.suggestions ?? []).map((s) =>
              s.id === existingSug.id
                ? {
                    ...s,
                    detail: suggestion.detail || s.detail,
                  }
                : s
            ),
          });
          result.updated.optimization += 1;
        } else {
          await updateProjectLearningNote(sectionId, {
            suggestions: [...(section?.suggestions ?? []), suggestion],
          });
          result.created.optimization += 1;
        }
        learnings = await listProjectLearningNotes(projectId);
        for (const x of learnings) {
          if (x.kind === "section") sectionByTitle.set(titleKey(x.title), x.id);
          learningByTitle.set(titleKey(x.title), x.id);
        }
      } else if (row.kind === "competitor") {
        const existing = findByTitle(competitors, row.title);
        if (existing) {
          await updateCompetitorEntry(existing.id, {
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
        const existing = findByTitle(
          requirements as Array<{ id: string; title: string }>,
          row.title
        );
        if (existing) {
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
        const existing = findByTitle(bugs, row.title);
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

  result.pendingLinks = Array.from(new Set(result.pendingLinks));
  return result;
}

const TEMPLATE_SHEETS: Array<{
  name: string;
  headers: string[];
  sample: string[];
}> = [
  {
    name: "学习",
    headers: [
      "标题",
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
      "RAID 原理",
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

/** 站内网格：列定义（与总表模板对齐） */
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
      { key: "title", label: "标题", width: "10rem" },
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

  const learningById = new Map(learnings.map((n) => [n.id, n.title]));
  const competitorById = new Map(competitors.map((n) => [n.id, n.title]));
  const requirementById = new Map(requirements.map((n) => [n.id, n.title]));
  const bugById = new Map(bugs.map((n) => [n.id, n.title]));
  const sectionTitleById = new Map(
    learnings.filter((n) => n.kind === "section").map((n) => [n.id, n.title])
  );

  const learningRows: LearningBundleRow[] = learnings
    .filter((n) => n.kind !== "section" && n.title.trim())
    .map((n) => ({
      kind: "learning" as const,
      title: n.title,
      section_title: n.parent_id
        ? sectionTitleById.get(n.parent_id) ?? null
        : null,
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
      },
      warnings: [],
    }));

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
          idsToTitles(n.linked_learning_note_ids ?? [], learningById)
        ),
        requirementTitles: splitTitles(
          idsToTitles(n.linked_requirement_ids ?? [], requirementById)
        ),
        bugTitles: splitTitles(idsToTitles(n.linked_bug_ids ?? [], bugById)),
        urls: n.url ? [n.url] : [],
      },
      warnings: [],
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
          idsToTitles(n.linked_learning_note_ids ?? [], learningById)
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
          return {
            kind: "learning" as const,
            title: r.title.trim(),
            section_title: r.section_title?.trim() || null,
            why_text: r.why_text ?? "",
            principle: r.principle ?? "",
            protocol: r.protocol ?? "",
            tech_background: r.tech_background ?? "",
            competitors: r.competitors ?? "",
            product_thinking: r.product_thinking ?? "",
            source: "",
            links,
            warnings: [],
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

export function emptyGridRow(kind: GridSheetDef["kind"]): GridRow {
  const def = WORKBOOK_GRID_SHEETS.find((s) => s.kind === kind)!;
  const row: GridRow = {};
  for (const col of def.columns) row[col.key] = "";
  return row;
}
