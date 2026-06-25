import { NextResponse } from "next/server";
import { getProjectById } from "@/lib/db";
import { parseNotionCsv } from "@/lib/notion/parser";
import { importNotionCsvToPool } from "@/lib/notion/importer";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) return new NextResponse("项目不存在", { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file");
  const clearPool = formData.get("clearPool") === "true";

  if (!(file instanceof Blob)) {
    return new NextResponse("缺少文件", { status: 400 });
  }

  const text = await file.text();
  const fileName = file instanceof File ? file.name : "notion.csv";
  const preview = parseNotionCsv(text, fileName);

  if (!preview.rows.length) {
    return new NextResponse(preview.warnings.join("；") || "无有效数据", { status: 400 });
  }

  const result = await importNotionCsvToPool(project.id, preview, { clearPool });

  return NextResponse.json({ result, preview });
}
