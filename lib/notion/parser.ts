import type { TaskStatus } from "@/lib/types";

export interface NotionCsvRow {
  title: string;
  moduleName: string | null;
  category: string | null;
  stageType: string | null;
  statusRaw: string | null;
  priority: string | null;
  optimizationNotes: string | null;
  knownIssues: string | null;
  subFunction: string | null;
  difficultyNotes: string | null;
  scenario: string | null;
  submittedAt: string | null;
  dueDate: string | null;
  needsDiscussion: boolean;
  tags: string[];
  isModuleHeader: boolean;
}

export interface NotionCsvPreview {
  fileName: string;
  rowCount: number;
  rows: NotionCsvRow[];
  warnings: string[];
}

const HEADER_MAP: Record<string, keyof Omit<NotionCsvRow, "isModuleHeader">> = {
  功能点: "title",
  名称: "title",
  name: "title",
  标题: "title",
  产品模块: "moduleName",
  模块: "moduleName",
  功能分类: "category",
  分类: "category",
  阶段类型: "stageType",
  阶段: "stageType",
  状态: "statusRaw",
  status: "statusRaw",
  优先级: "priority",
  priority: "priority",
  优化方向: "optimizationNotes",
  存在问题: "knownIssues",
  问题: "knownIssues",
  功能细分: "subFunction",
  细分功能: "subFunction",
  难点: "difficultyNotes",
  场景: "scenario",
  需求提出时间: "submittedAt",
  提出时间: "submittedAt",
  截止日期: "dueDate",
  截止: "dueDate",
  需讨论: "needsDiscussion",
  标签: "tags",
};

const STATUS_MAP: Record<string, TaskStatus> = {
  未开始: "pending",
  待开始: "pending",
  需优化: "pending",
  进行中: "in_progress",
  开发中: "in_progress",
  联调: "integration",
  待测试: "testing",
  测试: "testing",
  待验收: "acceptance",
  已发布: "done",
  已完成: "done",
  阻塞: "blocked",
};

export function parseNotionDate(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const cn = trimmed.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (cn) {
    const [, y, m, d] = cn;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

export function mapNotionStatus(raw?: string | null): TaskStatus {
  if (!raw) return "pending";
  const trimmed = raw.trim();
  if (STATUS_MAP[trimmed]) return STATUS_MAP[trimmed];
  for (const [key, val] of Object.entries(STATUS_MAP)) {
    if (trimmed.includes(key)) return val;
  }
  return "pending";
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

function normalizeHeader(value: string): string {
  return value.replace(/^\ufeff/, "").trim().toLowerCase();
}

function resolveField(header: string): keyof Omit<NotionCsvRow, "isModuleHeader"> | null {
  const key = normalizeHeader(header);
  if (HEADER_MAP[header.trim()]) return HEADER_MAP[header.trim()];
  for (const [alias, field] of Object.entries(HEADER_MAP)) {
    if (normalizeHeader(alias) === key) return field;
  }
  return null;
}

export function parseNotionCsv(text: string, fileName = "notion.csv"): NotionCsvPreview {
  const warnings: string[] = [];
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return { fileName, rowCount: 0, rows: [], warnings: ["CSV 至少需要表头与一行数据"] };
  }

  const headers = parseCsvLine(lines[0]);
  const fieldIndexes = headers.map((h) => resolveField(h));

  if (!fieldIndexes.some((f) => f === "title")) {
    warnings.push("未识别到「功能点/名称」列，已使用第一列作为功能点");
  }

  const rows: NotionCsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const row: NotionCsvRow = {
      title: "",
      moduleName: null,
      category: null,
      stageType: null,
      statusRaw: null,
      priority: null,
      optimizationNotes: null,
      knownIssues: null,
      subFunction: null,
      difficultyNotes: null,
      scenario: null,
      submittedAt: null,
      dueDate: null,
      needsDiscussion: false,
      tags: [],
      isModuleHeader: false,
    };

    cells.forEach((cell, idx) => {
      const field = fieldIndexes[idx];
      if (!field) return;
      const value = cell.trim();
      if (!value) return;
      if (field === "title") row.title = value;
      else if (field === "needsDiscussion") {
        row.needsDiscussion = ["是", "true", "yes", "1", "✓", "☑"].includes(value.toLowerCase());
      } else if (field === "tags") {
        row.tags = value.split(/[,，、]/).map((t) => t.trim()).filter(Boolean);
      } else if (field === "submittedAt" || field === "dueDate") {
        row[field] = parseNotionDate(value);
      } else {
        row[field] = value;
      }
    });

    if (!row.title && cells[0]) {
      row.title = cells[0].trim();
    }

    if (!row.title) continue;

    const otherFilled = Boolean(
      row.category ||
        row.stageType ||
        row.statusRaw ||
        row.priority ||
        row.optimizationNotes ||
        row.knownIssues ||
        row.subFunction ||
        row.difficultyNotes ||
        row.scenario ||
        row.submittedAt ||
        row.dueDate ||
        row.needsDiscussion
    );
    row.isModuleHeader = !otherFilled && Boolean(row.moduleName || row.title);

    rows.push(row);
  }

  if (!rows.length) {
    warnings.push("未解析到有效数据行");
  }

  return { fileName, rowCount: rows.length, rows, warnings };
}
