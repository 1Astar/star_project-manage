import { NextResponse } from "next/server";
import {
  annotateWorkbookConflicts,
  parseWorkbookBundle,
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
  const parsed = await parseWorkbookBundle(buffer);
  const preview = await annotateWorkbookConflicts(id, parsed);
  return NextResponse.json({ preview });
}
