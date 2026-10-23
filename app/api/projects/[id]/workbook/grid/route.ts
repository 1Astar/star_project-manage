import { NextResponse } from "next/server";
import {
  commitWorkbookBundle,
  gridStateToPreview,
  loadWorkbookBundleFromProject,
  previewToGridState,
  type WorkbookGridState,
} from "@/lib/excel/workbook-bundle";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const preview = await loadWorkbookBundleFromProject(id);
    const grid = previewToGridState(preview);
    return NextResponse.json({ grid, preview });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "加载失败";
    return new NextResponse(msg, { status: 400 });
  }
}

/** 站内网格同步写入（无需上传文件） */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = (await request.json()) as { grid?: WorkbookGridState };
    if (!body.grid) {
      return new NextResponse("缺少 grid", { status: 400 });
    }
    const preview = gridStateToPreview(body.grid);
    const result = await commitWorkbookBundle(id, preview);
    return NextResponse.json({ result, preview });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "写入失败";
    return new NextResponse(msg, { status: 400 });
  }
}
