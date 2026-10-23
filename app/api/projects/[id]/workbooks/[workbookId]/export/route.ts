import { resolveProjectRoute } from "@/lib/project-bridge";
import { getProjectWorkbook } from "@/lib/workbooks/store";
import { fortuneSheetsToXlsxBuffer } from "@/lib/workbooks/export-xlsx";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; workbookId: string }> }
) {
  const { id, workbookId } = await params;
  const ctx = await resolveProjectRoute(id);
  const projectId = ctx.pmProject?.id;
  if (!projectId) {
    return new Response("项目未接入 PM", { status: 400 });
  }
  try {
    const workbook = await getProjectWorkbook(workbookId);
    if (!workbook || workbook.project_id !== projectId) {
      return new Response("工作簿不存在", { status: 404 });
    }
    const buf = await fortuneSheetsToXlsxBuffer(
      workbook.sheet_data,
      workbook.title
    );
    const filename = `${workbook.title || "workbook"}.xlsx`.replace(
      /[\\/:*?"<>|]/g,
      "_"
    );
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
          filename
        )}`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "导出失败";
    return new Response(msg, { status: 400 });
  }
}
