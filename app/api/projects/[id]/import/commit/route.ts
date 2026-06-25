import { NextResponse } from "next/server";
import { parseWorkbookPreview } from "@/lib/excel/parser";
import { importSheetToProject } from "@/lib/excel/importer";
import { getProjectById } from "@/lib/db/local-store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) return new NextResponse("项目不存在", { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file");
  const sheetName = formData.get("sheetName");
  const clearExisting = formData.get("clearExisting") === "true";

  if (!(file instanceof Blob)) {
    return new NextResponse("缺少文件", { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const previews = await parseWorkbookPreview(buffer);
  const target =
    typeof sheetName === "string" && sheetName
      ? previews.find((p) => p.sheetName === sheetName)
      : previews[0];

  if (!target) return new NextResponse("未找到可导入的 Sheet", { status: 400 });

  const result = await importSheetToProject(project.id, target, {
    clearProjectRequirements: clearExisting,
  });

  return NextResponse.json({ result, sheetName: target.sheetName });
}
