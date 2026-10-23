import { NextResponse } from "next/server";
import { parseWorkbookBundle } from "@/lib/excel/workbook-bundle";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await params;
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof Blob)) {
    return new NextResponse("缺少文件", { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const preview = await parseWorkbookBundle(buffer);
  return NextResponse.json({ preview });
}
