import { NextResponse } from "next/server";
import {
  commitWorkbookBundle,
  parseWorkbookBundle,
  type BundlePreview,
} from "@/lib/excel/workbook-bundle";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof Blob)) {
    return new NextResponse("缺少文件", { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  let preview: BundlePreview;
  const previewJson = formData.get("preview");
  if (typeof previewJson === "string" && previewJson.trim()) {
    preview = JSON.parse(previewJson) as BundlePreview;
  } else {
    preview = await parseWorkbookBundle(buffer);
  }

  try {
    const result = await commitWorkbookBundle(id, preview, {
      workbookBuffer: buffer,
    });
    return NextResponse.json({ result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "写入失败";
    return new NextResponse(msg, { status: 400 });
  }
}
