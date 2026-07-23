import ExcelJS from "exceljs";
import { parseFlexibleDate } from "@/lib/utils";

export interface ParsedRoleColumn {
  role: string;
  colHours?: number;
  colAssignee?: number;
  colProgress?: number;
  colStart?: number;
  colEnd?: number;
}

export interface ParsedRequirementRow {
  iterationName?: string;
  moduleL1?: string;
  moduleL2?: string;
  moduleL3?: string;
  subFunction?: string;
  detailWork?: string;
  acceptanceCriteria?: string;
  priority?: string;
  status?: string;
  blocker?: string;
  roles: Array<{
    role: string;
    estimateHours?: number | null;
    assignee?: string | null;
    progress?: number | null;
    startDate?: string | null;
    endDate?: string | null;
  }>;
  warnings: string[];
}

export interface ParsePreview {
  sheetName: string;
  headerRows: number;
  roleColumns: ParsedRoleColumn[];
  rows: ParsedRequirementRow[];
  summary: {
    requirementCount: number;
    totalEstimateHours: number;
    dateWarnings: number;
    duplicateWarnings: number;
  };
}

const ROLE_KEYWORDS: Record<string, string[]> = {
  product: ["产品"],
  ui: ["ui", "UI"],
  hardware: ["硬件"],
  embedded: ["嵌入式", "gis", "GIS"],
  backend: ["后端"],
  frontend: ["前端"],
  algorithm: ["算法"],
  test: ["测试"],
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, "")
    .replace(/（.*?）/g, "")
    .toLowerCase();
}

function detectRole(text: string): string | null {
  const raw = String(text);
  for (const [role, keywords] of Object.entries(ROLE_KEYWORDS)) {
    if (keywords.some((k) => raw.includes(k))) return role;
  }
  return null;
}

function getCellValue(
  sheet: ExcelJS.Worksheet,
  row: number,
  col: number,
  mergedMap: Map<string, ExcelJS.CellValue>
): ExcelJS.CellValue {
  const key = `${row}:${col}`;
  if (mergedMap.has(key)) return mergedMap.get(key);
  return sheet.getCell(row, col).value;
}

function buildMergedMap(sheet: ExcelJS.Worksheet): Map<string, ExcelJS.CellValue> {
  const map = new Map<string, ExcelJS.CellValue>();
  for (const range of sheet.model.merges ?? []) {
    const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(range);
    if (!match) continue;
    const startCol = colLettersToNumber(match[1]);
    const startRow = Number(match[2]);
    const endCol = colLettersToNumber(match[3]);
    const endRow = Number(match[4]);
    const value = sheet.getCell(startRow, startCol).value;
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        map.set(`${r}:${c}`, value);
      }
    }
  }
  return map;
}

function colLettersToNumber(col: string): number {
  let num = 0;
  for (const ch of col) num = num * 26 + (ch.charCodeAt(0) - 64);
  return num;
}

function parseHeader(sheet: ExcelJS.Worksheet, mergedMap: Map<string, ExcelJS.CellValue>) {
  const roleColumns: ParsedRoleColumn[] = [];
  const maxCol = sheet.columnCount;

  for (let row = 1; row <= 4; row++) {
    for (let col = 1; col <= maxCol; col++) {
      const value = getCellValue(sheet, row, col, mergedMap);
      if (!value) continue;
      const text = String(value);
      const role = detectRole(text);
      if (role) {
        let entry = roleColumns.find((r) => r.role === role && !r.colHours);
        if (!entry) {
          entry = { role };
          roleColumns.push(entry);
        }
      }
      const normalized = normalizeHeader(value);
      const last = roleColumns[roleColumns.length - 1];
      if (!last) continue;
      // 「工时核定」含「工时」字样，不能覆盖真正的工时(小时)列
      if (
        (normalized.includes("工时") || normalized === "小时") &&
        !normalized.includes("核定")
      ) {
        last.colHours = col;
      }
      if (normalized.includes("参与人") || normalized.includes("负责人")) last.colAssignee = col;
      if (normalized.includes("进度")) last.colProgress = col;
      if (normalized.includes("开始")) last.colStart = col;
      if (normalized.includes("结束")) last.colEnd = col;
    }
  }

  return { roleColumns: dedupeRoleColumns(roleColumns), headerRows: 4 };
}

function dedupeRoleColumns(columns: ParsedRoleColumn[]): ParsedRoleColumn[] {
  const map = new Map<string, ParsedRoleColumn>();
  for (const col of columns) {
    const existing = map.get(col.role);
    if (!existing) {
      map.set(col.role, { ...col });
      continue;
    }
    for (const key of ["colHours", "colAssignee", "colProgress", "colStart", "colEnd"] as const) {
      if (existing[key] == null && col[key] != null) existing[key] = col[key];
    }
  }
  return Array.from(map.values());
}

function findColumnByKeyword(
  sheet: ExcelJS.Worksheet,
  mergedMap: Map<string, ExcelJS.CellValue>,
  keyword: string,
  rows = 4
): number | undefined {
  for (let row = 1; row <= rows; row++) {
    for (let col = 1; col <= sheet.columnCount; col++) {
      const value = getCellValue(sheet, row, col, mergedMap);
      if (value && String(value).includes(keyword)) return col;
    }
  }
  return undefined;
}

export async function parseWorkbookPreview(buffer: ArrayBuffer): Promise<ParsePreview[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const previews: ParsePreview[] = [];

  for (const sheet of workbook.worksheets) {
    if (sheet.rowCount < 5) continue;
    const mergedMap = buildMergedMap(sheet);
    const { roleColumns, headerRows } = parseHeader(sheet, mergedMap);

    const colIteration = findColumnByKeyword(sheet, mergedMap, "项目名称") ?? 1;
    const colL1 =
      findColumnByKeyword(sheet, mergedMap, "一级模块") ??
      findColumnByKeyword(sheet, mergedMap, "一期") ??
      2;
    const colL2 = findColumnByKeyword(sheet, mergedMap, "二级模块");
    const colL3 = findColumnByKeyword(sheet, mergedMap, "三级模块");
    // 旧版一期表没有「细分功能」列；勿默认落到工时列（常为第 4 列）
    const colSub = findColumnByKeyword(sheet, mergedMap, "细分功能");
    const colDetail = findColumnByKeyword(sheet, mergedMap, "详细工作");
    const colAccept = findColumnByKeyword(sheet, mergedMap, "验收标准");
    const colPriority = findColumnByKeyword(sheet, mergedMap, "优先级");
    const colBlocker = findColumnByKeyword(sheet, mergedMap, "阻塞项");

    const rows: ParsedRequirementRow[] = [];
    let current = {
      iterationName: "",
      moduleL1: "",
      moduleL2: "",
      moduleL3: "",
    };

    for (let row = headerRows + 1; row <= sheet.rowCount; row++) {
      const iterationName = String(getCellValue(sheet, row, colIteration, mergedMap) ?? "").trim();
      const moduleL1 = String(getCellValue(sheet, row, colL1, mergedMap) ?? "").trim();
      const moduleL2 = colL2
        ? String(getCellValue(sheet, row, colL2, mergedMap) ?? "").trim()
        : "";
      const moduleL3 = colL3
        ? String(getCellValue(sheet, row, colL3, mergedMap) ?? "").trim()
        : "";
      const subFunction = colSub
        ? String(getCellValue(sheet, row, colSub, mergedMap) ?? "").trim()
        : "";

      if (iterationName) current.iterationName = iterationName;
      if (moduleL1) current.moduleL1 = moduleL1;
      if (moduleL2) current.moduleL2 = moduleL2;
      if (moduleL3) current.moduleL3 = moduleL3;

      const hasContent = moduleL1 || moduleL2 || moduleL3 || subFunction || iterationName;
      if (!hasContent) continue;

      const warnings: string[] = [];
      const roles = roleColumns.map((rc) => {
        const estimateRaw = rc.colHours
          ? getCellValue(sheet, row, rc.colHours, mergedMap)
          : null;
        const assigneeRaw = rc.colAssignee
          ? getCellValue(sheet, row, rc.colAssignee, mergedMap)
          : null;
        const progressRaw = rc.colProgress
          ? getCellValue(sheet, row, rc.colProgress, mergedMap)
          : null;
        const startRaw = rc.colStart ? getCellValue(sheet, row, rc.colStart, mergedMap) : null;
        const endRaw = rc.colEnd ? getCellValue(sheet, row, rc.colEnd, mergedMap) : null;

        const startDate = parseFlexibleDate(startRaw);
        const endDate = parseFlexibleDate(endRaw);
        if ((startRaw || endRaw) && (!startDate || !endDate)) {
          warnings.push(`${rc.role} 日期格式异常`);
        }

        return {
          role: rc.role,
          estimateHours:
            estimateRaw == null || estimateRaw === ""
              ? null
              : Number(String(estimateRaw).replace(/[^\d.]/g, "")) || null,
          assignee: assigneeRaw ? String(assigneeRaw).trim() : null,
          progress:
            progressRaw == null || progressRaw === ""
              ? null
              : Number(String(progressRaw).replace("%", "")) || null,
          startDate,
          endDate,
        };
      });

      const title =
        subFunction ||
        moduleL3 ||
        moduleL2 ||
        moduleL1 ||
        current.moduleL3 ||
        current.moduleL2 ||
        current.moduleL1 ||
        "未命名需求";

      rows.push({
        iterationName: current.iterationName,
        moduleL1: moduleL1 || current.moduleL1,
        moduleL2: moduleL2 || current.moduleL2,
        moduleL3: moduleL3 || current.moduleL3 || undefined,
        subFunction: subFunction || undefined,
        detailWork: colDetail
          ? String(getCellValue(sheet, row, colDetail, mergedMap) ?? "").trim() || undefined
          : undefined,
        acceptanceCriteria: colAccept
          ? String(getCellValue(sheet, row, colAccept, mergedMap) ?? "").trim() || undefined
          : undefined,
        priority: colPriority
          ? String(getCellValue(sheet, row, colPriority, mergedMap) ?? "").trim() || undefined
          : undefined,
        blocker: colBlocker
          ? String(getCellValue(sheet, row, colBlocker, mergedMap) ?? "").trim() || undefined
          : undefined,
        roles: roles.filter(
          (r) =>
            r.estimateHours != null ||
            r.assignee ||
            r.startDate ||
            r.endDate ||
            r.progress != null
        ),
        warnings,
      });
    }

    const totalEstimateHours = rows.reduce(
      (sum, row) => sum + row.roles.reduce((s, r) => s + (r.estimateHours ?? 0), 0),
      0
    );

    previews.push({
      sheetName: sheet.name,
      headerRows,
      roleColumns,
      rows,
      summary: {
        requirementCount: rows.length,
        totalEstimateHours,
        dateWarnings: rows.reduce((n, r) => n + r.warnings.length, 0),
        duplicateWarnings: 0,
      },
    });
  }

  return previews;
}
