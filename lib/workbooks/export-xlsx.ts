import ExcelJS from "exceljs";

type CellPayload = {
  r?: number;
  c?: number;
  v?: unknown;
};

function cellDisplay(v: unknown): string | number | boolean | Date | null {
  if (v == null) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return v;
  }
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (o.m != null) return String(o.m);
    if (o.v != null) {
      if (
        typeof o.v === "string" ||
        typeof o.v === "number" ||
        typeof o.v === "boolean"
      ) {
        return o.v;
      }
      return String(o.v);
    }
  }
  return String(v);
}

/**
 * 把 FortuneSheet Sheet[] 导出为 xlsx（值级；不做完整样式/图片还原）。
 */
export async function fortuneSheetsToXlsxBuffer(
  sheets: Array<Record<string, unknown>>,
  fileTitle: string
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Star PM";
  wb.created = new Date();

  const list = sheets.length
    ? sheets
    : [{ name: fileTitle.slice(0, 31) || "Sheet1", celldata: [] }];

  for (const sheet of list) {
    const name = String(sheet.name ?? "Sheet").slice(0, 31) || "Sheet";
    const ws = wb.addWorksheet(name);
    const celldata = Array.isArray(sheet.celldata)
      ? (sheet.celldata as CellPayload[])
      : [];

    // 若有矩阵 data，优先展平；否则用 celldata
    const matrix = Array.isArray(sheet.data) ? (sheet.data as unknown[][]) : null;
    if (matrix && matrix.length) {
      matrix.forEach((row, ri) => {
        if (!Array.isArray(row)) return;
        row.forEach((cell, ci) => {
          const val = cellDisplay(cell);
          if (val == null || val === "") return;
          ws.getCell(ri + 1, ci + 1).value = val as ExcelJS.CellValue;
        });
      });
    } else {
      for (const cell of celldata) {
        const r = Number(cell.r ?? 0);
        const c = Number(cell.c ?? 0);
        const val = cellDisplay(cell.v);
        if (val == null || val === "") continue;
        ws.getCell(r + 1, c + 1).value = val as ExcelJS.CellValue;
      }
    }

    ws.getRow(1).font = { bold: true };
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
