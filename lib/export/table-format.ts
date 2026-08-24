import ExcelJS from "exceljs";

export type ExportCell = string | number | boolean | null | undefined;

export type ExportSheet = {
  name: string;
  headers: string[];
  rows: ExportCell[][];
};

export function sheetToCsv(sheet: ExportSheet): string {
  const lines = [sheet.headers, ...sheet.rows].map((row) =>
    row
      .map((cell) => {
        const s = cell == null ? "" : String(cell);
        if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
      })
      .join(",")
  );
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export async function sheetsToXlsx(sheets: ExportSheet[]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  for (const sheet of sheets) {
    const name = sheet.name.replace(/[\\/?*[\]]/g, " ").slice(0, 31) || "Sheet";
    const ws = wb.addWorksheet(name);
    ws.addRow(sheet.headers);
    const header = ws.getRow(1);
    header.font = { bold: true };
    for (const row of sheet.rows) {
      ws.addRow(row.map((c) => (c == null ? "" : c)));
    }
    sheet.headers.forEach((_, i) => {
      const col = ws.getColumn(i + 1);
      col.width = Math.min(40, Math.max(12, String(sheet.headers[i] ?? "").length + 4));
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}

export function downloadHeaders(filename: string, format: "xlsx" | "csv") {
  const encoded = encodeURIComponent(filename);
  if (format === "csv") {
    return {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encoded}`,
    };
  }
  return {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename*=UTF-8''${encoded}`,
  };
}
