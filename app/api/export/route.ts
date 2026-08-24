import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/require-admin";
import { isTableExportKind, loadExportSheets } from "@/lib/export/catalog";
import { downloadHeaders, sheetToCsv, sheetsToXlsx } from "@/lib/export/table-format";
import { mapStudioError, studioErr } from "@/lib/studio/route-utils";

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const kindRaw = url.searchParams.get("kind")?.trim() ?? "";
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const project = url.searchParams.get("project")?.trim() || null;

  if (!isTableExportKind(kindRaw)) {
    return studioErr("未知导出类型", 400);
  }

  try {
    const { filenameBase, sheets } = await loadExportSheets({ kind: kindRaw, project });
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "csv") {
      const body =
        sheets.length === 1
          ? sheetToCsv(sheets[0]!)
          : `\uFEFF${sheets
              .map((s) => `# ${s.name}\r\n${sheetToCsv(s).replace(/^\uFEFF/, "")}`)
              .join("\r\n")}`;
      const filename = `${filenameBase}-${stamp}.csv`;
      return new NextResponse(body, { headers: downloadHeaders(filename, "csv") });
    }

    const buf = await sheetsToXlsx(sheets);
    const filename = `${filenameBase}-${stamp}.xlsx`;
    return new NextResponse(buf, { headers: downloadHeaders(filename, "xlsx") });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "导出失败";
    if (/需要指定项目|未接入|不存在|未知/.test(msg)) {
      return studioErr(msg, 400);
    }
    return mapStudioError(error);
  }
}
